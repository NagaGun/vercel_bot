import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';
import { db } from '@/lib/db';
// Removed kv
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

  // Rate limiting removed for hackathon simplicity

  // Fire agent asynchronously — Twilio needs a fast reply
  runFollowUpAgent(patient.rows[0].id, message).catch(console.error);

  return new NextResponse('<?xml version="1.0"?><Response/>', {
    headers: { 'Content-Type': 'text/xml' }
  });
}
