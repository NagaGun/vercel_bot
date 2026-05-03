import { generateText, tool, stepCountIs } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import { db } from './db';
import { sendSMS } from './twilio';

const nvidia = createOpenAI({
  baseURL: 'https://integrate.api.nvidia.com/v1',
  apiKey: process.env.NVIDIA_API_KEY,
});

export async function runFollowUpAgent(patientId: string, incomingMessage?: string) {
  const result = await generateText({
    model: nvidia('google/gemma-3n-e4b-it'),
    stopWhen: stepCountIs(8),
    system: `You are CareOS, a clinical post-discharge follow-up agent.
Your job: contact patients, parse their responses, and escalate to nurses when there are danger signs.
Danger signs requiring IMMEDIATE escalation: chest pain, shortness of breath, can't breathe,
confusion, fever above 103, surgical site opening, heavy bleeding.
Always be warm, clear, and brief in SMS messages. Never diagnose. Always escalate when uncertain.`,

    prompt: incomingMessage
      ? `Patient ID ${patientId} replied: "${incomingMessage}". Analyze and take appropriate action.`
      : `Time to send scheduled follow-up to patient ${patientId}. Look up their record and send the right message.`,

    tools: {
      lookupPatient: tool({
        description: 'Get patient info and current workflow step',
        parameters: z.object({ patientId: z.string() }),
        // @ts-ignore
        execute: async ({ patientId }: { patientId: string }) => {
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
        // @ts-ignore
        execute: async ({ patientId, message }: { patientId: string, message: string }) => {
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
        // @ts-ignore
        execute: async ({ patientId, nextStep }: { patientId: string, nextStep: 'day_3'|'day_7'|'day_30'|'complete' }) => {
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
        // @ts-ignore
        execute: async ({ patientId, reason, urgency }: { patientId: string, reason: string, urgency: 'high'|'critical' }) => {
          await db.query(
            `UPDATE patients SET workflow_step='escalated', risk_level=$1 WHERE id=$2`,
            [urgency, patientId]
          );
          await db.query(
            `INSERT INTO events (patient_id, type, payload) VALUES ($1, 'escalated', $2)`,
            [patientId, JSON.stringify({ reason, urgency })]
          );
          // In prod: trigger Slack/pager/email to on-call nurse
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
