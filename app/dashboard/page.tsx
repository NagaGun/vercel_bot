'use client';

import { useEffect, useState } from 'react';
import { Geist } from 'next/font/google';

const geist = Geist({ subsets: ['latin'] });

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
      await fetch('/api/cron/follow-up', { 
        method: 'GET',
        headers: { 'x-cron-secret': 'crn_a2b3c4d5e6f708192a3b4c5d6e7f8a9b' } 
      });
      await fetchDashboardData();
    } finally {
      setIsManualTriggering(false);
    }
  };

  if (loading) {
    return (
      <div className={`min-h-screen bg-[#000] flex items-center justify-center ${geist.className}`}>
        <div className="w-8 h-8 border-t-white border-white/10 border-2 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-[#000] text-white antialiased ${geist.className} selection:bg-white/10`}>
      {/* Background Gradients */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full" style={{ 
          background: 'radial-gradient(circle at 0% 0%, rgba(255,255,255,0.03) 0%, transparent 50%)' 
        }} />
      </div>

      {/* Navbar */}
      <nav className="relative z-10 border-b border-white/10 px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-lg font-semibold tracking-tight">LifeSaver</span>
          <div className="h-4 w-[1px] bg-white/20" />
          <span className="text-sm text-white/40 font-medium">Post-Discharge Triage</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-white animate-pulse shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
          <span className="text-sm font-medium tracking-tight">Agent Active</span>
        </div>
      </nav>

      {/* Main Layout */}
      <main className="relative z-10 max-w-[1440px] mx-auto grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-px bg-white/10 h-[calc(100vh-64px)]">
        
        {/* Left: Patient List */}
        <div className="bg-[#000] flex flex-col overflow-hidden">
          <div className="px-8 py-6 border-b border-white/10 flex items-center justify-between bg-black/40 backdrop-blur-sm">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">Active Patients</h2>
            <span className="bg-white/10 px-2 py-0.5 rounded text-[10px] font-bold">{patients.length}</span>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {patients.map((p) => {
              const isSelected = selectedId === p.id;
              const isEscalated = p.workflow_step === 'escalated' || p.risk_level === 'critical';
              
              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedId(p.id)}
                  className={`
                    w-full text-left px-8 py-6 border-b border-white/10 transition-all duration-200 relative group
                    ${isSelected ? 'bg-[#111]' : 'hover:bg-white/[0.02]'}
                  `}
                >
                  {isEscalated && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-white shadow-[0_0_15px_rgba(255,255,255,0.5)]" />
                  )}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className={`text-lg font-medium tracking-tight ${isEscalated ? 'text-white' : 'text-white/90'}`}>
                        {p.name}
                      </span>
                      {isEscalated && (
                        <span className="text-[10px] bg-white text-black px-1.5 py-0.5 font-bold rounded uppercase">Urgent</span>
                      )}
                    </div>
                    <span className="text-xs text-white/30 font-medium">4m ago</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white/40 font-mono tracking-tighter">{p.phone}</span>
                    <div className="flex items-center gap-4">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-white/20 border border-white/10 px-2 py-0.5 rounded">
                        {p.workflow_step.replace('_', ' ')}
                      </span>
                      <span className={`text-xs font-medium ${isEscalated ? 'text-white' : 'text-white/40'}`}>
                        {isEscalated ? 'Escalated' : 'Stable'}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Activity + Detail */}
        <div className="bg-[#000] border-l border-white/10 flex flex-col overflow-hidden">
          
          {/* Top: Minimal Detail Header */}
          <div className="p-8 border-b border-white/10 bg-[#080808]">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-2xl font-semibold tracking-tight">{selectedPatient?.name || '---'}</h3>
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/30">Patient ID: {selectedPatient?.id.slice(0, 8)}</span>
            </div>
            <p className="text-sm text-white/40 font-mono tracking-tight">{selectedPatient?.phone || '---'}</p>
          </div>

          {/* Middle: Info Grid */}
          <div className="flex-1 overflow-y-auto p-8 space-y-12 custom-scrollbar">
            <div className="grid grid-cols-2 gap-y-10 gap-x-8">
              <div className="space-y-2">
                <h4 className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em]">Workflow</h4>
                <div className="text-sm font-medium">{selectedPatient?.workflow_step.replace('_', ' ') || '---'}</div>
              </div>
              <div className="space-y-2">
                <h4 className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em]">Risk Level</h4>
                <div className="text-sm font-medium capitalize">{selectedPatient?.risk_level || '---'}</div>
              </div>
              <div className="space-y-2">
                <h4 className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em]">Strikes</h4>
                <div className="flex gap-1.5 pt-1">
                  {[1, 2, 3].map(s => (
                    <div key={s} className={`w-4 h-1 rounded-full ${s <= 1 ? 'bg-white shadow-[0_0_5px_rgba(255,255,255,0.5)]' : 'bg-white/10'}`} />
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <h4 className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em]">Last Event</h4>
                <div className="text-sm font-medium">SMS Delivered</div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em]">Agent Reasoning</h4>
              <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-6 text-sm leading-relaxed text-white/60 font-medium italic">
                {selectedPatient ? (
                  `"I've initiated the ${selectedPatient.workflow_step} protocol for ${selectedPatient.name.split(' ')[0]}. Clinical indicators remain within normal post-surgical range. No immediate intervention required."`
                ) : (
                  '---'
                )}
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em]">Live Activity</h4>
              <div className="space-y-3 font-mono text-[11px] text-white/30">
                {events.slice(0, 5).map((e) => (
                  <div key={e.id} className="flex gap-4">
                    <span className="text-white/10 shrink-0">{new Date(e.created_at).toLocaleTimeString([], { hour12: false })}</span>
                    <span className={`truncate ${e.type === 'escalated' ? 'text-white' : ''}`}>
                      {e.type.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom: Actions */}
          <div className="p-8 border-t border-white/10 bg-black/40 backdrop-blur-sm space-y-3">
            <button 
              onClick={handleManualFollowUp}
              disabled={isManualTriggering}
              className="w-full h-12 bg-white hover:bg-white/90 text-black text-sm font-bold rounded-xl transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isManualTriggering ? <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" /> : 'Send Manual Follow-up'}
            </button>
            <button className="w-full h-12 border border-white/10 hover:bg-white/5 text-white/60 hover:text-white text-sm font-semibold rounded-xl transition-all">
              Call On-Call Nurse
            </button>
          </div>
        </div>

      </main>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
        
        body {
          background: #000;
          overflow: hidden;
        }
        
        @keyframes pulse-white {
          0% { box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.4); }
          70% { box-shadow: 0 0 0 10px rgba(255, 255, 255, 0); }
          100% { box-shadow: 0 0 0 0 rgba(255, 255, 255, 0); }
        }
      `}</style>
    </div>
  );
}
