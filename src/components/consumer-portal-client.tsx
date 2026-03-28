"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import type { IntentDocument } from "@/lib/db/firestore-mock";

type InputMode = "text" | "image" | "voice";
type SubmitStatus = "idle" | "loading" | "success" | "error";

const ConsumerImagePanel = dynamic(
  () => import("@/components/consumer-image-panel"),
  {
    loading: () => (
      <div className="h-40 rounded-xl border border-slate-200 bg-slate-50" />
    ),
  }
);

const ConsumerVoicePanel = dynamic(
  () => import("@/components/consumer-voice-panel"),
  {
    loading: () => (
      <div className="flex h-40 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-500">
        Preparing microphone controls...
      </div>
    ),
  }
);

export default function ConsumerPortalClient() {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<SubmitStatus>("idle");
  const [intentResult, setIntentResult] = useState<IntentDocument | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [activeMode, setActiveMode] = useState<InputMode>("text");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const errorResetTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (status === "idle" && activeMode === "text") {
      textareaRef.current?.focus();
    }
  }, [activeMode, status]);

  useEffect(() => {
    return () => {
      if (errorResetTimeoutRef.current) {
        window.clearTimeout(errorResetTimeoutRef.current);
      }
    };
  }, []);

  const clearErrorSoon = (delayMs: number) => {
    if (errorResetTimeoutRef.current) {
      window.clearTimeout(errorResetTimeoutRef.current);
    }

    errorResetTimeoutRef.current = window.setTimeout(() => {
      setStatus("idle");
      errorResetTimeoutRef.current = null;
    }, delayMs);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!text.trim() && !selectedImage && !audioBlob) {
      return;
    }

    setStatus("loading");
    setErrorMessage("");

    if (errorResetTimeoutRef.current) {
      window.clearTimeout(errorResetTimeoutRef.current);
      errorResetTimeoutRef.current = null;
    }

    try {
      const formData = new FormData();

      if (text.trim()) {
        formData.append("input", text);
      }

      if (selectedImage) {
        formData.append("image", selectedImage);
      }

      if (audioBlob) {
        formData.append("audio", audioBlob, "recording.webm");
      }

      const response = await fetch("/api/ingest", {
        method: "POST",
        body: formData,
      });

      if (response.status === 429) {
        setErrorMessage(
          "You are sending requests too quickly. Please wait a moment."
        );
        setStatus("error");
        clearErrorSoon(5000);
        return;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "API Error");
      }

      const data = await response.json();
      setIntentResult(data.document);
      setStatus("success");
      setText("");
      setSelectedImage(null);
      setAudioBlob(null);
    } catch (error) {
      console.error(error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to connect to dispatch center."
      );
      setStatus("error");
      clearErrorSoon(4000);
    }
  };

  const hasInput = Boolean(text.trim() || selectedImage || audioBlob);
  const showImagePanel = activeMode === "image" || Boolean(selectedImage);
  const showVoicePanel = activeMode === "voice" || Boolean(audioBlob);

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/80 sm:p-8">
      {status === "idle" && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div
            className="grid grid-cols-3 gap-2 rounded-2xl bg-slate-100 p-1"
            role="tablist"
            aria-label="Input modality selector"
          >
            {(["text", "image", "voice"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                role="tab"
                id={`tab-${mode}`}
                aria-selected={activeMode === mode}
                aria-controls={`panel-${mode}`}
                onClick={() => setActiveMode(mode)}
                className={`rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  activeMode === mode
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {mode === "text"
                  ? "Text"
                  : mode === "image"
                    ? "Image"
                    : "Voice"}
              </button>
            ))}
          </div>

          <div
            role="tabpanel"
            id="panel-text"
            aria-labelledby="tab-text"
            hidden={activeMode !== "text"}
          >
            <label htmlFor="text-input" className="sr-only">
              Describe your emergency or situation
            </label>
            <textarea
              ref={textareaRef}
              id="text-input"
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="E.g. I see a large accident on Highway 101 near mile marker 42..."
              className="h-40 w-full resize-none rounded-xl border border-slate-200 p-4 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              maxLength={5000}
              aria-describedby="text-help"
            />
            <p id="text-help" className="mt-1 text-xs text-slate-400">
              {text.length}/5000 characters
            </p>
          </div>

          {showImagePanel && (
            <div
              role="tabpanel"
              id="panel-image"
              aria-labelledby="tab-image"
              hidden={activeMode !== "image"}
            >
              <ConsumerImagePanel
                onImageChange={setSelectedImage}
                text={text}
                onTextChange={setText}
                onError={(message) => {
                  setErrorMessage(message);
                  setStatus("error");
                  clearErrorSoon(3000);
                }}
              />
            </div>
          )}

          {showVoicePanel && (
            <div
              role="tabpanel"
              id="panel-voice"
              aria-labelledby="tab-voice"
              hidden={activeMode !== "voice"}
            >
              <ConsumerVoicePanel
                audioBlob={audioBlob}
                onAudioChange={setAudioBlob}
                text={text}
                onTextChange={setText}
                onError={(message) => {
                  setErrorMessage(message);
                  setStatus("error");
                  clearErrorSoon(3000);
                }}
              />
            </div>
          )}

          <button
            type="submit"
            disabled={!hasInput}
            className="w-full rounded-xl bg-blue-600 py-3 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 focus:outline-none focus:ring-4 focus:ring-blue-200"
            aria-label="Submit information for AI analysis"
          >
            Submit for Analysis
          </button>
        </form>
      )}

      {status === "loading" && (
        <div
          className="flex flex-col items-center justify-center px-4 py-10 text-center"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <div
            className="mb-6 h-16 w-16 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600"
            aria-hidden="true"
          />
          <h2 className="mb-2 text-2xl font-semibold text-slate-800">
            Analyzing your request
          </h2>
          <p className="text-slate-500">
            Gemini is processing your multi-modal input and structuring it for
            dispatch.
          </p>
        </div>
      )}

      {status === "success" && intentResult && (
        <div className="flex flex-col">
          <div className="mb-6 border-b border-slate-100 pb-4">
            <h2 className="text-xl font-semibold text-slate-800">
              LLM Extraction Complete
            </h2>
            <p className="text-sm text-slate-500">
              Gemini analyzed your{" "}
              {intentResult.input_modalities?.join(" + ") || "text"} input
            </p>
          </div>

          <div className="space-y-4 text-left">
            <div>
              <h3 className="mb-1 text-xs font-bold uppercase text-slate-400">
                Extracted Intent
              </h3>
              <p className="font-medium text-slate-800">
                {intentResult.intent_summary}
              </p>
            </div>
            <div>
              <h3 className="mb-1 text-xs font-bold uppercase text-slate-400">
                Calculated Urgency
              </h3>
              <span
                className={`inline-block rounded px-3 py-1 text-xs font-bold ${
                  intentResult.urgency >= 4
                    ? "bg-red-100 text-red-700"
                    : intentResult.urgency >= 3
                      ? "bg-amber-100 text-amber-700"
                      : "bg-green-100 text-green-700"
                }`}
                role="status"
              >
                Level {intentResult.urgency} / 5
              </span>
            </div>
            <div>
              <h3 className="mb-1 text-xs font-bold uppercase text-slate-400">
                Recommended Action
              </h3>
              <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 font-mono text-sm text-slate-700">
                {">"} {intentResult.recommended_action}
              </div>
            </div>
            {intentResult.attachments.length > 0 && (
              <div>
                <h3 className="mb-2 text-xs font-bold uppercase text-slate-400">
                  Attached Media
                </h3>
                <div className="space-y-3">
                  {intentResult.attachments.map((attachment) => (
                    <div
                      key={attachment.gcs_uri}
                      className="rounded-xl border border-slate-100 bg-slate-50 p-2"
                    >
                      {attachment.type === "image" ? (
                        <div className="space-y-2">
                          <Image
                            src={attachment.public_url}
                            alt={attachment.original_name}
                            width={400}
                            height={192}
                            className="h-48 w-full rounded-lg object-cover shadow-sm"
                          />
                          <p className="truncate px-1 text-[10px] text-slate-400">
                            {attachment.original_name}
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2 p-2">
                          <p className="truncate text-xs font-medium text-slate-700">
                            {attachment.original_name}
                          </p>
                          <audio controls className="h-8 w-full origin-left scale-90">
                            <source
                              src={attachment.public_url}
                              type={attachment.mime_type}
                            />
                            Your browser does not support the audio element.
                          </audio>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              setStatus("idle");
              setIntentResult(null);
            }}
            className="mt-8 w-full rounded-xl bg-slate-100 py-3 font-medium text-slate-700 transition-colors hover:bg-slate-200 focus:outline-none focus:ring-4 focus:ring-slate-300"
          >
            Test Another Scenario
          </button>
        </div>
      )}

      {status === "error" && (
        <div
          className="flex flex-col items-center justify-center rounded-2xl border border-red-100 bg-red-50 p-8 text-center"
          role="alert"
          aria-live="assertive"
        >
          <h2 className="mb-2 text-xl font-semibold text-red-800">
            {errorMessage.includes("rate") || errorMessage.includes("quickly")
              ? "Rate Limit Reached"
              : "Processing Error"}
          </h2>
          <p className="text-red-600">
            {errorMessage ||
              "We couldn't reach the dispatch center. Please try again."}
          </p>
        </div>
      )}
    </div>
  );
}
