import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';
import { db } from '@/lib/db';
import { kv } from '@/lib/kv';
import { runFollowUpAgent } from '@/lib/agent';

export async function POST(req: NextRequest) {
  const body = await req.text();

  // Validate it's actually Twilio — this is non-negotiable
  const signature = req.headers.get('X-Twilio-Signature') ?? '';
  const valid = twilio.validateRequest(
    process.env.TWILIO_AUTH_TOKEN!,
    signature,
    process.env.TWILIO_WEBHOOK_URL!,
    Object.fromEntries(new URLSearchParams(body))
  );
  if (!valid) return new NextResponse('Forbidden', { status: 403 });

  const params = new URLSearchParams(body);
  const from = params.get('From')!;
  const message = params.get('Body')!.trim();

  // STOP handling — must honor immediately
  if (message.toUpperCase() === 'STOP') {
    await db.query(`UPDATE patients SET workflow_step='complete', consent_given=false WHERE phone=$1`, [from]);
    return new NextResponse('<?xml version="1.0"?><Response/>', {
      headers: { 'Content-Type': 'text/xml' }
    });
  }

  const patient = await db.query(
    `SELECT id FROM patients WHERE phone=$1 AND workflow_step NOT IN ('complete','escalated')`,
    [from]
  );
  if (!patient.rows.length) return new NextResponse('<?xml version="1.0"?><Response/>', {
    headers: { 'Content-Type': 'text/xml' }
  });

  // Rate limit: max 10 inbound per patient per hour
  const key = `rate:sms:${patient.rows[0].id}`;
  const count = await kv.incr(key);
  if (count === 1) await kv.expire(key, 3600);
  if (count > 10) return new NextResponse('<?xml version="1.0"?><Response/>', {
    headers: { 'Content-Type': 'text/xml' }
  });

  // Fire agent asynchronously — Twilio needs a fast reply
  runFollowUpAgent(patient.rows[0].id, message).catch(console.error);

  return new NextResponse('<?xml version="1.0"?><Response/>', {
    headers: { 'Content-Type': 'text/xml' }
  });
}
