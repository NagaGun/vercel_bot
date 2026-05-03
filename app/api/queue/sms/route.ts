import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { runFollowUpAgent } from '@/lib/agent';

import { Receiver } from '@upstash/qstash';

export async function POST(req: NextRequest) {
  // 1. Authenticate QStash origin via cryptographically signed header
  const signature = req.headers.get('Upstash-Signature');
  if (!signature) return new NextResponse('Unauthorized', { status: 401 });
  
  const receiver = new Receiver({
    currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
    nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
  });

  const bodyText = await req.text();
  try {
    const isValid = await receiver.verify({ signature, body: bodyText });
    if (!isValid) throw new Error('Invalid signature');
  } catch (err) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const { phone, messageBody } = JSON.parse(bodyText);

  // 2. Query patient ID via E.164 phone number
  const patient = await db.query(
    `SELECT id FROM patients WHERE phone=$1 AND workflow_step NOT IN ('complete','escalated')`,
    [phone]
  );

  if (!patient.rows.length) {
    console.log(`No active patient found for phone ${phone}`);
    return new NextResponse('OK', { status: 200 }); // Return 200 so QStash doesn't keep retrying
  }

  const patientId = patient.rows[0].id;

  // MMS fetching (Deferred for later PR)
  // if (mediaUrls && mediaUrls.length > 0) { ... fetch basic auth ... base64 }

  // 3. Fire agent asynchronously — this runs within internal timeout constraints
  try {
    await runFollowUpAgent(patientId, messageBody);
  } catch (error) {
    console.error('Agent execution failed via QStash:', error);
    return new NextResponse('Internal Error', { status: 500 }); // 500 triggers QStash retry
  }

  return new NextResponse('OK', { status: 200 });
}
