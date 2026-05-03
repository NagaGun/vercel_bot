import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';
import { kv } from '@vercel/kv';

export async function POST(req: NextRequest) {
  // Twilio sends application/x-www-form-urlencoded
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

  // 2. STOP / HELP keyword guard
  const messageBody = (body.get('Body') as string)?.trim().toUpperCase() ?? '';
  if (['STOP', 'UNSTOP', 'HELP', 'START', 'CANCEL', 'END'].includes(messageBody)) {
    return new NextResponse('<?xml version="1.0"?><Response/>', { headers: { 'Content-Type': 'text/xml' } });
  }

  // 3. E.164 phone normalization
  const rawFrom = (body.get('From') as string) ?? '';
  const phone = rawFrom.replace(/\s+/g, '').replace(/[^\d+]/g, ''); // Ensure leading +

  // 4. Idempotency check (Vercel KV)
  const smsSid = body.get('SmsSid') as string;
  if (!smsSid) {
    return new NextResponse('<?xml version="1.0"?><Response/>', { headers: { 'Content-Type': 'text/xml' } });
  }
  
  // Atomic set with 24h TTL
  const isNew = await kv.set(`processed:${smsSid}`, 'true', { nx: true, ex: 86400 });
  if (!isNew) {
    return new NextResponse('<?xml version="1.0"?><Response/>', { headers: { 'Content-Type': 'text/xml' } });
  }

  // 5. Gather MMS (Deferred for now, but plumbing added)
  const mediaUrls: string[] = [];
  const numMedia = parseInt((body.get('NumMedia') as string) ?? '0', 10);
  for (let i = 0; i < numMedia; i++) {
    const url = body.get(`MediaUrl${i}`) as string;
    if (url) mediaUrls.push(url);
  }

  // 6. Queue via QStash, return 200 immediately
  if (process.env.QSTASH_TOKEN) {
    const { Client } = await import('@upstash/qstash');
    const qstash = new Client({ token: process.env.QSTASH_TOKEN });
    await qstash.publishJSON({
      url: `${process.env.APP_BASE_URL}/api/queue/sms`,
      body: { phone, messageBody: body.get('Body'), mediaUrls, smsSid },
    });
  }

  return new NextResponse('<?xml version="1.0"?><Response/>', { headers: { 'Content-Type': 'text/xml' } });
}
