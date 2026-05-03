import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Dynamically find Jane Smith (since her ID changes on re-seed)
    const patientRes = await db.query("SELECT id FROM patients WHERE name = 'Jane Smith' LIMIT 1");
    const patientId = patientRes.rows[0]?.id;

    if (!patientId) {
      return NextResponse.json({ ok: false, error: "Jane Smith not found. Please seed patients first." }, { status: 404 });
    }
    
    // Clear old events
    await db.query('DELETE FROM events WHERE patient_id = $1', [patientId]);

    const events = [
      {
        type: 'sms_sent',
        payload: { message: "Hi Jane, this is CareOS. We're checking in on your first day post-discharge. How are you feeling today?" },
        created_at: new Date(Date.now() - 3600000)
      },
      {
        type: 'agent_reasoning',
        payload: { steps: [{ text: "Initiated day-1 protocol. Waiting for Jane's response to establish baseline vitals." }] },
        created_at: new Date(Date.now() - 3590000)
      },
      {
        type: 'sms_received',
        payload: { body: "I'm not feeling great. I have a sharp pain in my chest when I take deep breaths, and my left leg is quite swollen and painful." },
        created_at: new Date(Date.now() - 1800000)
      },
      {
        type: 'agent_reasoning',
        payload: { steps: [{ text: "CRITICAL: Jane is reporting pleuritic chest pain and unilateral leg swelling. These are classic indicators for DVT/PE (Deep Vein Thrombosis leading to Pulmonary Embolism). This significantly increases her mortality risk. Initiating immediate emergency escalation." }] },
        created_at: new Date(Date.now() - 1790000)
      },
      {
        type: 'escalated',
        payload: { reason: "Jane reported pleuritic chest pain and unilateral leg swelling (DVT/PE risk).", urgency: "critical" },
        created_at: new Date(Date.now() - 1780000)
      },
      {
        type: 'sms_sent',
        payload: { message: "Jane, I've notified our clinical team immediately about your chest pain and leg swelling. A nurse is being paged now. Please sit down, try to breathe slowly, and do not walk around." },
        created_at: new Date(Date.now() - 1770000)
      }
    ];

    for (const event of events) {
      await db.query(
        'INSERT INTO events (patient_id, type, payload, created_at) VALUES ($1, $2, $3, $4)',
        [patientId, event.type, JSON.stringify(event.payload), event.created_at]
      );
    }

    await db.query(
      "UPDATE patients SET workflow_step = 'escalated', risk_level = 'critical' WHERE id = $1",
      [patientId]
    );

    return NextResponse.json({ ok: true, message: "Jane Smith convo seeded with critical risk escalation." });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
