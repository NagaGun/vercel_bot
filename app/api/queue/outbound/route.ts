import { NextRequest, NextResponse } from 'next/server';
import { Receiver } from '@upstash/qstash';
import { sendSMS } from '@/lib/twilio';

export async function POST(req: NextRequest) {
  // 1. Verify QStash Origin
  const signature = req.headers.get('upstash-signature');
  if (!signature) return new NextResponse('Unauthorized', { status: 401 });

  const receiver = new Receiver({
    currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
    nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
  });

  const bodyText = await req.text();
  try {
    const isValid = await receiver.verify({ signature, body: bodyText });
    if (!isValid) throw new Error('Invalid');
  } catch (err) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const { to, body } = JSON.parse(bodyText);

  if (!to || !body) {
    return new NextResponse('Missing parameters', { status: 400 });
  }

  console.log(`QStash Retry: Dispatching SMS to ${to}`);
  try {
    await sendSMS(to, body);
  } catch (error) {
    console.error('Failed downstream outbound retry', error);
    return new NextResponse('Internal Error', { status: 500 });
  }

  return new NextResponse('OK', { status: 200 });
}
