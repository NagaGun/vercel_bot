// test-sms.js
import crypto from 'crypto';

// Build a mock Twilio POST application/x-www-form-urlencoded
const bodyParams = new URLSearchParams({
  ToCountry: 'US',
  ToState: 'CA',
  SmsMessageSid: 'SM123MOCK456',
  NumMedia: '0',
  ToCity: 'SAN FRANCISCO',
  FromZip: '94105',
  SmsSid: 'SM123MOCK456',
  FromState: 'CA',
  SmsStatus: 'received',
  FromCity: 'SAN FRANCISCO',
  Body: 'Help me, I am dizzy',
  FromCountry: 'US',
  To: '+1234567890',
  ToZip: '94105',
  NumSegments: '1',
  MessageSid: 'SM123MOCK456',
  AccountSid: 'AC123MOCK456',
  From: '+1987654321',
  ApiVersion: '2010-04-01'
});

const url = 'http://localhost:3000/api/webhooks/sms';
const authToken = 'MOCK_TOKEN'; // Twilio SDK doesn't check if token matches any real one locally if we sign it properly ourselves using this dummy token.

// Sort keys and build the signature properly
let dataToSign = url;
const sortedKeys = Array.from(bodyParams.keys()).sort();
for (const key of sortedKeys) {
  dataToSign += key + bodyParams.get(key);
}

const signature = crypto
  .createHmac('sha1', authToken)
  .update(dataToSign)
  .digest('base64');

async function test() {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Twilio-Signature': signature
      },
      body: bodyParams.toString()
    });
    
    const text = await res.text();
    console.log('Status:', res.status);
    console.log('Response:', text);
  } catch (err) {
    console.error('Fetch Error:', err);
  }
}

test();
