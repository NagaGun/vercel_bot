import { generateText, tool, stepCountIs, zodSchema } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import { db } from './db';
import { sendSMS } from './twilio';

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
Danger signs requiring IMMEDIATE escalation: chest pain, shortness of breath, can't breathe,
confusion, fever above 103, surgical site opening, heavy bleeding.
Always be warm, clear, and brief in SMS messages. Never diagnose. Always escalate when uncertain.`,

    prompt: basePrompt + historyContext,

    tools: {
      lookupPatient: tool({
        description: 'Get patient info, current workflow step, and discharge summary. ALWAYS call this first.',
        parameters: zodSchema(z.object({ patientId: z.string() })),
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
        parameters: zodSchema(z.object({
          patientId: z.string(),
          message: z.string().max(320),
        })),
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
        parameters: zodSchema(z.object({
          patientId: z.string(),
          nextStep: z.enum(['day_3', 'day_7', 'day_30', 'complete']),
        })),
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
        parameters: zodSchema(z.object({
          patientId: z.string(),
          reason: z.string(),
          urgency: z.enum(['high', 'critical']),
        })),
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
