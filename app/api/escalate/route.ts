import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const { patientId } = await req.json();

    if (!patientId) {
      return NextResponse.json({ error: 'Patient ID required' }, { status: 400 });
    }

    // Acknowledge escalation: move to complete (or another state as desired)
    await db.query(`
      UPDATE patients 
      SET workflow_step = 'complete', risk_level = 'normal'
      WHERE id = $1
    `, [patientId]);

    await db.query(`
      INSERT INTO events (patient_id, type, payload) 
      VALUES ($1, 'escalation_acknowledged', '{}')
    `, [patientId]);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to escalate' }, { status: 500 });
  }
}
