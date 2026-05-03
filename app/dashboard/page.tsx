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
  const patientEvents = events.filter(e => e.patient_id === selectedId).slice(0, 10);

  if (loading) return <div className="loading-screen">LOADING LIFESAVER...</div>;

  return (
    <div className="dashboard-root">
      {/* Sidebar/Nav */}
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
        {/* Patient Registry */}
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
                  <span className="time-ago">Updated 4m ago</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Intelligence Detail */}
        <div className="detail-column">
          <div className="detail-content">
            <div className="hero-section">
              <h1 className="hero-name">{selectedPatient?.name || '---'}</h1>
              <div className="hero-meta">
                <span>{selectedPatient?.phone}</span>
                <span className="risk-label">{selectedPatient?.risk_level} Risk</span>
              </div>
            </div>

            <div className="stats-grid">
              <div className="stat-box">
                <label>Protocol Status</label>
                <div className="value">{selectedPatient?.workflow_step.replace('_', ' ')}</div>
              </div>
              <div className="stat-box">
                <label>Strikes</label>
                <div className="strike-bar">
                  <div className="strike-fill"></div>
                  <div className="strike-empty"></div>
                  <div className="strike-empty"></div>
                </div>
              </div>
            </div>

            <div className="intelligence-box">
              <label>Agent Reasoning</label>
              <p>"{selectedPatient?.name.split(' ')[0]} analysis complete. Vitals normalized. Post-discharge baseline established. Continuing day-1 monitoring protocol."</p>
            </div>

            <div className="events-box">
              <label>Live System Events</label>
              <div className="event-log">
                {patientEvents.map(e => (
                  <div key={e.id} className="event-row">
                    <span className="event-time">{new Date(e.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}</span>
                    <span className={`event-type ${e.type === 'escalated' ? 'urgent' : ''}`}>{e.type.toUpperCase()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="action-footer">
            <button className="btn-primary">Send Manual Follow-up</button>
            <button className="btn-secondary">Escalate to On-Call Nurse</button>
          </div>
        </div>
      </div>

      <style jsx>{`
        .dashboard-root {
          background: #000;
          color: #fff;
          height: 100vh;
          display: flex;
          flex-direction: column;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          -webkit-font-smoothing: antialiased;
        }

        .top-nav {
          height: 64px;
          border-bottom: 1px solid #222;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 32px;
          flex-shrink: 0;
        }

        .brand { font-weight: 800; font-size: 20px; letter-spacing: -0.04em; }
        .divider { color: #333; margin: 0 16px; }
        .subtitle { color: #555; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; }

        .nav-right { display: flex; align-items: center; gap: 8px; }
        .status-dot { width: 8px; height: 8px; border-radius: 50%; background: #10b981; box-shadow: 0 0 10px #10b981; }
        .status-text { font-size: 10px; font-weight: 800; color: #555; letter-spacing: 0.1em; }

        .main-layout { display: flex; flex: 1; overflow: hidden; }

        .registry-column { width: 400px; border-right: 1px solid #222; display: flex; flex-direction: column; }
        .column-header { padding: 16px 24px; font-size: 10px; font-weight: 800; color: #444; text-transform: uppercase; letter-spacing: 0.2em; border-bottom: 1px solid #222; background: #080808; }

        .patient-list { flex: 1; overflow-y: auto; }
        .patient-card { width: 100%; border: none; background: transparent; padding: 24px; text-align: left; cursor: pointer; border-bottom: 1px solid #111; transition: all 0.2s; }
        .patient-card:hover { background: #050505; }
        .patient-card.active { background: #0a0a0a; border-bottom: 1px solid #222; }

        .card-top { display: flex; gap: 16px; align-items: center; margin-bottom: 12px; }
        .indicator { width: 4px; height: 32px; background: #222; border-radius: 2px; }
        .indicator.urgent { background: #fff; box-shadow: 0 0 15px rgba(255,255,255,0.4); }
        .patient-name { font-size: 18px; font-weight: 700; color: #fff; line-height: 1.2; }
        .patient-phone { font-size: 13px; color: #444; font-family: monospace; margin-top: 2px; }

        .card-bottom { display: flex; justify-content: space-between; align-items: center; padding-left: 20px; }
        .step-badge { font-size: 10px; font-weight: 800; color: #555; text-transform: uppercase; border: 1px solid #222; padding: 2px 8px; border-radius: 4px; }
        .time-ago { font-size: 11px; color: #222; font-weight: 600; }

        .detail-column { flex: 1; display: flex; flex-direction: column; background: #030303; }
        .detail-content { flex: 1; overflow-y: auto; padding: 64px; }

        .hero-section { margin-bottom: 64px; }
        .hero-name { font-size: 48px; font-weight: 800; letter-spacing: -0.05em; margin-bottom: 8px; }
        .hero-meta { display: flex; gap: 24px; color: #444; font-size: 14px; font-weight: 600; }
        .risk-label { text-transform: uppercase; letter-spacing: 0.1em; color: #666; }

        .stats-grid { display: grid; grid-template-cols: 1fr 1fr; gap: 48px; margin-bottom: 64px; }
        .stat-box label { display: block; font-size: 10px; font-weight: 800; color: #333; text-transform: uppercase; letter-spacing: 0.2em; margin-bottom: 12px; }
        .stat-box .value { font-size: 20px; font-weight: 700; color: #ddd; }

        .strike-bar { display: flex; gap: 8px; margin-top: 12px; }
        .strike-fill { height: 4px; flex: 1; background: #fff; border-radius: 2px; }
        .strike-empty { height: 4px; flex: 1; background: #111; border-radius: 2px; }

        .intelligence-box { margin-bottom: 64px; }
        .intelligence-box label { display: block; font-size: 10px; font-weight: 800; color: #333; text-transform: uppercase; letter-spacing: 0.2em; margin-bottom: 16px; }
        .intelligence-box p { font-size: 15px; line-height: 1.6; color: #888; font-style: italic; background: #080808; padding: 32px; border-radius: 16px; border: 1px solid #111; }

        .events-box label { display: block; font-size: 10px; font-weight: 800; color: #333; text-transform: uppercase; letter-spacing: 0.2em; margin-bottom: 16px; }
        .event-log { background: #000; border: 1px solid #111; border-radius: 16px; padding: 32px; font-family: monospace; font-size: 12px; }
        .event-row { display: flex; gap: 24px; margin-bottom: 8px; color: #333; }
        .event-time { color: #111; }
        .event-type.urgent { color: #fff; font-weight: 800; }

        .action-footer { padding: 48px 64px; border-top: 1px solid #111; display: flex; flex-direction: column; gap: 12px; }
        .btn-primary { height: 56px; background: #fff; color: #000; border: none; border-radius: 12px; font-size: 14px; font-weight: 800; cursor: pointer; transition: all 0.2s; }
        .btn-primary:hover { background: #ddd; }
        .btn-secondary { height: 48px; background: transparent; color: #444; border: 1px solid #222; border-radius: 12px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
        .btn-secondary:hover { color: #fff; border-color: #444; }

        .loading-screen { background: #000; color: #fff; height: 100vh; display: flex; align-items: center; justify-content: center; font-weight: 900; letter-spacing: 0.2em; }
      `}</style>
    </div>
  );
}
