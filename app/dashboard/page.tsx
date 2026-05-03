'use client';

import { useEffect, useState, useRef } from 'react';
import { Geist } from 'next/font/google';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Activity, 
  AlertCircle, 
  ArrowRight, 
  CheckCircle2, 
  MessageSquare, 
  Phone, 
  User, 
  Zap,
  MoreVertical,
  ShieldAlert
} from 'lucide-react';
import { cn } from '@/lib/utils';

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
  const patientEvents = events.filter(e => e.patient_id === selectedId).slice(0, 10);

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
      <div className={cn("min-h-screen bg-black flex flex-col items-center justify-center gap-4", geist.className)}>
        <motion.div 
          animate={{ scale: [1, 1.1, 1], opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="w-12 h-12 bg-white rounded-full flex items-center justify-center"
        >
          <Activity className="text-black w-6 h-6" />
        </motion.div>
        <span className="text-white/40 text-sm font-medium tracking-widest uppercase">Initializing LifeSaver</span>
      </div>
    );
  }

  return (
    <div className={cn("min-h-screen bg-black text-white antialiased selection:bg-white/20", geist.className)}>
      {/* Dynamic Background */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(255,255,255,0.03)_0%,transparent_50%)]" />
      </div>

      {/* Modern Navbar */}
      <nav className="relative z-10 h-16 border-b border-white/[0.06] bg-black/40 backdrop-blur-xl px-8 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
              <ShieldAlert className="text-black w-5 h-5" />
            </div>
            <span className="text-xl font-bold tracking-tight">LifeSaver</span>
          </div>
          <div className="h-5 w-px bg-white/[0.1]" />
          <div className="flex items-center gap-2 text-white/40 text-sm font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-white/20" />
            Post-Discharge Triage
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3 bg-white/[0.03] border border-white/[0.06] px-3.5 py-1.5 rounded-full">
            <motion.div 
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.4)]" 
            />
            <span className="text-xs font-semibold uppercase tracking-wider text-white/80">Agent Active</span>
          </div>
          <div className="w-8 h-8 rounded-full bg-white/[0.06] border border-white/[0.1] flex items-center justify-center">
            <MoreVertical className="w-4 h-4 text-white/40" />
          </div>
        </div>
      </nav>

      {/* Content Engine */}
      <main className="relative z-10 max-w-[1600px] mx-auto p-6 grid grid-cols-1 lg:grid-cols-[1fr_440px] gap-8 h-[calc(100vh-64px)] overflow-hidden">
        
        {/* Left Column: Patient List */}
        <div className="flex flex-col gap-5 overflow-hidden">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-3">
              <h2 className="text-[11px] font-bold text-white/30 uppercase tracking-[0.2em]">Active Registry</h2>
              <span className="bg-white/5 border border-white/[0.08] px-2 py-0.5 rounded text-[10px] font-bold text-white/60">
                {patients.length}
              </span>
            </div>
            <div className="text-[11px] text-white/20 font-medium italic">Auto-refreshing...</div>
          </div>

          <div className="flex-1 overflow-y-auto pr-2 flex flex-col gap-3 custom-scrollbar">
            <AnimatePresence mode="popLayout">
              {patients.map((p) => {
                const isSelected = selectedId === p.id;
                const isEscalated = p.workflow_step === 'escalated' || p.risk_level === 'critical';
                
                return (
                  <motion.button
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    key={p.id}
                    onClick={() => setSelectedId(p.id)}
                    className={cn(
                      "w-full text-left p-6 rounded-2xl border transition-all duration-300 relative group overflow-hidden",
                      isSelected ? "bg-[#111] border-white/20 shadow-2xl" : "bg-[#0a0a0a] border-white/[0.05] hover:border-white/10"
                    )}
                  >
                    {isEscalated && (
                      <div className="absolute inset-y-0 left-0 w-1.5 bg-white shadow-[4px_0_20px_rgba(255,255,255,0.3)]" />
                    )}
                    
                    <div className="flex items-start justify-between relative z-10">
                      <div className="space-y-1">
                        <div className="flex items-center gap-3">
                          <h3 className={cn("text-lg font-bold tracking-tight", isEscalated ? "text-white" : "text-white/90")}>
                            {p.name}
                          </h3>
                          {isEscalated && (
                            <div className="px-2 py-0.5 bg-white text-black text-[10px] font-black uppercase rounded tracking-tighter">
                              Urgent
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-white/30 font-medium">
                          <Phone className="w-3 h-3" />
                          <span className="font-mono">{p.phone}</span>
                        </div>
                      </div>
                      
                      <div className="flex flex-col items-end gap-3">
                        <span className="text-[11px] text-white/20 font-medium">Updated 4m ago</span>
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border",
                            isEscalated ? "border-white/40 text-white" : "border-white/10 text-white/40"
                          )}>
                            {p.workflow_step.replace('_', ' ')}
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </AnimatePresence>
          </div>
        </div>

        {/* Right Column: Intelligence Hub */}
        <div className="flex flex-col gap-6 overflow-hidden">
          
          {/* Agent Activity Terminal */}
          <div className="bg-[#0a0a0a] border border-white/[0.06] rounded-2xl flex flex-col h-[300px] shadow-inner">
            <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-3.5 h-3.5 text-white/20" />
                <h2 className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em]">Activity Stream</h2>
              </div>
              <div className="w-2 h-2 rounded-full bg-white/5 animate-pulse" />
            </div>
            <div className="p-6 overflow-y-auto font-mono text-[11px] leading-[2] custom-scrollbar">
              <AnimatePresence>
                {events.slice(0, 15).map((e) => (
                  <motion.div 
                    initial={{ opacity: 0, x: -5 }}
                    animate={{ opacity: 1, x: 0 }}
                    key={e.id} 
                    className="flex gap-4 mb-1 group"
                  >
                    <span className="text-white/10 shrink-0 select-none">{new Date(e.created_at).toLocaleTimeString([], { hour12: false })}</span>
                    <span className={cn(
                      "truncate transition-colors",
                      e.type === 'escalated' ? "text-white font-bold" : "text-white/40 group-hover:text-white/60"
                    )}>
                      {e.type.replace('_', ' ').toUpperCase()} <ArrowRight className="inline w-2.5 h-2.5 opacity-30" /> {e.patient_name}
                    </span>
                  </motion.div>
                ))}
              </AnimatePresence>
              <motion.div 
                animate={{ opacity: [0, 1, 0] }}
                transition={{ duration: 0.8, repeat: Infinity }}
                className="inline-block w-1.5 h-3.5 bg-white ml-2 align-middle" 
              />
            </div>
          </div>

          {/* Patient Intelligence Panel */}
          <div className="flex-1 bg-[#0a0a0a] border border-white/[0.06] rounded-2xl flex flex-col overflow-hidden relative shadow-2xl">
            <div className="px-5 py-4 border-b border-white/[0.06] flex items-center gap-2">
              <User className="w-3.5 h-3.5 text-white/20" />
              <h2 className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em]">Clinical Insight</h2>
            </div>
            
            {selectedPatient ? (
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="p-8 pb-4">
                  <motion.h3 
                    key={selectedPatient.id}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-2xl font-bold tracking-tight mb-2"
                  >
                    {selectedPatient.name}
                  </motion.h3>
                  <div className="flex items-center gap-4 text-xs font-mono text-white/30">
                    <span className="flex items-center gap-1.5"><Phone className="w-3 h-3" /> {selectedPatient.phone}</span>
                    <span className="w-1 h-1 rounded-full bg-white/10" />
                    <span>ID: {selectedPatient.id.slice(0, 8)}</span>
                  </div>
                </div>

                <div className="flex-1 p-8 pt-6 space-y-10 overflow-y-auto custom-scrollbar">
                  <div className="grid grid-cols-2 gap-y-10">
                    <div className="space-y-2.5">
                      <h4 className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em]">Triage Path</h4>
                      <div className="flex items-center gap-2 text-sm font-semibold text-white/90">
                        <CheckCircle2 className="w-4 h-4 text-green-500/50" />
                        {selectedPatient.workflow_step.replace('_', ' ')} Complete
                      </div>
                    </div>
                    <div className="space-y-2.5">
                      <h4 className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em]">Risk Profile</h4>
                      <div className="flex items-center gap-2 text-sm font-semibold capitalize">
                        <AlertCircle className={cn(
                          "w-4 h-4",
                          selectedPatient.risk_level === 'low' ? "text-green-500/40" : "text-white"
                        )} />
                        {selectedPatient.risk_level}
                      </div>
                    </div>
                    <div className="space-y-2.5 col-span-2">
                      <h4 className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em]">Patient Response Strikes</h4>
                      <div className="flex gap-2.5">
                        {[1, 2, 3].map(s => (
                          <div key={s} className={cn(
                            "h-1.5 flex-1 rounded-full transition-all duration-500",
                            s <= 1 ? "bg-white shadow-[0_0_12px_rgba(255,255,255,0.4)]" : "bg-white/10"
                          )} />
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em] flex items-center gap-2">
                      <MessageSquare className="w-3 h-3" /> Agent Log Reasoning
                    </h4>
                    <div className="bg-white/[0.02] border border-white/[0.04] rounded-2xl p-6 text-[13px] leading-[1.7] text-white/60 font-medium italic relative overflow-hidden group">
                      <div className="absolute top-0 left-0 w-1 h-full bg-white/10 group-hover:bg-white/20 transition-colors" />
                      "Initial day-1 outreach completed. Patient baseline matches post-discharge summary. Monitoring for response latency or respiratory red flags over next 12 hours."
                    </div>
                  </div>
                </div>

                <div className="p-8 pt-0 mt-auto flex flex-col gap-3">
                  <button 
                    onClick={handleManualFollowUp}
                    disabled={isManualTriggering}
                    className="w-full h-14 bg-white hover:bg-[#eee] active:scale-[0.98] disabled:opacity-50 text-black text-sm font-bold rounded-2xl transition-all flex items-center justify-center gap-2.5 shadow-[0_0_30px_rgba(255,255,255,0.15)]"
                  >
                    {isManualTriggering ? (
                      <Activity className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <Zap className="w-4 h-4" />
                        Send Manual Follow-up
                      </>
                    )}
                  </button>
                  <button className="w-full h-12 border border-white/[0.08] hover:bg-white/[0.03] hover:border-white/[0.15] text-white/30 hover:text-white/60 text-sm font-bold rounded-2xl transition-all">
                    Escalate to Nurse
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-white/10 gap-4">
                <Activity className="w-10 h-10 opacity-20" />
                <span className="text-[13px] font-medium tracking-tight">Select a patient for intelligence analysis</span>
              </div>
            )}
          </div>
        </div>

      </main>

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
