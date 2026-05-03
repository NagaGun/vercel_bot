import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { runFollowUpAgent } from '@/lib/agent';

export const maxDuration = 60; // 1 min, Free tier limit

export async function GET(req: Request) {
  // Verify this is actually from Vercel Cron or manual demo trigger via header
  const authHeader = req.headers.get('Authorization');
  const customHeader = req.headers.get('x-cron-secret');
  const cronSecret = process.env.CRON_SECRET || 'careos-cron';
  
  if (
    authHeader !== `Bearer ${cronSecret}` && 
    customHeader !== cronSecret
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

  return NextResponse.json({ 
    processed: results.length,
    results: results.map((r, i) => ({
      patient: due.rows[i]?.id,
      status: r.status,
      value: r.status === 'fulfilled' ? r.value : undefined,
      error: r.status === 'rejected' ? String(r.reason) : undefined,
    }))
  });
}
