"use client";

import { useState } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, Send, CheckCircle } from 'lucide-react';

export default function ConsumerPortal() {
  const [text, setText] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [intentResult, setIntentResult] = useState<any>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    setStatus('loading');
    
    try {
      const res = await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: text })
      });

      if (!res.ok) throw new Error('API Error');
      
      const data = await res.json();
      setIntentResult(data.document);
      setStatus('success');
      setText('');
      
      // We no longer auto-reset, so the user can view the extracted payload.
    } catch (err) {
      console.error(err);
      setStatus('error');
      // Auto-reset
      setTimeout(() => setStatus('idle'), 3000);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-xl w-full">
        {status === 'idle' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl shadow-xl p-8 border border-slate-100">
            <h1 className="text-3xl font-semibold text-slate-900 mb-2">How can we help?</h1>
            <p className="text-slate-500 mb-6">Describe your situation, emergency, or symptoms. Our AI will instantly route you to the correct dispatch team.</p>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="E.g. I see a large accident on Highway 101..."
                className="w-full h-40 p-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                required
              />
              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
              >
                <Send className="w-5 h-5" />
                Submit Information
              </button>
            </form>
          </motion.div>
        )}

        {status === 'loading' && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-2xl shadow-xl p-12 border border-slate-100 flex flex-col items-center justify-center text-center">
             <div className="w-16 h-16 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mb-6"></div>
             <h2 className="text-2xl font-semibold text-slate-800 mb-2">Analyzing your request</h2>
             <p className="text-slate-500">Our systems are structuring your data and alerting the nearest available operator.</p>
          </motion.div>
        )}

        {status === 'success' && intentResult && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-2xl shadow-xl p-8 border border-slate-100 flex flex-col">
             <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
               <CheckCircle className="w-8 h-8 text-emerald-500" />
               <div>
                  <h2 className="text-xl font-semibold text-slate-800 text-left">LLM Extraction Complete</h2>
                  <p className="text-slate-500 text-sm text-left">Here is what Gemini determined from your input</p>
               </div>
             </div>
             
             <div className="space-y-4 text-left">
                <div>
                  <h3 className="text-xs font-bold uppercase text-slate-400 mb-1">Extracted Intent</h3>
                  <p className="text-slate-800 font-medium">{intentResult.intent_summary}</p>
                </div>
                <div className="flex items-center gap-4">
                   <div>
                     <h3 className="text-xs font-bold uppercase text-slate-400 mb-1">Calculated Urgency</h3>
                     <span className={`px-3 py-1 text-xs font-bold rounded ${intentResult.urgency >= 4 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                        Level {intentResult.urgency} / 5
                     </span>
                   </div>
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase text-slate-400 mb-1">Recommended Action</h3>
                  <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 text-sm text-slate-700 font-mono">
                     {'>'} {intentResult.recommended_action}
                  </div>
                </div>
             </div>

             <button
                onClick={() => { setStatus('idle'); setIntentResult(null); }}
                className="mt-8 w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-3 rounded-xl transition-colors"
             >
                Test Another Scenario
             </button>
          </motion.div>
        )}
        
        {status === 'error' && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-red-50 rounded-2xl p-8 border border-red-100 flex flex-col items-center justify-center text-center">
             <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
             <h2 className="text-xl font-semibold text-red-800 mb-2">Connection Error</h2>
             <p className="text-red-600">We couldn't reach the dispatch center. Please try again or call local emergency services directly.</p>
          </motion.div>
        )}
      </div>
    </main>
  );
}
