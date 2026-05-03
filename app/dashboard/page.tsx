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
      <div className={`min-h-screen bg-black flex items-center justify-center ${geist.className}`}>
        <div className="w-6 h-6 border-2 border-white/10 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-black text-white antialiased ${geist.className} p-6 flex flex-col gap-6`}>
      {/* Navbar */}
      <nav className="flex items-center justify-between px-2">
        <div className="flex items-center gap-4">
          <span className="text-xl font-bold tracking-tight">LifeSaver</span>
          <div className="h-4 w-[1px] bg-white/10" />
          <span className="text-sm text-white/30 font-medium">Post-Discharge Triage</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
          <span className="text-sm font-medium text-white/90">Agent Active</span>
        </div>
      </nav>

      {/* Main Content */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-8 h-full overflow-hidden">
        
        {/* Left Column: Patient Cards */}
        <div className="flex flex-col gap-4 overflow-y-auto custom-scrollbar pr-2">
          <div className="flex items-center justify-between px-2 mb-2">
            <h2 className="text-[11px] font-bold text-white/20 uppercase tracking-[0.2em]">Active Patients</h2>
            <span className="text-[11px] text-white/20 font-bold">3</span>
          </div>

          <div className="flex flex-col gap-3">
            {patients.map((p) => {
              const isSelected = selectedId === p.id;
              const isEscalated = p.workflow_step === 'escalated' || p.risk_level === 'critical';
              
              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedId(p.id)}
                  className={`
                    w-full text-left px-8 py-7 rounded-xl border transition-all duration-200 relative group
                    ${isSelected ? 'bg-[#111] border-white/20' : 'bg-[#0a0a0a] border-white/5 hover:border-white/10'}
                    ${isEscalated ? 'border-white/40 ring-1 ring-white/10' : ''}
                  `}
                >
                  {isEscalated && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-white rounded-l-xl shadow-[0_0_15px_rgba(255,255,255,0.4)]" />
                  )}
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className={`text-lg font-bold tracking-tight mb-1 ${isEscalated ? 'text-white' : 'text-white/90'}`}>
                        {p.name}
                      </h3>
                      <p className="text-sm text-white/20 font-medium mb-4">{p.phone}</p>
                      <span className={`text-xs font-medium ${isEscalated ? 'text-white' : 'text-white/40'}`}>
                        {isEscalated ? 'Escalated' : p.risk_level === 'high' ? 'At Risk' : 'Stable'}
                      </span>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className="text-[11px] text-white/20 font-medium tracking-tight">4 hrs ago</span>
                      <div className="px-3 py-1 border border-white/20 rounded-full text-[10px] font-bold uppercase tracking-wider text-white/60">
                        {p.workflow_step.replace('_', ' ')}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Column: Log + Detail */}
        <div className="flex flex-col gap-6 overflow-hidden">
          
          {/* Activity Log */}
          <div className="bg-[#0a0a0a] border border-white/5 rounded-xl flex flex-col h-[320px]">
            <div className="px-5 py-4 border-b border-white/5">
              <h2 className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em]">Activity Log</h2>
            </div>
            <div className="p-6 overflow-y-auto font-mono text-[11px] leading-[1.8] custom-scrollbar">
              {events.slice(0, 15).map((e) => (
                <div key={e.id} className="flex gap-4 mb-1">
                  <span className="text-white/10 shrink-0">{new Date(e.created_at).toLocaleTimeString([], { hour12: false })}</span>
                  <span className={e.type === 'escalated' ? 'text-white' : 'text-white/40'}>
                    {e.type.replace('_', ' ').toUpperCase()} → {e.patient_name}
                  </span>
                </div>
              ))}
              <div className="inline-block w-1 h-3 bg-white ml-2 animate-pulse" />
            </div>
          </div>

          {/* Patient Info */}
          <div className="flex-1 bg-[#0a0a0a] border border-white/5 rounded-xl flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-white/5">
              <h2 className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em]">Patient</h2>
            </div>
            <div className="p-8 flex-1 flex flex-col gap-8 overflow-y-auto custom-scrollbar">
              <div className="space-y-1">
                <h3 className="text-xl font-bold tracking-tight">{selectedPatient?.name || '---'}</h3>
              </div>

              <div className="space-y-6">
                <div>
                  <h4 className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em] mb-2">Workflow Step</h4>
                  <div className="text-lg font-medium tracking-tight text-white/90">
                    {selectedPatient?.workflow_step.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()) || '---'} Complete
                  </div>
                </div>

                <div>
                  <h4 className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em] mb-3">Last Message</h4>
                  <div className="text-sm leading-relaxed text-white/40 italic">
                    "Some discomfort but manageable. Taking medication as directed."
                  </div>
                </div>
              </div>

              <div className="mt-auto pt-4 space-y-3">
                <button 
                  onClick={handleManualFollowUp}
                  disabled={isManualTriggering}
                  className="w-full h-12 bg-white hover:bg-white/90 text-black text-[13px] font-bold rounded-lg transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isManualTriggering ? <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" /> : 'Send Manual Follow-up'}
                </button>
                <button className="w-full h-11 border border-white/10 hover:bg-white/5 text-white/40 text-[13px] font-medium rounded-lg transition-colors">
                  Call On-Call Nurse
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 0px;
        }
        body {
          background: black;
          overflow: hidden;
        }
      `}</style>
    </div>
  );
}
