import twilio from 'twilio';

export const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

export async function sendSMS(to: string, body: string) {
  if (process.env.MOCK_SMS === 'true') {
    console.log('MOCK SMS TO:', to, 'BODY:', body);
    return { sid: 'MOCK_SID_' + Math.random().toString(36).substring(7) };
  }

  const message = await twilioClient.messages.create({
    body,
    to,
    from: process.env.TWILIO_PHONE_NUMBER,
  });
  console.log('Twilio Message Sent, SID:', message.sid);
  return message;
}
