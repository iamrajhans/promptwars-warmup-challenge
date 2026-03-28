"use client";

import { useEffect, useState } from 'react';
import { ShieldAlert, Check, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Intent {
  id: string;
  raw_text: string;
  intent_summary: string;
  urgency: number;
  recommended_action: string;
  status: 'pending' | 'acknowledged' | 'resolved';
  timestamp: string;
}

export default function OperatorDashboard() {
  const [intents, setIntents] = useState<Intent[]>([]);

  // Polling mechanism (acting as mock Firestore Real-time)
  useEffect(() => {
    const fetchIntents = async () => {
      try {
        const res = await fetch('/api/ingest');
        const data = await res.json();
        if (data.intents) {
           setIntents(data.intents);
        }
      } catch (err) {
        console.error("Failed to fetch intents", err);
      }
    };
    
    fetchIntents();
    const interval = setInterval(fetchIntents, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleAcknowledge = async (id: string) => {
    // Optimistic update
    setIntents(prev => prev.map(i => i.id === id ? { ...i, status: 'acknowledged' } : i));
    await fetch('/api/ingest', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: 'acknowledged' })
    });
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-8">
      <header className="mb-8 flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <ShieldAlert className="text-red-500 w-8 h-8" /> 
            Command Center
          </h1>
          <p className="text-slate-400 text-sm mt-2">Universal Bridge - Operator View</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="bg-slate-800 px-4 py-2 rounded-lg text-sm font-mono flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            System Online
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4">
        <AnimatePresence>
          {intents.length === 0 && (
            <div className="text-center py-32 text-slate-500 border-2 border-dashed border-slate-800 rounded-2xl">
              No active incidents in the pipeline.
            </div>
          )}
          {intents.map((intent) => (
             <motion.div 
               key={intent.id}
               initial={{ opacity: 0, x: -20 }}
               animate={{ opacity: 1, x: 0 }}
               className={`p-6 rounded-xl border ${
                 intent.status === 'acknowledged' ? 'bg-slate-800 border-slate-700 opacity-60' : 
                 intent.urgency >= 4 ? 'bg-red-950/40 border-red-900/50' : 'bg-amber-950/20 border-amber-900/40'
               }`}
             >
               <div className="flex justify-between items-start mb-4">
                 <div className="flex items-center gap-3">
                   <div className={`px-3 py-1 text-xs font-bold rounded ${intent.urgency >= 4 ? 'bg-red-500 text-white' : 'bg-amber-500 text-amber-950'}`}>
                     SEVERITY Level {intent.urgency}
                   </div>
                   <div className="text-sm font-mono text-slate-400 flex items-center gap-1">
                     <Clock className="w-4 h-4"/> {new Date(intent.timestamp).toLocaleTimeString()}
                   </div>
                 </div>
                 {intent.status === 'pending' ? (
                   <button 
                     onClick={() => handleAcknowledge(intent.id)}
                     className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded text-sm font-medium transition-colors flex items-center gap-2"
                   >
                     <Check className="w-4 h-4"/> Acknowledge
                   </button>
                 ) : (
                   <span className="text-green-500 text-sm font-bold flex items-center gap-1">
                     <Check className="w-4 h-4"/> Acknowledged
                   </span>
                 )}
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div>
                   <h3 className="text-xs uppercase font-bold text-slate-500 mb-2">AI Extracted Intent</h3>
                   <p className="text-lg font-medium text-white mb-4">{intent.intent_summary}</p>
                   
                   <h3 className="text-xs uppercase font-bold text-slate-500 mb-2">Recommended Action</h3>
                   <div className="bg-slate-900/50 rounded p-3 text-emerald-400 font-mono text-sm border border-slate-800">
                     {'>'} {intent.recommended_action}
                   </div>
                 </div>
                 <div>
                   <h3 className="text-xs uppercase font-bold text-slate-500 mb-2">Raw User Input (Untouched)</h3>
                   <div className="bg-slate-900 rounded p-4 text-slate-300 min-h-[100px] border border-slate-800 font-sans">
                     "{intent.raw_text}"
                   </div>
                 </div>
               </div>
             </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}
