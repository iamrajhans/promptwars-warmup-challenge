"use client";

import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertCircle, Send, CheckCircle, Image as ImageIcon,
  Mic, MicOff, Type as TypeIcon, X, FileAudio, Upload
} from 'lucide-react';

type InputMode = 'text' | 'image' | 'voice';
type SubmitStatus = 'idle' | 'loading' | 'success' | 'error';

export default function ConsumerPortal() {
  const [text, setText] = useState('');
  const [status, setStatus] = useState<SubmitStatus>('idle');
  const [intentResult, setIntentResult] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [activeMode, setActiveMode] = useState<InputMode>('text');

  // Image state
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Voice state
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Accessibility: focus management
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (status === 'idle' && textareaRef.current && activeMode === 'text') {
      textareaRef.current.focus();
    }
  }, [status, activeMode]);

  // Image handlers
  const handleImageSelect = useCallback((file: File) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setErrorMessage('Only JPEG, PNG, and WebP images are supported.');
      setStatus('error');
      setTimeout(() => setStatus('idle'), 3000);
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage('Image must be under 10MB.');
      setStatus('error');
      setTimeout(() => setStatus('idle'), 3000);
      return;
    }
    setSelectedImage(file);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleImageSelect(file);
  }, [handleImageSelect]);

  const clearImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  // Voice handlers
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        stream.getTracks().forEach(t => t.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);
      timerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } catch {
      setErrorMessage('Microphone access denied. Please allow microphone permissions.');
      setStatus('error');
      setTimeout(() => setStatus('idle'), 3000);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const clearAudio = () => {
    setAudioBlob(null);
    setRecordingDuration(0);
  };

  // Submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() && !selectedImage && !audioBlob) return;

    setStatus('loading');
    setErrorMessage('');

    try {
      const formData = new FormData();
      if (text.trim()) formData.append('input', text);
      if (selectedImage) formData.append('image', selectedImage);
      if (audioBlob) formData.append('audio', audioBlob, 'recording.webm');

      const res = await fetch('/api/ingest', {
        method: 'POST',
        body: formData,
      });

      if (res.status === 429) {
        setErrorMessage('You are sending requests too quickly. Please wait a moment.');
        setStatus('error');
        setTimeout(() => setStatus('idle'), 5000);
        return;
      }
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'API Error');
      }

      const data = await res.json();
      setIntentResult(data.document);
      setStatus('success');
      setText('');
      clearImage();
      clearAudio();
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Failed to connect to dispatch center.');
      setStatus('error');
      setTimeout(() => setStatus('idle'), 4000);
    }
  };

  const hasInput = text.trim() || selectedImage || audioBlob;

  const modeButtons: { mode: InputMode; icon: any; label: string }[] = [
    { mode: 'text', icon: TypeIcon, label: 'Text' },
    { mode: 'image', icon: ImageIcon, label: 'Image' },
    { mode: 'voice', icon: Mic, label: 'Voice' },
  ];

  return (
    <main
      ref={mainRef}
      className="min-h-screen bg-slate-50 flex items-center justify-center p-4"
      role="main"
      aria-label="Universal Bridge - Emergency Intake Form"
    >
      {/* Skip to content link */}
      <a
        href="#intake-form"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-blue-600 focus:text-white focus:px-4 focus:py-2 focus:rounded"
      >
        Skip to intake form
      </a>

      <div className="max-w-xl w-full" id="intake-form">
        <AnimatePresence mode="wait">
          {/* ── IDLE: Input Form ── */}
          {status === 'idle' && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-white rounded-2xl shadow-xl p-8 border border-slate-100"
            >
              <h1 className="text-3xl font-semibold text-slate-900 mb-2">
                How can we help?
              </h1>
              <p className="text-slate-500 mb-6">
                Describe your situation using text, upload an image, or record a voice message.
              </p>

              {/* ── Mode Tabs ── */}
              <div
                className="flex gap-1 mb-6 bg-slate-100 rounded-xl p-1"
                role="tablist"
                aria-label="Input modality selector"
              >
                {modeButtons.map(({ mode, icon: Icon, label }) => (
                  <button
                    key={mode}
                    role="tab"
                    id={`tab-${mode}`}
                    aria-selected={activeMode === mode}
                    aria-controls={`panel-${mode}`}
                    onClick={() => setActiveMode(mode)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all
                      ${activeMode === mode
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                      }`}
                  >
                    <Icon className="w-4 h-4" aria-hidden="true" />
                    {label}
                  </button>
                ))}
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* ── Text Panel ── */}
                <div
                  role="tabpanel"
                  id="panel-text"
                  aria-labelledby="tab-text"
                  hidden={activeMode !== 'text'}
                >
                  <label htmlFor="text-input" className="sr-only">
                    Describe your emergency or situation
                  </label>
                  <textarea
                    ref={textareaRef}
                    id="text-input"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="E.g. I see a large accident on Highway 101 near mile marker 42..."
                    className="w-full h-40 p-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none text-slate-800"
                    maxLength={5000}
                    aria-describedby="text-help"
                  />
                  <p id="text-help" className="text-xs text-slate-400 mt-1">
                    {text.length}/5000 characters
                  </p>
                </div>

                {/* ── Image Panel ── */}
                <div
                  role="tabpanel"
                  id="panel-image"
                  aria-labelledby="tab-image"
                  hidden={activeMode !== 'image'}
                >
                  {!imagePreview ? (
                    <div
                      onDrop={handleDrop}
                      onDragOver={(e) => e.preventDefault()}
                      onClick={() => imageInputRef.current?.click()}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') imageInputRef.current?.click(); }}
                      tabIndex={0}
                      role="button"
                      aria-label="Upload an image. Click or drag and drop."
                      className="w-full h-40 border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      <Upload className="w-8 h-8 text-slate-400" aria-hidden="true" />
                      <span className="text-sm text-slate-500">
                        Click or drag an image here
                      </span>
                      <span className="text-xs text-slate-400">
                        JPEG, PNG, WebP (max 10MB)
                      </span>
                    </div>
                  ) : (
                    <div className="relative">
                      <img
                        src={imagePreview}
                        alt="Selected image preview"
                        className="w-full h-40 object-cover rounded-xl border border-slate-200"
                      />
                      <button
                        type="button"
                        onClick={clearImage}
                        className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                        aria-label="Remove selected image"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleImageSelect(e.target.files[0])}
                    aria-hidden="true"
                    tabIndex={-1}
                  />
                  {/* Optional text context alongside image */}
                  <label htmlFor="image-context" className="block text-xs text-slate-500 mt-3 mb-1">
                    Optional: Add text context for the image
                  </label>
                  <input
                    id="image-context"
                    type="text"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="E.g. This photo is from the crash site..."
                    className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm text-slate-800"
                  />
                </div>

                {/* ── Voice Panel ── */}
                <div
                  role="tabpanel"
                  id="panel-voice"
                  aria-labelledby="tab-voice"
                  hidden={activeMode !== 'voice'}
                >
                  <div className="flex flex-col items-center justify-center h-40 gap-4">
                    {!audioBlob ? (
                      <>
                        <button
                          type="button"
                          onClick={isRecording ? stopRecording : startRecording}
                          className={`w-20 h-20 rounded-full flex items-center justify-center transition-all focus:ring-4 focus:outline-none
                            ${isRecording
                              ? 'bg-red-500 hover:bg-red-600 animate-pulse focus:ring-red-200'
                              : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-200'
                            }`}
                          aria-label={isRecording ? 'Stop recording' : 'Start voice recording'}
                        >
                          {isRecording
                            ? <MicOff className="w-8 h-8 text-white" aria-hidden="true" />
                            : <Mic className="w-8 h-8 text-white" aria-hidden="true" />
                          }
                        </button>
                        <span className="text-sm text-slate-500" aria-live="polite">
                          {isRecording
                            ? `Recording... ${recordingDuration}s`
                            : 'Tap to start recording'
                          }
                        </span>
                      </>
                    ) : (
                      <div className="flex flex-col items-center gap-3">
                        <div className="flex items-center gap-2 bg-slate-100 px-4 py-2 rounded-xl">
                          <FileAudio className="w-5 h-5 text-blue-600" aria-hidden="true" />
                          <span className="text-sm text-slate-700">
                            Recording captured ({recordingDuration}s)
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={clearAudio}
                          className="text-sm text-red-500 hover:text-red-600 underline focus:outline-none focus:ring-2 focus:ring-red-200 rounded"
                          aria-label="Discard voice recording"
                        >
                          Discard & re-record
                        </button>
                      </div>
                    )}
                  </div>
                  {/* Optional text context alongside voice */}
                  <label htmlFor="voice-context" className="block text-xs text-slate-500 mt-3 mb-1">
                    Optional: Add text context
                  </label>
                  <input
                    id="voice-context"
                    type="text"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="E.g. This recording is from the scene..."
                    className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm text-slate-800"
                  />
                </div>

                {/* ── Submit Button ── */}
                <button
                  type="submit"
                  disabled={!hasInput}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2 transition-colors focus:ring-4 focus:ring-blue-200 focus:outline-none"
                  aria-label="Submit information for AI analysis"
                >
                  <Send className="w-5 h-5" aria-hidden="true" />
                  Submit for Analysis
                </button>
              </form>
            </motion.div>
          )}

          {/* ── LOADING ── */}
          {status === 'loading' && (
            <motion.div
              key="loading"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl p-12 border border-slate-100 flex flex-col items-center justify-center text-center"
              role="status"
              aria-live="polite"
              aria-busy="true"
            >
              <div
                className="w-16 h-16 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mb-6"
                aria-hidden="true"
              />
              <h2 className="text-2xl font-semibold text-slate-800 mb-2">
                Analyzing your request
              </h2>
              <p className="text-slate-500">
                Gemini is processing your multi-modal input and structuring it for dispatch.
              </p>
            </motion.div>
          )}

          {/* ── SUCCESS: Show LLM Response ── */}
          {status === 'success' && intentResult && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl p-8 border border-slate-100 flex flex-col"
              role="region"
              aria-label="AI Analysis Results"
            >
              <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
                <CheckCircle className="w-8 h-8 text-emerald-500" aria-hidden="true" />
                <div>
                  <h2 className="text-xl font-semibold text-slate-800 text-left">
                    LLM Extraction Complete
                  </h2>
                  <p className="text-slate-500 text-sm text-left">
                    Gemini analyzed your {intentResult.input_modalities?.join(' + ') || 'text'} input
                  </p>
                </div>
              </div>

              <div className="space-y-4 text-left">
                <div>
                  <h3 className="text-xs font-bold uppercase text-slate-400 mb-1">Extracted Intent</h3>
                  <p className="text-slate-800 font-medium">{intentResult.intent_summary}</p>
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase text-slate-400 mb-1">Calculated Urgency</h3>
                  <span
                    className={`inline-block px-3 py-1 text-xs font-bold rounded ${
                      intentResult.urgency >= 4
                        ? 'bg-red-100 text-red-700'
                        : intentResult.urgency >= 3
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-green-100 text-green-700'
                    }`}
                    role="status"
                  >
                    Level {intentResult.urgency} / 5
                  </span>
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase text-slate-400 mb-1">Recommended Action</h3>
                  <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 text-sm text-slate-700 font-mono">
                    {'>'} {intentResult.recommended_action}
                  </div>
                </div>
                {intentResult.attachments && intentResult.attachments.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold uppercase text-slate-400 mb-1">Attachments</h3>
                    <div className="flex gap-2 flex-wrap">
                      {intentResult.attachments.map((a: any, i: number) => (
                        <span key={i} className="bg-blue-50 text-blue-700 text-xs px-2 py-1 rounded-lg">
                          {a.type}: {a.original_name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={() => { setStatus('idle'); setIntentResult(null); }}
                className="mt-8 w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-3 rounded-xl transition-colors focus:ring-4 focus:ring-slate-300 focus:outline-none"
              >
                Test Another Scenario
              </button>
            </motion.div>
          )}

          {/* ── ERROR ── */}
          {status === 'error' && (
            <motion.div
              key="error"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-red-50 rounded-2xl p-8 border border-red-100 flex flex-col items-center justify-center text-center"
              role="alert"
              aria-live="assertive"
            >
              <AlertCircle className="w-12 h-12 text-red-500 mb-4" aria-hidden="true" />
              <h2 className="text-xl font-semibold text-red-800 mb-2">
                {errorMessage.includes('rate') || errorMessage.includes('quickly')
                  ? 'Rate Limit Reached'
                  : 'Processing Error'
                }
              </h2>
              <p className="text-red-600">
                {errorMessage || "We couldn't reach the dispatch center. Please try again."}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
