import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { runFollowUpAgent } from '@/lib/agent';

export const maxDuration = 60; // 1 min, Free tier limit

export async function GET(req: Request) {
  // Verify this is actually from Vercel Cron or manual demo trigger via header
  const authHeader = req.headers.get('Authorization');
  const customHeader = req.headers.get('x-cron-secret');
  
  if (
    authHeader !== `Bearer ${process.env.CRON_SECRET}` && 
    customHeader !== process.env.CRON_SECRET
  ) {
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
      try {
        await runFollowUpAgent(id);
        return { ok: id };
      } catch (err) {
        console.error("Agent error for", id, err);
        return { error: id };
      }
    })
  );

  return NextResponse.json({ processed: results.length });
}
