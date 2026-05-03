import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  const body = await req.formData();

  const signature = req.headers.get('x-twilio-signature') ?? '';
  const valid = twilio.validateRequest(
    process.env.TWILIO_AUTH_TOKEN!,
    signature,
    process.env.TWILIO_STATUS_WEBHOOK_URL ?? `${process.env.TWILIO_WEBHOOK_URL?.replace('/sms', '/twilio-status')}`,
    Object.fromEntries(body)
  );
  if (!valid) return new NextResponse('Forbidden', { status: 403 });

  const messageSid = body.get('MessageSid') as string;
  const messageStatus = body.get('MessageStatus') as string;
  const to = body.get('To') as string;

  if (!messageSid || !to) return new NextResponse('OK', { status: 200 });

  const patientRes = await db.query(`SELECT id FROM patients WHERE phone=$1`, [to]);
  if (!patientRes.rows.length) return new NextResponse('OK', { status: 200 });
  const patientId = patientRes.rows[0].id;

  if (messageStatus === 'delivered') {
    await db.query(
      `INSERT INTO events (patient_id, type, payload) VALUES ($1, 'sms_delivered', $2)`,
      [patientId, JSON.stringify({ messageSid, status: 'delivered' })]
    );
  }

  if (messageStatus === 'failed' || messageStatus === 'undelivered') {
    // Auto-escalate on delivery failure — nurse needs to call manually
    await db.query(
      `UPDATE patients SET workflow_step='escalated', risk_level='high' WHERE id=$1`,
      [patientId]
    );
    await db.query(
      `INSERT INTO events (patient_id, type, payload) VALUES ($1, 'escalated', $2)`,
      [patientId, JSON.stringify({ reason: 'sms_delivery_failed', urgency: 'high', messageSid })]
    );

    if (process.env.SLACK_WEBHOOK_URL) {
      fetch(process.env.SLACK_WEBHOOK_URL, {
        method: 'POST',
        body: JSON.stringify({
          text: `🚨 *CareOS* SMS delivery failed for patient \`${patientId}\` (${to}). Manual follow-up required.`
        })
      }).catch(console.error);
    }
  }

  return new NextResponse('OK', { status: 200 });
}
