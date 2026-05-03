import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const events = await db.query(`
      SELECT e.*, p.name as patient_name 
      FROM events e 
      JOIN patients p ON e.patient_id = p.id
      ORDER BY e.created_at DESC 
      LIMIT 50
    `);
    return NextResponse.json({ events: events.rows });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
