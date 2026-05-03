import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    if (process.env.NODE_ENV === 'production' && req.headers.get('x-demo-secret') !== (process.env.DEMO_SECRET || 'careos-demo')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const demoPhone = body.demoPhone || '+12345678900'; // Override with your real Twilio test number via API client

    // 1. Create tables
    await db.query(`
      CREATE TABLE IF NOT EXISTS patients (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        phone TEXT NOT NULL,
        name TEXT NOT NULL,
        discharge_date TIMESTAMPTZ NOT NULL,
        medications JSONB,
        consent_given BOOLEAN DEFAULT FALSE,
        workflow_step TEXT DEFAULT 'day_1',  -- day_1 | day_3 | day_7 | day_30 | complete | escalated
        next_contact_at TIMESTAMPTZ NOT NULL,
        last_response TEXT,
        risk_level TEXT DEFAULT 'normal',    -- normal | elevated | critical
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID REFERENCES patients(id),
        type TEXT,
        payload JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_patients_next_contact ON patients(next_contact_at)
      WHERE workflow_step NOT IN ('complete', 'escalated');
    `);

    // 2. Clear existing (for clean demo)
    await db.query('TRUNCATE patients CASCADE');

    // 3. Seed demo data
    const now = new Date();
    const past = new Date(now.getTime() - 10000); // 10 seconds ago so cron picks it up immediately

    await db.query(`
      INSERT INTO patients (name, phone, discharge_date, consent_given, workflow_step, next_contact_at)
      VALUES 
        ('John Doe', $1, NOW(), TRUE, 'day_1', $2),
        ('Jane Smith', '+15555550002', NOW(), TRUE, 'day_3', $2),
        ('Bob Johnson', '+15555550003', NOW(), TRUE, 'day_7', $2)
    `, [demoPhone, past.toISOString()]);

    return NextResponse.json({ success: true, message: 'Database seeded for demo.' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const patients = await db.query('SELECT * FROM patients ORDER BY created_at DESC');
    return NextResponse.json({ patients: patients.rows });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
