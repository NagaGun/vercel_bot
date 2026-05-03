'use client';

import { useEffect, useRef, useState } from 'react';

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

function UploadModal({ patient, onClose, onSuccess }: { patient: Patient; onClose: () => void; onSuccess: () => void }) {
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return setStatus('Please select a PDF first.');
    if (!file.name.endsWith('.pdf')) return setStatus('Only PDF files are supported.');

    setUploading(true);
    setStatus('Parsing discharge report...');

    const form = new FormData();
    form.append('file', file);

    try {
      const res = await fetch(`/api/patients/${patient.id}/upload`, { method: 'POST', body: form });
      const data = await res.json();
      if (res.ok) {
        setStatus(`✅ Saved ${data.wordCount} words of clinical context.`);
        setTimeout(() => { onSuccess(); onClose(); }, 1500);
      } else {
        setStatus(`❌ Error: ${data.error}`);
      }
    } catch {
      setStatus('❌ Upload failed. Try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Upload Discharge Report</h3>
            <p className="text-sm text-gray-500">{patient.name} · {patient.phone}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>

        <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center mb-4 bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer" onClick={() => fileRef.current?.click()}>
          <div className="text-4xl mb-2">📄</div>
          <p className="text-sm text-gray-600 font-medium">Click to select a PDF</p>
          <p className="text-xs text-gray-400 mt-1">Discharge summaries, surgical notes, medication lists</p>
          <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={() => setStatus('')} />
        </div>

        {fileRef.current?.files?.[0] && (
          <p className="text-xs text-indigo-600 mb-3 font-medium">📎 {fileRef.current.files[0].name}</p>
        )}

        {status && (
          <p className={`text-sm mb-3 p-2 rounded-lg ${status.startsWith('✅') ? 'bg-green-50 text-green-700' : status.startsWith('❌') ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}`}>
            {status}
          </p>
        )}

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors">Cancel</button>
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {uploading ? 'Processing...' : 'Upload & Parse'}
          </button>
        </div>

        <p className="text-xs text-gray-400 mt-3 text-center">🔒 Parsed in-memory. Text stored encrypted in Postgres. No file retained.</p>
      </div>
    </div>
  );
}

const stepColors: Record<string, string> = {
  day_1: 'bg-blue-100 text-blue-800',
  day_3: 'bg-purple-100 text-purple-800',
  day_7: 'bg-orange-100 text-orange-800',
  day_30: 'bg-gray-100 text-gray-700',
  complete: 'bg-green-100 text-green-800',
  escalated: 'bg-red-100 text-red-800',
};

export default function NurseDashboard() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadTarget, setUploadTarget] = useState<Patient | null>(null);

  const fetchDashboardData = async () => {
    try {
      const [patientsRes, eventsRes] = await Promise.all([
        fetch('/api/patients'),
        fetch('/api/events')
      ]);
      const patientsData = await patientsRes.json();
      const eventsData = await eventsRes.json();
      if (patientsData.patients) setPatients(patientsData.patients);
      if (eventsData.events) setEvents(eventsData.events);
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

  const handleAcknowledge = async (patientId: string) => {
    try {
      await fetch('/api/escalate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId }),
      });
      fetchDashboardData();
    } catch (error) {
      console.error('Failed to acknowledge', error);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-white text-lg font-medium animate-pulse">Loading CareOS...</div>
    </div>
  );

  const escalated = patients.filter(p => p.workflow_step === 'escalated' || p.risk_level === 'critical' || p.risk_level === 'high');
  const stable = patients.filter(p => p.workflow_step !== 'escalated' && p.risk_level !== 'critical' && p.risk_level !== 'high');

  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans">
      {uploadTarget && (
        <UploadModal
          patient={uploadTarget}
          onClose={() => setUploadTarget(null)}
          onSuccess={fetchDashboardData}
        />
      )}

      {/* Header */}
      <header className="border-b border-white/10 bg-gray-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center text-sm font-bold">C</div>
            <div>
              <h1 className="text-lg font-bold text-white">CareOS</h1>
              <p className="text-xs text-gray-400">Post-Discharge Triage</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {escalated.length > 0 && (
              <span className="px-3 py-1 bg-red-500/20 border border-red-500/40 text-red-400 rounded-full text-xs font-medium animate-pulse">
                {escalated.length} CRITICAL
              </span>
            )}
            <div className="flex items-center gap-2 px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-ping inline-block" />
              <span className="text-xs text-green-400 font-medium">Agent Active</span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Patients Column */}
        <div className="lg:col-span-2 space-y-6">

          {/* Critical Alerts */}
          {escalated.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-red-400 uppercase tracking-wider mb-3">🚨 Needs Immediate Attention</h2>
              <div className="space-y-3">
                {escalated.map(patient => (
                  <div key={patient.id} className="bg-red-950/40 border border-red-500/50 rounded-2xl p-5 shadow-lg shadow-red-900/20">
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h2 className="text-lg font-bold text-white">{patient.name}</h2>
                          <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded-full border border-red-500/30">Escalated</span>
                        </div>
                        <p className="text-sm text-gray-400">{patient.phone}</p>
                        {patient.discharge_summary && (
                          <p className="text-xs text-gray-500 mt-2 line-clamp-2 italic">📋 {patient.discharge_summary.slice(0, 120)}...</p>
                        )}
                      </div>
                      <div className="flex flex-col gap-2 shrink-0">
                        <button
                          onClick={() => handleAcknowledge(patient.id)}
                          className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-semibold rounded-xl transition-colors"
                        >
                          Acknowledge
                        </button>
                        <button
                          onClick={() => setUploadTarget(patient)}
                          className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 text-xs rounded-xl transition-colors border border-white/10"
                        >
                          📄 Upload Report
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Stable Patients */}
          <section>
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Active Patients</h2>
            <div className="space-y-3">
              {stable.map(patient => (
                <div key={patient.id} className="bg-gray-900 border border-white/8 rounded-2xl p-5 hover:border-white/15 transition-colors group">
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h2 className="text-base font-semibold text-white">{patient.name}</h2>
                        <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${stepColors[patient.workflow_step] || 'bg-gray-100 text-gray-700'}`}>
                          {patient.workflow_step.replace('_', ' ')}
                        </span>
                        {patient.discharge_summary && (
                          <span className="px-2 py-0.5 text-xs rounded-full bg-indigo-500/15 text-indigo-400 border border-indigo-500/20">
                            📋 Context loaded
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">{patient.phone}</p>
                      {patient.discharge_summary && (
                        <p className="text-xs text-gray-600 mt-2 line-clamp-1 italic">
                          {patient.discharge_summary.slice(0, 100)}...
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => setUploadTarget(patient)}
                      className="opacity-0 group-hover:opacity-100 px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-400 text-xs rounded-lg transition-all border border-indigo-500/20"
                    >
                      {patient.discharge_summary ? '📄 Update Report' : '📄 Upload Report'}
                    </button>
                  </div>
                </div>
              ))}

              {stable.length === 0 && escalated.length === 0 && (
                <div className="text-center py-16 border border-dashed border-white/10 rounded-2xl">
                  <p className="text-gray-500 text-sm">No patients tracked yet.</p>
                  <p className="text-gray-600 text-xs mt-1">Seed the database to get started.</p>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Agent Activity Log */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Agent Activity</h2>
          <div className="bg-gray-900 border border-white/8 rounded-2xl p-4 max-h-[700px] overflow-y-auto font-mono text-xs">
            {events.length === 0 ? (
              <p className="text-gray-600 italic">Awaiting agent activity...</p>
            ) : (
              <div className="space-y-5">
                {events.map((event) => (
                  <div key={event.id} className="border-l-2 border-indigo-500/60 pl-3">
                    <div className="text-gray-500 text-xs mb-1">
                      {new Date(event.created_at).toLocaleTimeString()} — {event.patient_name}
                    </div>
                    {event.type === 'agent_reasoning' && event.payload?.steps ? (
                      <div className="space-y-1.5">
                        <span className="text-indigo-400 font-bold">▶ Reasoning:</span>
                        {event.payload.steps.map((step: any, i: number) => (
                          <div key={i} className="ml-2">
                            {step.text && <div className="italic text-gray-400">"{step.text.slice(0, 120)}{step.text.length > 120 ? '...' : ''}"</div>}
                            {step.toolCalls?.length > 0 && (
                              <div className="text-green-400 mt-0.5">
                                {step.toolCalls.map((t: string) => `⚙ ${t}`).join(' → ')}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-blue-300">
                        ▶ {event.type.replace(/_/g, ' ').toUpperCase()}
                        {event.payload && Object.keys(event.payload).length > 0 && (
                          <div className="text-gray-500 mt-0.5">{JSON.stringify(event.payload).slice(0, 120)}</div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
