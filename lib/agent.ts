import OpenAI from 'openai';
import { db } from './db';
import { sendSMS } from './twilio';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function runFollowUpAgent(patientId: string, incomingMessage?: string) {
  // 1. Fetch patient context
  const patientRes = await db.query(
    'SELECT id, name, phone, workflow_step, risk_level FROM patients WHERE id = $1',
    [patientId]
  );
  const patient = patientRes.rows[0];
  if (!patient) return { error: 'Patient not found' };

  // 2. Fetch history
  const historyRes = await db.query(
    `SELECT type, payload FROM events WHERE patient_id = $1 ORDER BY id DESC LIMIT 3`,
    [patientId]
  );
  const history = historyRes.rows.reverse().map((r: any) => `${r.type}: ${JSON.stringify(r.payload)}`).join('\n');

  const systemPrompt = `You are CareOS, an automated clinical triage bot.
Goal: Send follow-up SMS to patients.
Patient: ${patient.name} (${patient.phone})
Step: ${patient.workflow_step}
Recent History:
${history}

CRITICAL: You must output your response in this EXACT format:
Reasoning: <your reasoning here>
Action: {"type": "send_sms", "message": "<warm personalized message>"}

If this is a scheduled check-in and no previous message was sent, YOU MUST ONLY use Action: {"type": "send_sms", ...}. Do NOT advance the workflow or escalate until the patient responds.`;

  const userPrompt = incomingMessage 
    ? `Patient replied: "${incomingMessage}"`
    : `It is time for the ${patient.workflow_step} check-in. Send the initial text.`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0,
  });

  const content = response.choices[0].message.content || '';
  console.log('AGENT OUTPUT:', content);

  // Try to find ANY JSON object in the text
  const jsonMatch = content.match(/\{.*\}/s);
  if (jsonMatch) {
    try {
      const action = JSON.parse(jsonMatch[0]);
      
      if (action.type === 'send_sms' && action.message) {
        const twilioRes = await sendSMS(patient.phone, action.message);
        await db.query(
          `INSERT INTO events (patient_id, type, payload) VALUES ($1, 'sms_sent', $2)`,
          [patientId, JSON.stringify({ message: action.message, sid: twilioRes.sid })]
        );
        return { ok: patientId, action: action.type, message: action.message, sid: twilioRes.sid };
      } else if (action.type === 'escalate') {
        await db.query(
          `UPDATE patients SET workflow_step='escalated', risk_level=$1 WHERE id=$2`,
          [action.urgency, patientId]
        );
        await db.query(
          `INSERT INTO events (patient_id, type, payload) VALUES ($1, 'escalated', $2)`,
          [patientId, JSON.stringify({ reason: action.reason, urgency: action.urgency })]
        );
      } else if (action.type === 'advance_workflow') {
        await db.query(
          `UPDATE patients SET workflow_step=$1 WHERE id=$2`,
          [action.next_step, patientId]
        );
      }

      // Log reasoning to events
      await db.query(
        `INSERT INTO events (patient_id, type, payload) VALUES ($1, 'agent_reasoning', $2)`,
        [patientId, JSON.stringify({ steps: [{ text: content, toolCalls: [action.type] }] })]
      );

      return { ok: true, action: action.type, message: action.message };
    } catch (e) {
      console.error('Action execution failed', e);
      return { ok: false, error: String(e) };
    }
  }

  return { ok: true, reasoning: content };
}
