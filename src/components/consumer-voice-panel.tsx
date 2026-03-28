"use client";

import { useEffect, useRef, useState } from "react";

interface ConsumerVoicePanelProps {
  audioBlob: Blob | null;
  onAudioChange: (blob: Blob | null) => void;
  text: string;
  onTextChange: (value: string) => void;
  onError: (message: string) => void;
}

export default function ConsumerVoicePanel({
  audioBlob,
  onAudioChange,
  text,
  onTextChange,
  onError,
}: ConsumerVoicePanelProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
      }

      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });

      streamRef.current = stream;
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      setRecordingDuration(0);
      onAudioChange(null);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        onAudioChange(blob);
        stopStream();
      };

      mediaRecorder.start();
      setIsRecording(true);
      timerRef.current = window.setInterval(() => {
        setRecordingDuration((current) => current + 1);
      }, 1000);
    } catch {
      onError(
        "Microphone access denied. Please allow microphone permissions."
      );
    }
  };

  const stopRecording = () => {
    if (!mediaRecorderRef.current || !isRecording) {
      return;
    }

    mediaRecorderRef.current.stop();
    setIsRecording(false);

    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  return (
    <>
      <div className="flex h-40 flex-col items-center justify-center gap-4">
        {!audioBlob ? (
          <>
            <button
              type="button"
              onClick={isRecording ? stopRecording : startRecording}
              className={`flex h-20 w-20 items-center justify-center rounded-full text-sm font-medium text-white transition-colors focus:outline-none focus:ring-4 ${
                isRecording
                  ? "bg-red-500 hover:bg-red-600 focus:ring-red-200"
                  : "bg-blue-600 hover:bg-blue-700 focus:ring-blue-200"
              }`}
              aria-label={isRecording ? "Stop recording" : "Start voice recording"}
            >
              {isRecording ? "Stop" : "Record"}
            </button>
            <span className="text-sm text-slate-500" aria-live="polite">
              {isRecording
                ? `Recording... ${recordingDuration}s`
                : "Tap to start recording"}
            </span>
          </>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="rounded-xl bg-slate-100 px-4 py-2 text-sm text-slate-700">
              Recording captured ({recordingDuration}s)
            </div>
            <button
              type="button"
              onClick={() => {
                onAudioChange(null);
                setRecordingDuration(0);
              }}
              className="rounded text-sm text-red-500 underline focus:outline-none focus:ring-2 focus:ring-red-200 hover:text-red-600"
              aria-label="Discard voice recording"
            >
              Discard & re-record
            </button>
          </div>
        )}
      </div>

      <label
        htmlFor="voice-context"
        className="mb-1 mt-3 block text-xs text-slate-500"
      >
        Optional: Add text context
      </label>
      <input
        id="voice-context"
        type="text"
        value={text}
        onChange={(event) => onTextChange(event.target.value)}
        placeholder="E.g. This recording is from the scene..."
        className="w-full rounded-xl border border-slate-200 p-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </>
  );
}
