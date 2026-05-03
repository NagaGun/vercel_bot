import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';
import { db } from '@/lib/db';
import { runFollowUpAgent } from '@/lib/agent';

export async function POST(req: NextRequest) {
  // Naga's formData approach is more correct for Twilio's content-type
  const body = await req.formData();

  // 1. Signature validation
  const signature = req.headers.get('x-twilio-signature') ?? '';
  const valid = twilio.validateRequest(
    process.env.TWILIO_AUTH_TOKEN!,
    signature,
    process.env.TWILIO_WEBHOOK_URL!,
    Object.fromEntries(body)
  );
  if (!valid) return new NextResponse('Forbidden', { status: 403 });

  // 2. STOP / HELP keyword guard (from naga — more complete list)
  const messageBody = (body.get('Body') as string)?.trim().toUpperCase() ?? '';
  if (['STOP', 'UNSTOP', 'HELP', 'START', 'CANCEL', 'END'].includes(messageBody)) {
    const rawFrom = (body.get('From') as string) ?? '';
    await db.query(
      `UPDATE patients SET workflow_step='complete', consent_given=false WHERE phone=$1`,
      [rawFrom]
    ).catch(() => {}); // silent — patient may not exist
    return new NextResponse('<?xml version="1.0"?><Response/>', {
      headers: { 'Content-Type': 'text/xml' }
    });
  }

  // 3. Phone normalization
  const from = (body.get('From') as string) ?? '';
  const message = (body.get('Body') as string)?.trim() ?? '';

  // 4. Look up patient
  const patient = await db.query(
    `SELECT id FROM patients WHERE phone=$1 AND workflow_step NOT IN ('complete','escalated')`,
    [from]
  );
  if (!patient.rows.length) {
    return new NextResponse('<?xml version="1.0"?><Response/>', {
      headers: { 'Content-Type': 'text/xml' }
    });
  }

  // 5. Fire agent asynchronously — Twilio needs a fast reply
  runFollowUpAgent(patient.rows[0].id, message).catch(console.error);

  return new NextResponse('<?xml version="1.0"?><Response/>', {
    headers: { 'Content-Type': 'text/xml' }
  });
}
