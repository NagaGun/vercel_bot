const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function seedConvo() {
  // Dynamically find Jane Smith
  const patientRes = await pool.query("SELECT id FROM patients WHERE name = 'Jane Smith' LIMIT 1");
  const patientId = patientRes.rows[0]?.id;

  if (!patientId) {
    console.error("Jane Smith not found. Please seed patients first.");
    await pool.end();
    return;
  }
  
  // Clear old events for this patient to make it clean
  await pool.query('DELETE FROM events WHERE patient_id = $1', [patientId]);

  const events = [
    {
      type: 'sms_sent',
      payload: { message: "Hi Jane, this is CareOS. We're checking in on your first day post-discharge. How are you feeling today?" },
      created_at: new Date(Date.now() - 3600000).toISOString() // 1 hour ago
    },
    {
      type: 'agent_reasoning',
      payload: { steps: [{ text: "Initiated day-1 protocol. Waiting for Jane's response to establish baseline vitals." }] },
      created_at: new Date(Date.now() - 3590000).toISOString()
    },
    {
      type: 'sms_received',
      payload: { body: "I'm not feeling great. I have a sharp pain in my chest when I take deep breaths, and my left leg is quite swollen and painful." },
      created_at: new Date(Date.now() - 1800000).toISOString() // 30 min ago
    },
    {
      type: 'agent_reasoning',
      payload: { steps: [{ text: "CRITICAL: Jane is reporting pleuritic chest pain and unilateral leg swelling. These are classic indicators for DVT/PE (Deep Vein Thrombosis leading to Pulmonary Embolism). This significantly increases her mortality risk. Initiating immediate emergency escalation." }] },
      created_at: new Date(Date.now() - 1790000).toISOString()
    },
    {
      type: 'escalated',
      payload: { reason: "Jane reported pleuritic chest pain and unilateral leg swelling (DVT/PE risk).", urgency: "critical" },
      created_at: new Date(Date.now() - 1780000).toISOString()
    },
    {
      type: 'sms_sent',
      payload: { message: "Jane, I've notified our clinical team immediately about your chest pain and leg swelling. A nurse is being paged now. Please sit down, try to breathe slowly, and do not walk around." },
      created_at: new Date(Date.now() - 1770000).toISOString()
    }
  ];

  for (const event of events) {
    await pool.query(
      'INSERT INTO events (patient_id, type, payload, created_at) VALUES ($1, $2, $3, $4)',
      [patientId, event.type, JSON.stringify(event.payload), event.created_at]
    );
  }

  // Update Jane Smith to Escalated
  await pool.query(
    "UPDATE patients SET workflow_step = 'escalated', risk_level = 'critical' WHERE id = $1",
    [patientId]
  );

  console.log('Seeded Jane Smith convo successfully.');
  await pool.end();
}

seedConvo();
