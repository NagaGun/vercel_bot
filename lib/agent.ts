import { generateText, tool } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import { db } from './db';
import { sendSMS } from './twilio';

export async function runFollowUpAgent(patientId: string, incomingMessage?: string) {
  // Pull last 3 events for minimal Demo memory context
  const historyQuery = await db.query(
    `SELECT type, payload FROM events WHERE patient_id = $1 ORDER BY id DESC LIMIT 3`,
    [patientId]
  );
  
  let historyContext = '';
  if (historyQuery.rows.length > 0) {
    historyContext = `\n\nRecent interaction history for context:\n` + 
      historyQuery.rows.reverse().map(r => `[${r.type}] ${JSON.stringify(r.payload)}`).join('\n');
  }

  const basePrompt = incomingMessage
    ? `Patient ID ${patientId} replied: "${incomingMessage}". Analyze and take appropriate action.`
    : `Time to send scheduled follow-up to patient ${patientId}. Look up their record and send the right message.`;

  const result = await generateText({
    model: anthropic('claude-sonnet-4-20250514'),
    maxSteps: 8,
    system: `You are CareOS, a clinical post-discharge follow-up agent.
Your job: contact patients, parse their responses, and escalate to nurses when there are danger signs.
Danger signs requiring IMMEDIATE escalation: chest pain, shortness of breath, can't breathe,
confusion, fever above 103, surgical site opening, heavy bleeding.
Always be warm, clear, and brief in SMS messages. Never diagnose. Always escalate when uncertain.`,

    prompt: basePrompt + historyContext,

    tools: {
      lookupPatient: tool({
        description: 'Get patient info and current workflow step',
        parameters: z.object({ patientId: z.string() }),
        execute: async ({ patientId }) => {
          const patient = await db.query(
            'SELECT * FROM patients WHERE id = $1', [patientId]
          );
          return patient.rows[0];
        },
      }),

      sendSMSToPatient: tool({
        description: 'Send an SMS message to the patient',
        parameters: z.object({
          patientId: z.string(),
          message: z.string().max(320),
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
          patientId: z.string(),
          nextStep: z.enum(['day_3', 'day_7', 'day_30', 'complete']),
        }),
        execute: async ({ patientId, nextStep }) => {
          const delays: Record<string, number> = { day_3: 3, day_7: 7, day_30: 30, complete: 999 };
          const nextContactAt = new Date();
          nextContactAt.setDate(nextContactAt.getDate() + (delays[nextStep] - 1));

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
          patientId: z.string(),
          reason: z.string(),
          urgency: z.enum(['high', 'critical']),
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
          // Slack Ping via Agent 
          if (process.env.SLACK_WEBHOOK_URL) {
            try {
              await fetch(process.env.SLACK_WEBHOOK_URL, {
                method: 'POST',
                body: JSON.stringify({
                  text: `🚨 *URGENT AGENT ESCALATION*\nPatient ID \`${patientId}\` triggered a high-risk condition. \n*Reason*: ${reason}\n*Risk*: ${urgency}`
                })
              });
            } catch (e) {
               console.error('Failed Slack ping from agent', e);
            }
          }
          return { escalated: true, reason };
        },
      }),
    },
  });

  try {
    const reasoningSteps = result.steps.map(step => ({
      text: step.text,
      toolCalls: step.toolCalls.map(tc => tc.toolName)
    }));
    await db.query(
      `INSERT INTO events (patient_id, type, payload) VALUES ($1, 'agent_reasoning', $2)`,
      [patientId, JSON.stringify({ steps: reasoningSteps })]
    );
  } catch (error) {
    console.error("Failed to log reasoning steps", error);
  }

  return result;
}
