import twilio from 'twilio';

export const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

export async function sendSMS(to: string, body: string) {
  const message = await twilioClient.messages.create({
    body,
    to,
    from: process.env.TWILIO_PHONE_NUMBER,
  });
  console.log('Twilio Message Sent, SID:', message.sid);
  return message;
}
