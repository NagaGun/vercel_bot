import OpenAI from 'openai';
import { db } from './db';
import { sendSMS } from './twilio';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function runFollowUpAgent(patientId: string, incomingMessage?: string) {
  // 1. Fetch patient context
  const patientRes = await db.query(
    'SELECT id, name, phone, workflow_step, risk_level, discharge_summary FROM patients WHERE id = $1',
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

  const systemPrompt = `You are CareOS, a clinical post-discharge follow-up agent.
Your job: contact patients via SMS, parse responses, and escalate to nurses for danger signs (chest pain, breathing issues, etc).
Context for Patient ${patient.name}:
- Discharge Summary: ${patient.discharge_summary || 'None'}
- Current Step: ${patient.workflow_step}
- History: ${history}

If this is a NEW follow-up (no incoming message), your goal is to send a warm check-in SMS.
If this is a REPLY from the patient, analyze it and either reply via SMS or escalate to a nurse.

Available Actions:
- send_sms(message): Send a text (max 160 chars recommended).
- escalate(reason, urgency): Flag to nurse (urgency: high/critical).
- advance_workflow(next_step): Move to day_3, day_7, day_30, or complete.

Output your reasoning first, then a JSON action:
Reasoning: [your thought process]
Action: {"type": "send_sms", "message": "..."}`;

  const userPrompt = incomingMessage 
    ? `Patient says: "${incomingMessage}"`
    : `Initiate scheduled follow-up for ${patient.name}.`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.1,
  });

  const content = response.choices[0].message.content || '';
  console.log('Agent reasoning:', content);

  // Parse Action
  const actionMatch = content.match(/Action:\s*(\{.*\})/s);
  if (actionMatch) {
    try {
      const action = JSON.parse(actionMatch[1]);
      
      if (action.type === 'send_sms') {
        await sendSMS(patient.phone, action.message);
        await db.query(
          `INSERT INTO events (patient_id, type, payload) VALUES ($1, 'sms_sent', $2)`,
          [patientId, JSON.stringify({ message: action.message })]
        );
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

      // Log reasoning
      await db.query(
        `INSERT INTO events (patient_id, type, payload) VALUES ($1, 'agent_reasoning', $2)`,
        [patientId, JSON.stringify({ steps: [{ text: content, toolCalls: [action.type] }] })]
      );

      return { ok: patientId, action: action.type };
    } catch (e) {
      console.error('Failed to parse action', e);
    }
  }

  return { ok: patientId, reasoning: content };
}
