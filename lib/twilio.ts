import twilio from 'twilio';
import { kv } from '@vercel/kv';

export const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

export async function sendSMS(to: string, body: string) {
  const result = await twilioClient.messages.create({
    body,
    to,
    from: process.env.TWILIO_PHONE_NUMBER,
    statusCallback: process.env.TWILIO_STATUS_WEBHOOK_URL,
  });

  // Keep body for 48h to allow QStash delay retries if it fails
  if (result.sid) {
    await kv.set(`msg_body:${result.sid}`, body, { ex: 86400 * 2 });
  }

  return result;
}
