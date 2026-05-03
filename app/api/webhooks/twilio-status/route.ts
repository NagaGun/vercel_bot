import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';
import { kv } from '@vercel/kv';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  const body = await req.formData();
  
  // 1. HMAC-SHA1 signature validation
  const signature = req.headers.get('x-twilio-signature') ?? '';
  const valid = twilio.validateRequest(
    process.env.TWILIO_AUTH_TOKEN!,
    signature,
    process.env.TWILIO_STATUS_WEBHOOK_URL!,
    Object.fromEntries(body)
  );
  if (!valid) return new NextResponse('Forbidden', { status: 403 });

  const messageSid = body.get('MessageSid') as string;
  const messageStatus = body.get('MessageStatus') as string;
  const to = body.get('To') as string; // Patient phone

  if (!messageSid) return new NextResponse('OK', { status: 200 });

  // 2. Idempotency (Vercel KV)
  const isNew = await kv.set(`status_processed:${messageSid}:${messageStatus}`, 'true', { nx: true, ex: 86400 });
  if (!isNew) {
    return new NextResponse('OK', { status: 200 });
  }

  // 3. Evaluate Status & Retry Logic
  if (messageStatus === 'delivered') {
    // Log success
    const patientOpts = await db.query(`SELECT id FROM patients WHERE phone=$1`, [to]);
    if (patientOpts.rows.length) {
      await db.query(
        `INSERT INTO events (patient_id, type, payload) VALUES ($1, 'sms_delivered', $2)`,
        [patientOpts.rows[0].id, JSON.stringify({ messageSid, status: 'delivered' })]
      );
    }
    return new NextResponse('OK', { status: 200 });
  }

  if (messageStatus === 'failed' || messageStatus === 'undelivered') {
    const patientOpts = await db.query(`SELECT id FROM patients WHERE phone=$1`, [to]);
    if (!patientOpts.rows.length) return new NextResponse('OK', { status: 200 });
    const patientId = patientOpts.rows[0].id;

    // Increment failure count securely
    const failKey = `failures:${patientId}:${messageSid}`;
    const failCount = await kv.incr(failKey);
    
    if (failCount === 1) {
      // 1st Strike -> QStash delay retry
      await kv.expire(failKey, 86400 * 2); // 48h reset to cover retry spans
      
      const originalText = await kv.get(`msg_body:${messageSid}`);
      if (originalText && process.env.QSTASH_TOKEN) {
        const { Client } = await import('@upstash/qstash');
        const queueClient = new Client({ token: process.env.QSTASH_TOKEN });
        
        await queueClient.publishJSON({
          url: `${process.env.APP_BASE_URL}/api/queue/outbound`,
          body: { to, body: originalText },
          delay: '30s', // 30 seconds for demo
        });
      }
    } else if (failCount >= 2) {
      // 2nd Strike -> Escalate
      await db.query(
        `UPDATE patients SET workflow_step='escalated', risk_level='high' WHERE id=$1`,
        [patientId]
      );
      await db.query(
        `INSERT INTO events (patient_id, type, payload) VALUES ($1, 'escalated', $2)`,
        [patientId, JSON.stringify({ reason: 'delivery_failed_twice', urgency: 'high' })]
      );

      // Slack Escalation Ping (Priority 1)
      if (process.env.SLACK_WEBHOOK_URL) {
        try {
          await fetch(process.env.SLACK_WEBHOOK_URL, {
            method: 'POST',
            body: JSON.stringify({
              text: `🚨 *URGENT ESCALATION*\nPatient ID \`${patientId}\` (${to}) is unreachable after multiple SMS retries. Manual nurse intervention required immediately.`
            })
          });
        } catch (e) {
          console.error('Failed to dispatch Slack ping', e);
        }
      }
    }
  }

  return new NextResponse('OK', { status: 200 });
}
