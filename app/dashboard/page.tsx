'use client';

import { useEffect, useState, useRef } from 'react';

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
  const [isManualTriggering, setIsManualTriggering] = useState(false);

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
      
      if (!selectedId && pList.length > 0) {
        setSelectedId(pList[0].id);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data', error);
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
  const patientEvents = events.filter(e => e.patient_id === selectedId);

  const handleManualFollowUp = async () => {
    if (!selectedId) return;
    setIsManualTriggering(true);
    try {
      // Manual trigger can be a direct call to the agent route or a specific manual endpoint
      await fetch('/api/cron/follow-up', { 
        method: 'GET', // In a real app, this might be a POST with the patientId
        headers: { 'x-cron-secret': 'crn_a2b3c4d5e6f708192a3b4c5d6e7f8a9b' } 
      });
      await fetchDashboardData();
    } finally {
      setIsManualTriggering(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080808] flex items-center justify-center">
        <div className="w-12 h-12 border-2 border-white/10 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080808] text-white selection:bg-white/20 relative overflow-x-hidden font-sans">
      {/* Background Gradients */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0" style={{ 
          background: 'radial-gradient(ellipse at top left, #0d1117 0%, #080808 50%, #0a0a0f 100%)' 
        }} />
        <div className="absolute inset-0" style={{ 
          background: 'linear-gradient(135deg, rgba(255,255,255,0.015) 0%, transparent 60%)' 
        }} />
      </div>

      {/* Navbar */}
      <nav className="relative z-10 h-14 border-b border-white/5 bg-[#080808]/80 backdrop-blur-md px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-base font-semibold tracking-tight">LifeSaver</span>
          <div className="w-[1px] h-4 bg-white/10" />
          <span className="text-[13px] text-white/40">Post-Discharge Triage</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          <span className="text-[13px] font-medium">Agent Active</span>
        </div>
      </nav>

      {/* Main Content */}
      <main className="relative z-10 max-w-[1280px] mx-auto p-4 md:p-6 grid grid-cols-1 md:grid-cols-[1fr_minmax(320px,42%)] gap-6 h-[calc(100vh-56px)] overflow-hidden">
        
        {/* Left Column: Patient List */}
        <div className="flex flex-col gap-4 overflow-y-auto pr-1">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-[11px] font-medium uppercase tracking-[0.15em] text-white/40">Active Patients</h2>
            <span className="text-[11px] font-medium text-white/40">{patients.length}</span>
          </div>

          <div className="flex flex-col gap-[6px]">
            {patients.map((p) => {
              const isSelected = selectedId === p.id;
              const isEscalated = p.workflow_step === 'escalated' || p.risk_level === 'critical';
              
              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedId(p.id)}
                  className={`
                    relative text-left px-5 py-4 rounded-[10px] border transition-all duration-150
                    ${isSelected ? 'bg-[#181818] border-white/10 shadow-2xl' : 'bg-[#111] border-white/5 hover:bg-[#161616]'}
                  `}
                  style={{
                    borderLeft: isEscalated 
                      ? '3px solid rgba(255,255,255,0.9)' 
                      : isSelected ? '3px solid rgba(255,255,255,0.4)' : '1px solid rgba(255,255,255,0.06)'
                  }}
                >
                  <div className="flex justify-between items-start mb-0.5">
                    <div className="flex items-center gap-2">
                      <span className={`text-[15px] font-medium ${isEscalated ? 'text-white' : 'text-white/90'}`}>
                        {p.name}
                      </span>
                      <span className="text-[11px] px-2.5 py-0.5 rounded-full border border-white/10 text-white/40 uppercase tracking-wider">
                        {p.workflow_step.replace('_', ' ')}
                      </span>
                      {isEscalated && <span className="text-[11px] font-medium text-white tracking-widest ml-1">→</span>}
                    </div>
                    <span className="text-[12px] text-white/30">Just now</span>
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-[13px] text-white/40 font-mono tracking-tight">{p.phone}</span>
                    <span className={`text-[12px] ${isEscalated ? 'text-white font-medium' : 'text-white/30'}`}>
                      {isEscalated ? 'Escalated' : p.risk_level === 'high' ? 'At Risk' : 'Stable'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Column: Activity + Detail */}
        <div className="flex flex-col gap-6 overflow-hidden h-full">
          
          {/* Collapsed Activity Log */}
          <div className="bg-[#0d0d0d] border border-white/5 rounded-[10px] flex flex-col h-[160px] flex-shrink-0">
            <div className="px-4 py-2 border-b border-white/5 flex items-center justify-between">
              <span className="text-[10px] font-medium text-white/30 uppercase tracking-widest">Live Activity</span>
            </div>
            <div className="p-4 overflow-y-auto font-mono text-[11px] leading-[1.8] text-white/40">
              {events.slice(0, 10).map((e) => (
                <div key={e.id} className="mb-1">
                  <span className="text-white/20">[{new Date(e.created_at).toLocaleTimeString([], { hour12: false })}]</span>{' '}
                  <span className={e.type === 'escalated' ? 'text-white font-medium' : 'text-white/50'}>
                    {e.type.replace('_', ' ').toUpperCase()} → {e.patient_name}
                  </span>
                </div>
              ))}
              <div className="inline-block w-1.5 h-3 bg-white ml-1 animate-[pulse_1s_infinite]" />
            </div>
          </div>

          {/* Patient Detail HERO */}
          <div className="flex-1 bg-[#111] border border-white/5 rounded-[10px] flex flex-col overflow-hidden shadow-2xl">
            {selectedPatient ? (
              <>
                <div className="p-8 border-b border-white/5">
                  <h3 className="text-2xl font-semibold tracking-tight text-white mb-1">{selectedPatient.name}</h3>
                  <p className="text-[14px] text-white/40 font-mono">{selectedPatient.phone}</p>
                </div>

                <div className="flex-1 p-8 space-y-8 overflow-y-auto">
                  <div className="grid grid-cols-2 gap-x-12 gap-y-8">
                    <div>
                      <h4 className="text-[11px] font-medium text-white/30 uppercase tracking-[0.15em] mb-3">Workflow Step</h4>
                      <div className="text-[14px] text-white">{selectedPatient.workflow_step.replace('_', ' ')}</div>
                    </div>
                    <div>
                      <h4 className="text-[11px] font-medium text-white/30 uppercase tracking-[0.15em] mb-3">Risk Level</h4>
                      <div className="text-[14px] text-white capitalize">{selectedPatient.risk_level}</div>
                    </div>
                    <div>
                      <h4 className="text-[11px] font-medium text-white/30 uppercase tracking-[0.15em] mb-3">Strikes</h4>
                      <div className="flex gap-1.5 mt-1">
                        {[1, 2, 3].map(s => (
                          <div 
                            key={s} 
                            className={`w-3 h-3 rounded-sm ${s <= 1 ? 'bg-white' : 'bg-white/10'}`} 
                          />
                        ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-[11px] font-medium text-white/30 uppercase tracking-[0.15em] mb-3">Last Contact</h4>
                      <div className="text-[14px] text-white">4 min ago</div>
                    </div>
                  </div>

                  <div className="pt-8 border-t border-white/5">
                    <h4 className="text-[11px] font-medium text-white/30 uppercase tracking-[0.15em] mb-4">Last Message Preview</h4>
                    <div className="text-[14px] leading-relaxed text-white/80 italic p-4 bg-white/[0.03] rounded-lg border border-white/5">
                      "Hi {selectedPatient.name.split(' ')[0]}, this is CareOS checking in to see how you're feeling today. Please reply if you have any questions."
                    </div>
                  </div>
                </div>

                <div className="p-8 mt-auto border-t border-white/5 space-y-3">
                  <button 
                    onClick={handleManualFollowUp}
                    disabled={isManualTriggering}
                    className="w-full h-12 bg-white hover:bg-[#e5e5e5] disabled:opacity-50 text-black text-[13px] font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    {isManualTriggering ? (
                      <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                    ) : (
                      'Send Manual Follow-up'
                    )}
                  </button>
                  <button className="w-full h-12 bg-transparent border border-white/10 hover:bg-white/5 text-white text-[13px] font-medium rounded-lg transition-colors">
                    Call Nurse
                  </button>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-white/20 text-[13px] italic">
                Select a patient to view details
              </div>
            )}
          </div>
        </div>

      </main>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');
        
        body {
          font-family: 'Inter', -apple-system, sans-serif;
          background: #080808;
          cursor: default;
        }

        /* Scrollbar Styling */
        ::-webkit-scrollbar {
          width: 4px;
        }
        ::-webkit-scrollbar-track {
          background: transparent;
        }
        ::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }

        /* Mobile specific adjustments */
        @media (max-width: 768px) {
          main {
            grid-template-columns: 1fr;
            height: auto;
            overflow: visible;
          }
          .h-full {
            height: auto;
          }
          div[class*="h-[calc(100vh-56px)]"] {
            height: auto;
          }
        }
      `}</style>
    </div>
  );
}
