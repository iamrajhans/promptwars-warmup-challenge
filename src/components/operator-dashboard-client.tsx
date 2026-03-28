"use client";

import { useEffect, useState } from 'react';
import { ShieldAlert, Check, Clock, Image as ImageIcon, Mic, LogOut, User, FileAudio } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { signOut } from "next-auth/react";

interface Attachment {
  type: 'image' | 'audio';
  gcs_uri: string;
  public_url: string;
  original_name: string;
  mime_type: string;
}

interface Intent {
  id: string;
  raw_text: string;
  intent_summary: string;
  urgency: number;
  recommended_action: string;
  status: 'pending' | 'acknowledged' | 'resolved';
  timestamp: string;
  input_modalities?: string[];
  attachments?: Attachment[];
}

interface UserSession {
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

export default function OperatorDashboardClient({ user }: { user: UserSession }) {
  const [intents, setIntents] = useState<Intent[]>([]);

  // Polling mechanism (mock real-time)
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
    setIntents(prev => prev.map(i => i.id === id ? { ...i, status: 'acknowledged' } : i));
    await fetch('/api/ingest', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: 'acknowledged' })
    });
  };

  const pendingCount = intents.filter(i => i.status === 'pending').length;
  const criticalCount = intents.filter(i => i.urgency >= 4 && i.status === 'pending').length;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-8" role="main" aria-label="Operator Command Center">
      {/* Skip to incidents */}
      <a
        href="#incident-feed"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-blue-600 focus:text-white focus:px-4 focus:py-2 focus:rounded"
      >
        Skip to incident feed
      </a>

      <header className="mb-8 flex items-center justify-between border-b border-slate-800 pb-4" role="banner">
        <div className="flex items-center gap-6">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <ShieldAlert className="text-red-500 w-8 h-8" aria-hidden="true" />
              Command Center
            </h1>
            <p className="text-slate-400 text-sm mt-2">Universal Bridge — Operator View</p>
          </div>
          
          <div className="h-10 w-px bg-slate-800" aria-hidden="true" />
          
          <div className="flex items-center gap-3 bg-slate-800/50 px-4 py-2 rounded-lg border border-slate-700/50">
            {user.image ? (
              <img src={user.image} alt="" className="w-8 h-8 rounded-full border border-slate-600" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center border border-slate-600">
                <User className="w-4 h-4 text-slate-400" />
              </div>
            )}
            <div className="text-sm">
              <p className="text-white font-medium leading-none">{user.name || "Operator"}</p>
              <p className="text-slate-500 text-xs mt-1">{user.email}</p>
            </div>
            <button 
              onClick={() => signOut()}
              className="ml-2 p-2 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors group"
              title="Sign Out"
              aria-label="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {criticalCount > 0 && (
            <div
              className="bg-red-900/50 border border-red-700 px-4 py-2 rounded-lg text-sm font-bold text-red-300 animate-pulse"
              role="status"
              aria-live="assertive"
            >
              {criticalCount} CRITICAL
            </div>
          )}
          <div className="bg-slate-800 px-4 py-2 rounded-lg text-sm font-mono flex items-center gap-2">
            <span aria-label="System online indicator" className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            System Online
          </div>
          <div className="bg-slate-800 px-3 py-2 rounded-lg text-sm">
            <span className="text-slate-400">Queue: </span>
            <span className="font-bold text-white" aria-live="polite">{pendingCount}</span>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4" id="incident-feed" role="feed" aria-label="Incident feed">
        <AnimatePresence>
          {intents.length === 0 && (
            <div className="text-center py-32 text-slate-500 border-2 border-dashed border-slate-800 rounded-2xl" role="status">
              No active incidents in the pipeline.
            </div>
          )}
          {intents.map((intent) => (
            <motion.article
              key={intent.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              role={intent.urgency >= 4 && intent.status === 'pending' ? 'alert' : 'article'}
              aria-label={`Incident: ${intent.intent_summary}. Severity level ${intent.urgency}. Status: ${intent.status}.`}
              className={`p-6 rounded-xl border ${
                intent.status === 'acknowledged' ? 'bg-slate-800 border-slate-700 opacity-60' :
                intent.urgency >= 4 ? 'bg-red-950/40 border-red-900/50' : 'bg-amber-950/20 border-amber-900/40'
              }`}
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className={`px-3 py-1 text-xs font-bold rounded ${
                    intent.urgency >= 4 ? 'bg-red-500 text-white' :
                    intent.urgency >= 3 ? 'bg-amber-500 text-amber-950' :
                    'bg-green-600 text-white'
                  }`}>
                    SEVERITY {intent.urgency}
                  </div>
                  {/* Modality badges */}
                  {intent.input_modalities?.map(m => (
                    <span key={m} className="flex items-center gap-1 bg-slate-800 px-2 py-1 rounded text-xs text-slate-300">
                      {m === 'image' && <ImageIcon className="w-3 h-3" aria-hidden="true" />}
                      {m === 'audio' && <Mic className="w-3 h-3" aria-hidden="true" />}
                      {m}
                    </span>
                  ))}
                  <div className="text-sm font-mono text-slate-400 flex items-center gap-1">
                    <Clock className="w-4 h-4" aria-hidden="true" />
                    <time dateTime={intent.timestamp}>
                      {new Date(intent.timestamp).toLocaleTimeString()}
                    </time>
                  </div>
                </div>
                {intent.status === 'pending' ? (
                  <button
                    onClick={() => handleAcknowledge(intent.id)}
                    className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded text-sm font-medium transition-colors flex items-center gap-2 focus:ring-4 focus:ring-blue-400 focus:outline-none"
                    aria-label={`Acknowledge incident: ${intent.intent_summary}`}
                  >
                    <Check className="w-4 h-4" aria-hidden="true" /> Acknowledge
                  </button>
                ) : (
                  <span className="text-green-500 text-sm font-bold flex items-center gap-1" aria-label="Acknowledged">
                    <Check className="w-4 h-4" aria-hidden="true" /> Acknowledged
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
                  <h3 className="text-xs uppercase font-bold text-slate-500 mb-2">Raw User Input</h3>
                  <div className="bg-slate-900 rounded p-4 text-slate-300 min-h-[80px] border border-slate-800 font-sans text-sm">
                    &quot;{intent.raw_text}&quot;
                  </div>
                  
                  {/* Media Rendering */}
                  {intent.attachments && intent.attachments.length > 0 && (
                    <div className="mt-4">
                      <h3 className="text-xs uppercase font-bold text-slate-500 mb-3">Attached Media</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {intent.attachments.map((a, i) => (
                          <div key={i} className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden flex flex-col">
                            {a.type === 'image' ? (
                              <>
                                <div className="aspect-video w-full bg-slate-800 flex items-center justify-center overflow-hidden">
                                  <img 
                                    src={a.public_url} 
                                    alt={a.original_name} 
                                    className="w-full h-full object-contain hover:scale-105 transition-transform"
                                  />
                                </div>
                                <div className="p-2 border-t border-slate-800 flex items-center justify-between">
                                  <span className="text-[10px] text-slate-500 flex items-center gap-1 truncate">
                                    <ImageIcon className="w-3 h-3" /> {a.original_name}
                                  </span>
                                  <a 
                                    href={a.public_url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-[10px] text-blue-400 hover:text-blue-300 underline"
                                  >
                                    View Full
                                  </a>
                                </div>
                              </>
                            ) : (
                              <div className="p-3">
                                <div className="flex items-center gap-2 mb-2">
                                  <FileAudio className="w-3 h-3 text-blue-400" />
                                  <span className="text-[10px] text-slate-400 truncate font-mono">{a.original_name}</span>
                                </div>
                                <audio controls className="w-full h-8 scale-75 origin-left">
                                  <source src={a.public_url} type={a.mime_type} />
                                </audio>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.article>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
