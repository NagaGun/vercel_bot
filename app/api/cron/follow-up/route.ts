import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { kv } from '@/lib/kv';
import { runFollowUpAgent } from '@/lib/agent';

export const maxDuration = 60; // 1 min, Free tier limit

export async function GET(req: Request) {
  // Verify this is actually from Vercel Cron
  if (req.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const due = await db.query(`
    SELECT id FROM patients
    WHERE next_contact_at <= NOW()
    AND workflow_step NOT IN ('complete', 'escalated')
    LIMIT 5
  `);

  const results = await Promise.allSettled(
    due.rows.map(async ({ id }) => {
      // Idempotency: skip if already being processed
      const lock = await kv.set(`lock:${id}`, '1', { nx: true, ex: 600 });
      if (!lock) return { skipped: id };

      try {
        await runFollowUpAgent(id);
        return { ok: id };
      } finally {
        await kv.del(`lock:${id}`);
      }
    })
  );

  return NextResponse.json({ processed: results.length });
}
