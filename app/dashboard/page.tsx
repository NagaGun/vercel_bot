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

  if (loading) return <div className="loading-screen">INITIALIZING LIFESAVER SYSTEM...</div>;

  return (
    <div className="dashboard-root">
      {/* Top Navbar */}
      <nav className="top-nav">
        <div className="nav-left">
          <div className="logo-box">LS</div>
          <span className="brand">LifeSaver</span>
          <span className="divider">/</span>
          <span className="subtitle">Clinical Triage Engine</span>
        </div>
        <div className="nav-right">
          <div className="agent-status">
            <div className="pulse-dot"></div>
            <span className="status-label">LLM AGENT ACTIVE</span>
          </div>
          <div className="user-profile">RA</div>
        </div>
      </nav>

      <div className="main-layout">
        {/* Patient Sidebar */}
        <aside className="registry-sidebar">
          <div className="sidebar-header">
            <span>ACTIVE PATIENTS</span>
            <span className="count-badge">{patients.length}</span>
          </div>
          <div className="patient-list">
            {patients.map(p => {
              const isEscalated = p.workflow_step === 'escalated' || p.risk_level === 'critical';
              return (
                <button 
                  key={p.id}
                  onClick={() => setSelectedId(p.id)}
                  className={`patient-card ${selectedId === p.id ? 'active' : ''} ${isEscalated ? 'urgent' : ''}`}
                >
                  <div className="card-accent"></div>
                  <div className="card-main">
                    <div className="card-row">
                      <span className="name">{p.name}</span>
                      <span className="time">Just now</span>
                    </div>
                    <div className="card-row secondary">
                      <span className="phone">{p.phone}</span>
                      <span className={`risk-dot ${p.risk_level}`}></span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Main Intelligence Panel */}
        <main className="intelligence-panel">
          {selectedPatient ? (
            <div className="intelligence-scroll">
              
              {/* Header Section */}
              <header className="patient-header">
                <div className="header-top">
                  <h1 className="display-name">{selectedPatient.name}</h1>
                  <div className="badge-row">
                    <span className="protocol-badge">Day {selectedPatient.workflow_step.split('_')[1] || '1'} Protocol</span>
                    <span className={`risk-badge ${selectedPatient.risk_level}`}>{selectedPatient.risk_level.toUpperCase()} RISK</span>
                  </div>
                </div>
                <div className="header-meta">
                  <div className="meta-item">
                    <label>TELEMETRY ID</label>
                    <span>{selectedPatient.id.slice(0, 8)}</span>
                  </div>
                  <div className="meta-item">
                    <label>CONTACT</label>
                    <span>{selectedPatient.phone}</span>
                  </div>
                  <div className="meta-item">
                    <label>NEXT CHECK-IN</label>
                    <span>Scheduled in 14h</span>
                  </div>
                </div>
              </header>

              {/* Grid Section */}
              <div className="info-grid">
                
                {/* Managed Conversation */}
                <section className="convo-section">
                  <div className="section-header">MANAGED TRIAGE THREAD</div>
                  <div className="convo-feed">
                    {patientEvents.length === 0 && <div className="empty-feed">Awaiting initial outreach...</div>}
                    {patientEvents.map(e => {
                      if (e.type === 'sms_sent') return (
                        <div key={e.id} className="bubble agent">
                          <label>AGENT OUTREACH</label>
                          <p>{e.payload.message}</p>
                          <time>{new Date(e.created_at).toLocaleTimeString()}</time>
                        </div>
                      );
                      if (e.type === 'sms_received') return (
                        <div key={e.id} className="bubble patient">
                          <label>PATIENT REPLY</label>
                          <p>{e.payload.body}</p>
                          <time>{new Date(e.created_at).toLocaleTimeString()}</time>
                        </div>
                      );
                      if (e.type === 'agent_reasoning') return (
                        <div key={e.id} className="reasoning-note">
                          <span className="gear">⚙</span>
                          <span>{e.payload.steps?.[0]?.text}</span>
                        </div>
                      );
                      if (e.type === 'escalated') return (
                        <div key={e.id} className="escalation-alert">
                          🚨 CRITICAL ESCALATION: {e.payload.reason}
                        </div>
                      );
                      return null;
                    })}
                  </div>
                </section>

                {/* Patient Context & Strikes */}
                <div className="context-column">
                  
                  {/* Delivery Health */}
                  <section className="panel-box">
                    <div className="panel-header">DELIVERY HEALTH</div>
                    <div className="strike-display">
                      <label>NON-RESPONSE STRIKES (1/3)</label>
                      <div className="strike-track">
                        <div className="strike-hit"></div>
                        <div className="strike-slot"></div>
                        <div className="strike-slot"></div>
                      </div>
                    </div>
                  </section>

                  {/* Clinical Context */}
                  <section className="panel-box clinical">
                    <div className="panel-header">CLINICAL CONTEXT</div>
                    <div className="clinical-text">
                      {selectedPatient.discharge_summary ? (
                        <p>{selectedPatient.discharge_summary}</p>
                      ) : (
                        <div className="placeholder-text">No discharge summary uploaded for this patient.</div>
                      )}
                    </div>
                  </section>

                  {/* Sentiment Analysis */}
                  <section className="panel-box">
                    <div className="panel-header">SENTIMENT TRACKING</div>
                    <div className="sentiment-stat">
                      <span className="stat-value">NEUTRAL</span>
                      <span className="stat-desc">Monitoring for respiratory distress indicators.</span>
                    </div>
                  </section>

                </div>
              </div>
            </div>
          ) : (
            <div className="no-selection">Select a patient from the registry to view clinical intelligence.</div>
          )}

          {/* Persistent Action Bar */}
          <footer className="action-bar">
            <button className="btn-takeover">Take Over Conversation</button>
            <button className="btn-nurse">Escalate to Charge Nurse</button>
          </footer>
        </main>
      </div>

      <style jsx>{`
        .dashboard-root { background: #000; color: #fff; height: 100vh; display: flex; flex-direction: column; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
        
        /* Navbar */
        .top-nav { height: 64px; border-bottom: 1px solid #1a1a1a; display: flex; align-items: center; justify-content: space-between; padding: 0 24px; background: #080808; }
        .logo-box { width: 28px; height: 28px; background: #fff; color: #000; font-weight: 900; font-size: 14px; border-radius: 6px; display: flex; align-items: center; justify-content: center; margin-right: 12px; }
        .brand { font-weight: 800; font-size: 18px; letter-spacing: -0.03em; }
        .divider { color: #333; margin: 0 12px; }
        .subtitle { color: #666; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.15em; }
        .nav-right { display: flex; align-items: center; gap: 24px; }
        .agent-status { display: flex; align-items: center; gap: 8px; background: #111; padding: 6px 12px; border-radius: 99px; border: 1px solid #222; }
        .pulse-dot { width: 6px; height: 6px; background: #10b981; border-radius: 50%; box-shadow: 0 0 8px #10b981; animation: pulse 2s infinite; }
        .status-label { font-size: 9px; font-weight: 800; color: #10b981; letter-spacing: 0.1em; }
        .user-profile { width: 32px; height: 32px; background: #222; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: #666; }

        @keyframes pulse { 0% { opacity: 0.4; } 50% { opacity: 1; } 100% { opacity: 0.4; } }

        .main-layout { display: flex; flex: 1; overflow: hidden; }

        /* Sidebar */
        .registry-sidebar { width: 340px; border-right: 1px solid #1a1a1a; display: flex; flex-direction: column; background: #050505; }
        .sidebar-header { padding: 20px 24px; border-bottom: 1px solid #1a1a1a; display: flex; justify-content: space-between; align-items: center; }
        .sidebar-header span { font-size: 10px; font-weight: 800; color: #444; letter-spacing: 0.2em; }
        .count-badge { background: #111; color: #888; padding: 2px 6px; border-radius: 4px; }
        .patient-list { flex: 1; overflow-y: auto; }
        .patient-card { width: 100%; border: none; background: transparent; padding: 20px 24px; text-align: left; cursor: pointer; border-bottom: 1px solid #0f0f0f; transition: 0.2s; position: relative; }
        .patient-card:hover { background: #0a0a0a; }
        .patient-card.active { background: #111; }
        .card-accent { position: absolute; left: 0; top: 20px; bottom: 20px; width: 3px; background: #222; border-radius: 0 2px 2px 0; }
        .active .card-accent { background: #444; }
        .urgent .card-accent { background: #fff; box-shadow: 0 0 10px #fff; }
        .card-main { padding-left: 12px; }
        .card-row { display: flex; justify-content: space-between; align-items: center; }
        .name { font-size: 15px; font-weight: 700; color: #eee; }
        .time { font-size: 11px; color: #333; }
        .card-row.secondary { margin-top: 4px; }
        .phone { font-size: 12px; color: #444; font-family: monospace; }
        .risk-dot { width: 6px; height: 6px; border-radius: 50%; }
        .risk-dot.critical { background: #ef4444; }
        .risk-dot.high { background: #f59e0b; }
        .risk-dot.low { background: #10b981; }

        /* Intelligence Panel */
        .intelligence-panel { flex: 1; display: flex; flex-direction: column; background: #000; position: relative; }
        .intelligence-scroll { flex: 1; overflow-y: auto; padding: 48px 64px; }
        
        .patient-header { margin-bottom: 48px; }
        .display-name { font-size: 44px; font-weight: 800; letter-spacing: -0.05em; margin-bottom: 12px; }
        .badge-row { display: flex; gap: 12px; }
        .protocol-badge { background: #111; border: 1px solid #222; padding: 4px 12px; border-radius: 6px; font-size: 11px; font-weight: 700; color: #888; }
        .risk-badge { padding: 4px 12px; border-radius: 6px; font-size: 11px; font-weight: 900; }
        .risk-badge.critical { background: #fff; color: #000; }
        .risk-badge.high { background: #f59e0b20; border: 1px solid #f59e0b40; color: #f59e0b; }
        .risk-badge.low { background: #10b98120; border: 1px solid #10b98140; color: #10b981; }

        .header-meta { display: flex; gap: 48px; margin-top: 32px; padding: 24px; background: #080808; border-radius: 16px; border: 1px solid #111; }
        .meta-item label { display: block; font-size: 9px; font-weight: 800; color: #333; letter-spacing: 0.15em; margin-bottom: 6px; }
        .meta-item span { font-size: 14px; font-weight: 700; color: #ddd; font-family: monospace; }

        .info-grid { display: grid; grid-template-cols: 1fr 300px; gap: 32px; margin-top: 48px; }

        /* Conversation */
        .convo-section { background: #000; border: 1px solid #111; border-radius: 24px; overflow: hidden; display: flex; flex-direction: column; }
        .section-header { padding: 16px 24px; border-bottom: 1px solid #111; font-size: 10px; font-weight: 800; color: #333; text-transform: uppercase; letter-spacing: 0.2em; }
        .convo-feed { padding: 32px; display: flex; flex-direction: column; gap: 24px; }
        .empty-feed { text-align: center; color: #222; font-style: italic; padding: 32px 0; }
        
        .bubble { max-width: 85%; display: flex; flex-direction: column; gap: 6px; }
        .bubble.agent { align-self: flex-start; }
        .bubble.patient { align-self: flex-end; align-items: flex-end; }
        .bubble label { font-size: 9px; font-weight: 800; color: #333; letter-spacing: 0.1em; }
        .bubble p { padding: 16px 20px; border-radius: 16px; font-size: 14px; line-height: 1.5; font-weight: 500; }
        .agent p { background: #111; color: #bbb; border: 1px solid #222; }
        .patient p { background: #fff; color: #000; font-weight: 600; }
        .bubble time { font-size: 10px; color: #222; font-family: monospace; }

        .reasoning-note { background: #050505; border: 1px solid #111; padding: 16px 20px; border-radius: 12px; font-size: 12px; color: #555; font-style: italic; display: flex; gap: 12px; align-items: center; line-height: 1.4; }
        .gear { color: #222; font-style: normal; font-size: 16px; }
        .escalation-alert { background: #7f1d1d20; border: 1px solid #7f1d1d50; color: #ef4444; padding: 16px; border-radius: 12px; text-align: center; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; }

        /* Sidebar Column */
        .context-column { display: flex; flex-direction: column; gap: 24px; }
        .panel-box { background: #080808; border: 1px solid #111; border-radius: 16px; padding: 20px; }
        .panel-header { font-size: 9px; font-weight: 800; color: #333; letter-spacing: 0.15em; margin-bottom: 16px; text-transform: uppercase; }
        
        .strike-display label { font-size: 10px; font-weight: 700; color: #555; display: block; margin-bottom: 12px; }
        .strike-track { display: flex; gap: 8px; }
        .strike-hit { height: 6px; flex: 1; background: #fff; border-radius: 3px; box-shadow: 0 0 10px rgba(255,255,255,0.4); }
        .strike-slot { height: 6px; flex: 1; background: #1a1a1a; border-radius: 3px; }

        .clinical-text p { font-size: 12px; color: #666; line-height: 1.6; }
        .placeholder-text { font-size: 11px; color: #333; font-style: italic; text-align: center; padding: 16px 0; }

        .sentiment-stat { display: flex; flex-direction: column; gap: 4px; }
        .stat-value { font-size: 14px; font-weight: 800; color: #ddd; }
        .stat-desc { font-size: 11px; color: #444; line-height: 1.4; }

        /* Action Footer */
        .action-bar { padding: 24px 64px; border-top: 1px solid #1a1a1a; display: flex; gap: 16px; background: #080808; position: sticky; bottom: 0; }
        .btn-takeover { flex: 1; height: 48px; background: #fff; color: #000; border: none; border-radius: 10px; font-size: 14px; font-weight: 800; cursor: pointer; transition: 0.2s; }
        .btn-takeover:hover { background: #ddd; }
        .btn-nurse { flex: 1; height: 48px; background: transparent; color: #444; border: 1px solid #222; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; transition: 0.2s; }
        .btn-nurse:hover { color: #fff; border-color: #444; }

        .no-selection { flex: 1; display: flex; align-items: center; justify-content: center; color: #222; font-size: 15px; font-weight: 600; text-align: center; padding: 0 64px; }
        .loading-screen { background: #000; color: #fff; height: 100vh; display: flex; align-items: center; justify-content: center; font-weight: 900; letter-spacing: 0.3em; font-size: 14px; }
      `}</style>
    </div>
  );
}
