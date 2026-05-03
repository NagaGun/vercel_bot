const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function seedConvo() {
  const patientId = '04e6f38c-f11c-40c9-8650-d3452f6599c4'; // John Doe
  
  // Clear old events for this patient to make it clean
  await pool.query('DELETE FROM events WHERE patient_id = $1', [patientId]);

  const events = [
    {
      type: 'sms_sent',
      payload: { message: "Hi John, this is CareOS. We're checking in on your first day post-discharge. How are you feeling today?" },
      created_at: new Date(Date.now() - 3600000).toISOString() // 1 hour ago
    },
    {
      type: 'agent_reasoning',
      payload: { steps: [{ text: "Initiated day-1 protocol. Waiting for patient response to establish baseline vitals." }] },
      created_at: new Date(Date.now() - 3590000).toISOString()
    },
    {
      type: 'sms_received',
      payload: { body: "I'm okay, but my chest feels a little tight when I breathe." },
      created_at: new Date(Date.now() - 1800000).toISOString() // 30 min ago
    },
    {
      type: 'agent_reasoning',
      payload: { steps: [{ text: "Critical indicator detected: 'chest tightness'. This is a high-risk symptom for post-op patients. Initiating immediate escalation protocol." }] },
      created_at: new Date(Date.now() - 1790000).toISOString()
    },
    {
      type: 'escalated',
      payload: { reason: "Patient reported chest tightness on Day 1.", urgency: "critical" },
      created_at: new Date(Date.now() - 1780000).toISOString()
    },
    {
      type: 'sms_sent',
      payload: { message: "John, I've notified our clinical team about your chest tightness. A nurse will be calling you shortly. Please sit down and try to relax." },
      created_at: new Date(Date.now() - 1770000).toISOString()
    }
  ];

  for (const event of events) {
    await pool.query(
      'INSERT INTO events (patient_id, type, payload, created_at) VALUES ($1, $2, $3, $4)',
      [patientId, event.type, JSON.stringify(event.payload), event.created_at]
    );
  }

  // Update John Doe to Escalated
  await pool.query(
    "UPDATE patients SET workflow_step = 'escalated', risk_level = 'critical' WHERE id = $1",
    [patientId]
  );

  console.log('Seeded John Doe convo successfully.');
  await pool.end();
}

seedConvo();
