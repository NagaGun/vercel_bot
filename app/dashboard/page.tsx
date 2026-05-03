'use client';

import { useEffect, useState } from 'react';

type Patient = {
  id: string;
  name: string;
  phone: string;
  workflow_step: string;
  risk_level: string;
  next_contact_at: string;
};

type Event = {
  id: string;
  patient_id: string;
  patient_name: string;
  type: string;
  payload: any;
  created_at: string;
};

export default function NurseDashboard() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

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
    // Poll every 5 seconds for the live demo
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
      // Refresh immediately
      fetchDashboardData();
    } catch (error) {
      console.error('Failed to acknowledge', error);
    }
  };

  if (loading) return <div className="p-8 font-sans">Loading CareOS Dashboard...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">CareOS Triage</h1>
            <p className="text-gray-500">Live monitoring of post-discharge patients</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
            </span>
            <span className="text-sm text-gray-600 font-medium">Agent Active</span>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-xl font-semibold text-gray-800 border-b pb-2">Active Patients</h2>
            {patients.map(patient => {
              const isEscalated = patient.workflow_step === 'escalated' || patient.risk_level === 'critical' || patient.risk_level === 'high';
              return (
                <div 
                  key={patient.id} 
                  className={`bg-white rounded-xl shadow-sm border p-6 transition-all ${
                    isEscalated ? 'border-red-500 ring-1 ring-red-500 shadow-red-100' : 'border-gray-200'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                        {patient.name}
                        {isEscalated && (
                          <span className="inline-flex items-center rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/10">
                            Requires Immediate Attention
                          </span>
                        )}
                      </h2>
                      <p className="text-sm text-gray-500 mt-1">{patient.phone}</p>
                    </div>
                    
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-500">Current Step</p>
                      <p className="text-lg font-semibold text-gray-900 capitalize">
                        {patient.workflow_step.replace('_', ' ')}
                      </p>
                    </div>
                  </div>

                  {isEscalated && (
                    <div className="mt-6 flex justify-end">
                      <button
                        onClick={() => handleAcknowledge(patient.id)}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg shadow-sm transition-colors"
                      >
                        Acknowledge & Take Over
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {patients.length === 0 && (
              <div className="text-center py-12 bg-white rounded-xl border border-gray-200 border-dashed">
                <p className="text-gray-500">No patients currently tracked.</p>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-800 border-b pb-2">Agent Activity Log</h2>
            <div className="bg-gray-900 rounded-xl p-4 shadow-inner max-h-[800px] overflow-y-auto font-mono text-sm">
              {events.length === 0 ? (
                <p className="text-gray-500 italic">Awaiting agent activity...</p>
              ) : (
                <div className="space-y-6">
                  {events.map((event) => (
                    <div key={event.id} className="border-l-2 border-indigo-500 pl-3">
                      <div className="text-gray-400 text-xs mb-1">
                        {new Date(event.created_at).toLocaleTimeString()} - {event.patient_name}
                      </div>
                      {event.type === 'agent_reasoning' && event.payload?.steps ? (
                        <div className="space-y-2">
                          <span className="text-indigo-400 font-bold">▶ Agent Reasoning Steps:</span>
                          {event.payload.steps.map((step: any, i: number) => (
                            <div key={i} className="text-gray-300 ml-2">
                              {step.text && <div className="italic text-gray-400">"{step.text}"</div>}
                              {step.toolCalls && step.toolCalls.length > 0 && (
                                <div className="text-green-400">
                                  {step.toolCalls.map((t: string) => `⚙️ Called: ${t}`).join(', ')}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-blue-300">
                          ▶ {event.type.replace('_', ' ').toUpperCase()}
                          {event.payload && Object.keys(event.payload).length > 0 && (
                            <div className="text-gray-400 mt-1 text-xs">
                              {JSON.stringify(event.payload)}
                            </div>
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
    </div>
  );
}
