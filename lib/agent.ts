import { generateText, tool, stepCountIs } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { db } from './db';
import { sendSMS } from './twilio';

// openai is imported from @ai-sdk/openai, no need to redefine it


export async function runFollowUpAgent(patientId: string, incomingMessage?: string) {
  // Pull last 3 events for conversation memory
  const historyQuery = await db.query(
    `SELECT type, payload FROM events WHERE patient_id = $1 ORDER BY id DESC LIMIT 3`,
    [patientId]
  );
  let historyContext = '';
  if (historyQuery.rows.length > 0) {
    historyContext = `\n\nRecent interaction history:\n` +
      historyQuery.rows.reverse().map((r: any) => `[${r.type}] ${JSON.stringify(r.payload)}`).join('\n');
  }

  const basePrompt = incomingMessage
    ? `Patient ID ${patientId} replied: "${incomingMessage}". Analyze and take appropriate action using their discharge summary for context.`
    : `Time to send scheduled follow-up to patient ${patientId}. Look up their record first — their discharge summary contains critical context. Use it to send a personalized, clinically relevant message.`;

  const result = await generateText({
    model: openai('gpt-4o'),
    stopWhen: stepCountIs(8),
    system: `You are CareOS, a clinical post-discharge follow-up agent.
Your job: contact patients, parse their responses, and escalate to nurses when there are danger signs.
You are running as an automated service. NEVER ask the user for permission.
If a patient is due for a check-in, ALWAYS call lookupPatient first, then ALWAYS call sendSMSToPatient to initiate contact.
If the discharge summary is missing, send a warm, general follow-up message.
Always be brief in SMS. Never diagnose. Always escalate when uncertain.`,

    prompt: basePrompt + historyContext,

    tools: {
      lookupPatient: tool({
        description: 'Get patient info, current workflow step, and discharge summary. ALWAYS call this first.',
        parameters: z.object({
          patientId: z.string().describe('The unique UUID of the patient'),
        }),
        execute: async ({ patientId }) => {
          const patient = await db.query(
            'SELECT id, name, phone, workflow_step, risk_level, discharge_date, medications, discharge_summary FROM patients WHERE id = $1',
            [patientId]
          );
          const row = patient.rows[0];
          if (row?.discharge_summary) {
            row.discharge_summary = row.discharge_summary.split(/\s+/).slice(0, 400).join(' ');
          }
          return row;
        },
      }),

      sendSMSToPatient: tool({
        description: 'Send an SMS message to the patient',
        parameters: z.object({
          patientId: z.string().describe('The unique UUID of the patient'),
          message: z.string().max(320).describe('The clinical SMS message content'),
        }),
        execute: async ({ patientId, message }) => {
          const patient = await db.query('SELECT phone FROM patients WHERE id = $1', [patientId]);
          await sendSMS(patient.rows[0].phone, message);
          await db.query(
            `INSERT INTO events (patient_id, type, payload) VALUES ($1, 'sms_sent', $2)`,
            [patientId, JSON.stringify({ message })]
          );
          return { sent: true };
        },
      }),

      advanceWorkflow: tool({
        description: 'Move patient to next scheduled step',
        parameters: z.object({
          patientId: z.string().describe('The unique UUID of the patient'),
          nextStep: z.enum(['day_3', 'day_7', 'day_30', 'complete']).describe('The next clinical follow-up milestone'),
        }),
        execute: async ({ patientId, nextStep }) => {
          const delays: Record<string, number> = { day_3: 3, day_7: 7, day_30: 30, complete: 999 };
          const nextContactAt = new Date();
          nextContactAt.setDate(nextContactAt.getDate() + (delays[nextStep] ?? 1));
          await db.query(
            `UPDATE patients SET workflow_step=$1, next_contact_at=$2 WHERE id=$3`,
            [nextStep, nextContactAt.toISOString(), patientId]
          );
          return { advanced: true, nextStep };
        },
      }),

      escalateToNurse: tool({
        description: 'Flag patient as critical — requires nurse review NOW',
        parameters: z.object({
          patientId: z.string().describe('The unique UUID of the patient'),
          reason: z.string().describe('Detailed clinical reason for escalation'),
          urgency: z.enum(['high', 'critical']).describe('The triage priority level'),
        }),
        execute: async ({ patientId, reason, urgency }) => {
          await db.query(
            `UPDATE patients SET workflow_step='escalated', risk_level=$1 WHERE id=$2`,
            [urgency, patientId]
          );
          await db.query(
            `INSERT INTO events (patient_id, type, payload) VALUES ($1, 'escalated', $2)`,
            [patientId, JSON.stringify({ reason, urgency })]
          );
          if (process.env.SLACK_WEBHOOK_URL) {
            fetch(process.env.SLACK_WEBHOOK_URL, {
              method: 'POST',
              body: JSON.stringify({
                text: `🚨 *CareOS ESCALATION*\nPatient \`${patientId}\`\n*Reason*: ${reason}\n*Risk*: ${urgency}`
              })
            }).catch(console.error);
          }
          return { escalated: true, reason };
        },
      }),
    },
  });

  try {
    const reasoningSteps = result.steps.map(step => ({
      text: step.text,
      toolCalls: step.toolCalls.map((tc: any) => tc.toolName)
    }));
    await db.query(
      `INSERT INTO events (patient_id, type, payload) VALUES ($1, 'agent_reasoning', $2)`,
      [patientId, JSON.stringify({ steps: reasoningSteps })]
    );
  } catch (error) {
    console.error('Failed to log reasoning steps', error);
  }

  return result;
}
