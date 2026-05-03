'use client';

import { useEffect, useState } from 'react';

type Patient = {
  id: string;
  name: string;
  phone: string;
  workflow_step: string;
  risk_level: string;
  next_contact_at: string;
  discharge_summary?: string;
};

type Event = {
  id: string;
  patient_id: string;
  patient_name: string;
  type: string;
  payload: any;
  created_at: string;
};

export default function LifeSaverDashboard() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    try {
      const [patientsRes, eventsRes] = await Promise.all([
        fetch('/api/patients'),
        fetch('/api/events')
      ]);
      const patientsData = await patientsRes.json();
      const eventsData = await eventsRes.json();
      const pList = patientsData.patients || [];
      setPatients(pList);
      setEvents(eventsData.events || []);
      if (!selectedId && pList.length > 0) setSelectedId(pList[0].id);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 5000);
    return () => clearInterval(interval);
  }, []);

  const selectedPatient = patients.find(p => p.id === selectedId);
  const patientEvents = events
    .filter(e => e.patient_id === selectedId)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  if (loading) return <div className="loading-screen">LOADING LIFESAVER...</div>;

  return (
    <div className="dashboard-root">
      <nav className="top-nav">
        <div className="nav-left">
          <span className="brand">LifeSaver</span>
          <span className="divider">|</span>
          <span className="subtitle">Clinical Command Center</span>
        </div>
        <div className="nav-right">
          <div className="status-dot"></div>
          <span className="status-text">AGENT ACTIVE</span>
        </div>
      </nav>

      <div className="main-layout">
        <div className="registry-column">
          <div className="column-header">ACTIVE REGISTRY ({patients.length})</div>
          <div className="patient-list">
            {patients.map(p => (
              <button 
                key={p.id}
                onClick={() => setSelectedId(p.id)}
                className={`patient-card ${selectedId === p.id ? 'active' : ''}`}
              >
                <div className="card-top">
                  <div className={`indicator ${p.workflow_step === 'escalated' ? 'urgent' : ''}`}></div>
                  <div className="patient-info">
                    <div className="patient-name">{p.name}</div>
                    <div className="patient-phone">{p.phone}</div>
                  </div>
                </div>
                <div className="card-bottom">
                  <span className="step-badge">{p.workflow_step}</span>
                  <span className="time-ago">{p.risk_level === 'critical' ? 'IMMEDIATE' : 'Stable'}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="detail-column">
          <div className="detail-content">
            <div className="hero-section">
              <h1 className="hero-name">{selectedPatient?.name || '---'}</h1>
              <div className="hero-meta">
                <span>{selectedPatient?.phone}</span>
                <span className="risk-label">{selectedPatient?.risk_level} Risk</span>
              </div>
            </div>

            <div className="convo-container">
              <div className="convo-header">MANAGED CONVERSATION</div>
              <div className="convo-feed">
                {patientEvents.length === 0 && (
                  <div className="empty-state">Waiting for agent to initiate protocol...</div>
                )}
                {patientEvents.map(e => {
                  if (e.type === 'sms_sent') {
                    return (
                      <div key={e.id} className="chat-bubble agent">
                        <div className="bubble-label">AGENT OUTREACH</div>
                        <div className="bubble-content">{e.payload.message}</div>
                        <div className="bubble-time">{new Date(e.created_at).toLocaleTimeString()}</div>
                      </div>
                    );
                  }
                  if (e.type === 'sms_received') {
                    return (
                      <div key={e.id} className="chat-bubble patient">
                        <div className="bubble-label">PATIENT REPLY</div>
                        <div className="bubble-content">{e.payload.body}</div>
                        <div className="bubble-time">{new Date(e.created_at).toLocaleTimeString()}</div>
                      </div>
                    );
                  }
                  if (e.type === 'agent_reasoning') {
                    return (
                      <div key={e.id} className="reasoning-note">
                        <span className="note-icon">⚙</span>
                        {e.payload.steps?.[0]?.text || 'Agent analyzing patient state...'}
                      </div>
                    );
                  }
                  if (e.type === 'escalated') {
                    return (
                      <div key={e.id} className="alert-event urgent">
                        🚨 ESCALATED TO CLINICAL TEAM: {e.payload.reason}
                      </div>
                    );
                  }
                  return null;
                })}
              </div>
            </div>
          </div>

          <div className="action-footer">
            <button className="btn-primary">Take Over Conversation</button>
            <button className="btn-secondary">Escalate to Nurse</button>
          </div>
        </div>
      </div>

      <style jsx>{`
        .dashboard-root { background: #000; color: #fff; height: 100vh; display: flex; flex-direction: column; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
        .top-nav { height: 64px; border-bottom: 1px solid #222; display: flex; align-items: center; justify-content: space-between; padding: 0 32px; }
        .brand { font-weight: 800; font-size: 20px; letter-spacing: -0.04em; }
        .divider { color: #333; margin: 0 16px; }
        .subtitle { color: #555; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; }
        .nav-right { display: flex; align-items: center; gap: 8px; }
        .status-dot { width: 8px; height: 8px; border-radius: 50%; background: #10b981; box-shadow: 0 0 10px #10b981; }
        .status-text { font-size: 10px; font-weight: 800; color: #555; letter-spacing: 0.1em; }

        .main-layout { display: flex; flex: 1; overflow: hidden; }
        .registry-column { width: 380px; border-right: 1px solid #222; display: flex; flex-direction: column; }
        .column-header { padding: 16px 24px; font-size: 10px; font-weight: 800; color: #444; text-transform: uppercase; letter-spacing: 0.2em; border-bottom: 1px solid #222; background: #080808; }
        .patient-list { flex: 1; overflow-y: auto; }
        .patient-card { width: 100%; border: none; background: transparent; padding: 24px; text-align: left; cursor: pointer; border-bottom: 1px solid #111; transition: all 0.2s; }
        .patient-card.active { background: #0a0a0a; border-bottom: 1px solid #222; }
        .card-top { display: flex; gap: 16px; align-items: center; margin-bottom: 12px; }
        .indicator { width: 4px; height: 32px; background: #222; border-radius: 2px; }
        .indicator.urgent { background: #fff; box-shadow: 0 0 15px rgba(255,255,255,0.4); }
        .patient-name { font-size: 18px; font-weight: 700; color: #fff; }
        .patient-phone { font-size: 13px; color: #444; font-family: monospace; }
        .step-badge { font-size: 10px; font-weight: 800; color: #555; text-transform: uppercase; border: 1px solid #222; padding: 2px 8px; border-radius: 4px; }
        .time-ago { font-size: 11px; color: #333; font-weight: 600; }

        .detail-column { flex: 1; display: flex; flex-direction: column; background: #030303; }
        .detail-content { flex: 1; overflow-y: auto; padding: 64px; }
        .hero-section { margin-bottom: 48px; }
        .hero-name { font-size: 48px; font-weight: 800; letter-spacing: -0.05em; margin-bottom: 8px; }
        .hero-meta { display: flex; gap: 24px; color: #444; font-size: 14px; font-weight: 600; }
        .risk-label { text-transform: uppercase; letter-spacing: 0.1em; color: #666; }

        .convo-container { border: 1px solid #111; border-radius: 24px; background: #000; display: flex; flex-direction: column; }
        .convo-header { padding: 16px 24px; border-bottom: 1px solid #111; font-size: 10px; font-weight: 800; color: #333; text-transform: uppercase; letter-spacing: 0.2em; }
        .convo-feed { padding: 32px; display: flex; flex-direction: column; gap: 24px; }
        .empty-state { text-align: center; color: #222; font-style: italic; font-size: 14px; padding: 48px 0; }

        .chat-bubble { max-width: 80%; display: flex; flex-direction: column; gap: 4px; }
        .chat-bubble.agent { align-self: flex-start; }
        .chat-bubble.patient { align-self: flex-end; align-items: flex-end; }
        .bubble-label { font-size: 9px; font-weight: 800; color: #333; text-transform: uppercase; letter-spacing: 0.1em; }
        .bubble-content { padding: 16px 20px; border-radius: 16px; font-size: 14px; line-height: 1.5; font-weight: 500; }
        .agent .bubble-content { background: #111; color: #ddd; border: 1px solid #222; }
        .patient .bubble-content { background: #fff; color: #000; }
        .bubble-time { font-size: 10px; color: #222; margin-top: 4px; font-family: monospace; }

        .reasoning-note { background: #080808; border: 1px solid #111; padding: 16px 20px; border-radius: 12px; font-size: 12px; color: #444; font-style: italic; display: flex; gap: 12px; align-items: center; }
        .note-icon { color: #222; font-style: normal; }

        .alert-event { background: #7f1d1d20; border: 1px solid #7f1d1d50; color: #ef4444; padding: 16px; border-radius: 12px; text-align: center; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; }

        .action-footer { padding: 48px 64px; border-top: 1px solid #111; display: flex; flex-direction: column; gap: 12px; }
        .btn-primary { height: 56px; background: #fff; color: #000; border: none; border-radius: 12px; font-size: 14px; font-weight: 800; cursor: pointer; }
        .btn-secondary { height: 48px; background: transparent; color: #444; border: 1px solid #222; border-radius: 12px; font-size: 14px; font-weight: 600; cursor: pointer; }
        .loading-screen { background: #000; color: #fff; height: 100vh; display: flex; align-items: center; justify-content: center; font-weight: 900; letter-spacing: 0.2em; }
      `}</style>
    </div>
  );
}
