"use client";

import { startTransition, useEffect, useRef, useState } from "react";
import {
  Check,
  Clock,
  FileAudio,
  Image as ImageIcon,
  LogOut,
  Mic,
  ShieldAlert,
  User,
} from "lucide-react";
import { signOut } from "next-auth/react";
import Image from "next/image";
import type { IntentDocument } from "@/lib/db/firestore-mock";

interface UserSession {
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
});

export default function OperatorDashboardClient({
  user,
  initialIntents,
}: {
  user: UserSession;
  initialIntents: IntentDocument[];
}) {
  const [intents, setIntents] = useState(initialIntents);
  const pollTimeoutRef = useRef<number | null>(null);
  const isFetchingRef = useRef(false);
  const refreshIntentsRef = useRef<(() => Promise<void>) | null>(null);
  const scheduleNextRefreshRef = useRef<((delayMs?: number) => void) | null>(null);

  const pendingCount = intents.filter((intent) => intent.status === "pending").length;
  const criticalCount = intents.filter(
    (intent) => intent.urgency >= 4 && intent.status === "pending"
  ).length;

  useEffect(() => {
    const refreshIntents = async () => {
      if (isFetchingRef.current) {
        return;
      }

      isFetchingRef.current = true;

      try {
        const response = await fetch("/api/ingest", { cache: "no-store" });

        if (!response.ok) {
          return;
        }

        const data = await response.json();

        if (data.intents) {
          startTransition(() => {
            setIntents(data.intents);
          });
        }
      } catch (error) {
        console.error("Failed to fetch intents", error);
      } finally {
        isFetchingRef.current = false;
        scheduleNextRefresh();
      }
    };

    const scheduleNextRefresh = (delayMs?: number) => {
      if (pollTimeoutRef.current) {
        window.clearTimeout(pollTimeoutRef.current);
      }

      const nextDelay = delayMs ?? (document.hidden ? 30000 : 10000);

      pollTimeoutRef.current = window.setTimeout(() => {
        void refreshIntents();
      }, nextDelay);
    };

    refreshIntentsRef.current = refreshIntents;
    scheduleNextRefreshRef.current = scheduleNextRefresh;
    void refreshIntents();

    const handleVisibilityChange = () => {
      scheduleNextRefresh(document.hidden ? 30000 : 2000);

      if (!document.hidden) {
        void refreshIntents();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);

      if (pollTimeoutRef.current) {
        window.clearTimeout(pollTimeoutRef.current);
      }

      refreshIntentsRef.current = null;
      scheduleNextRefreshRef.current = null;
    };
  }, []);

  const handleAcknowledge = async (id: string) => {
    startTransition(() => {
      setIntents((current) =>
        current.map((intent) =>
          intent.id === id ? { ...intent, status: "acknowledged" } : intent
        )
      );
    });

    try {
      await fetch("/api/ingest", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: "acknowledged" }),
      });
    } finally {
      scheduleNextRefreshRef.current?.(1000);
    }
  };

  return (
    <div
      className="min-h-screen bg-slate-900 p-8 text-slate-100"
      role="main"
      aria-label="Operator Command Center"
    >
      <a
        href="#incident-feed"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded focus:bg-blue-600 focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to incident feed
      </a>

      <header
        className="mb-8 flex items-center justify-between border-b border-slate-800 pb-4"
        role="banner"
      >
        <div className="flex items-center gap-6">
          <div>
            <h1 className="flex items-center gap-3 text-3xl font-bold text-white">
              <ShieldAlert className="h-8 w-8 text-red-500" aria-hidden="true" />
              Command Center
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              Universal Bridge - Operator View
            </p>
          </div>

          <div className="h-10 w-px bg-slate-800" aria-hidden="true" />

          <div className="flex items-center gap-3 rounded-lg border border-slate-700/50 bg-slate-800/50 px-4 py-2">
            {user.image ? (
              <Image
                src={user.image}
                alt=""
                width={32}
                height={32}
                className="h-8 w-8 rounded-full border border-slate-600"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-600 bg-slate-700">
                <User className="h-4 w-4 text-slate-400" />
              </div>
            )}
            <div className="text-sm">
              <p className="font-medium leading-none text-white">
                {user.name || "Operator"}
              </p>
              <p className="mt-1 text-xs text-slate-500">{user.email}</p>
            </div>
            <button
              onClick={() => signOut()}
              className="group ml-2 rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-400/10 hover:text-red-400"
              title="Sign Out"
              aria-label="Sign Out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {criticalCount > 0 && (
            <div
              className="rounded-lg border border-red-700 bg-red-900/50 px-4 py-2 text-sm font-bold text-red-300"
              role="status"
              aria-live="assertive"
            >
              {criticalCount} CRITICAL
            </div>
          )}
          <div className="flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-mono">
            <span
              aria-label="System online indicator"
              className="h-2 w-2 rounded-full bg-green-500"
            />
            System Online
          </div>
          <div className="rounded-lg bg-slate-800 px-3 py-2 text-sm">
            <span className="text-slate-400">Queue: </span>
            <span className="font-bold text-white" aria-live="polite">
              {pendingCount}
            </span>
          </div>
        </div>
      </header>

      <div
        className="grid grid-cols-1 gap-4"
        id="incident-feed"
        role="feed"
        aria-label="Incident feed"
      >
        {intents.length === 0 && (
          <div
            className="rounded-2xl border-2 border-dashed border-slate-800 py-32 text-center text-slate-500"
            role="status"
          >
            No active incidents in the pipeline.
          </div>
        )}

        {intents.map((intent) => (
          <article
            key={intent.id}
            role={
              intent.urgency >= 4 && intent.status === "pending" ? "alert" : "article"
            }
            aria-label={`Incident: ${intent.intent_summary}. Severity level ${intent.urgency}. Status: ${intent.status}.`}
            className={`rounded-xl border p-6 ${
              intent.status === "acknowledged"
                ? "border-slate-700 bg-slate-800 opacity-60"
                : intent.urgency >= 4
                  ? "border-red-900/50 bg-red-950/40"
                  : "border-amber-900/40 bg-amber-950/20"
            }`}
          >
            <div className="mb-4 flex items-start justify-between">
              <div className="flex flex-wrap items-center gap-3">
                <div
                  className={`rounded px-3 py-1 text-xs font-bold ${
                    intent.urgency >= 4
                      ? "bg-red-500 text-white"
                      : intent.urgency >= 3
                        ? "bg-amber-500 text-amber-950"
                        : "bg-green-600 text-white"
                  }`}
                >
                  SEVERITY {intent.urgency}
                </div>
                {intent.input_modalities?.map((modality) => (
                  <span
                    key={modality}
                    className="flex items-center gap-1 rounded bg-slate-800 px-2 py-1 text-xs text-slate-300"
                  >
                    {modality === "image" && (
                      <ImageIcon className="h-3 w-3" aria-hidden="true" />
                    )}
                    {modality === "audio" && (
                      <Mic className="h-3 w-3" aria-hidden="true" />
                    )}
                    {modality}
                  </span>
                ))}
                <div className="flex items-center gap-1 text-sm font-mono text-slate-400">
                  <Clock className="h-4 w-4" aria-hidden="true" />
                  <time dateTime={intent.timestamp}>
                    {timeFormatter.format(new Date(intent.timestamp))}
                  </time>
                </div>
              </div>

              {intent.status === "pending" ? (
                <button
                  onClick={() => handleAcknowledge(intent.id)}
                  className="flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm font-medium transition-colors hover:bg-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-400"
                  aria-label={`Acknowledge incident: ${intent.intent_summary}`}
                >
                  <Check className="h-4 w-4" aria-hidden="true" />
                  Acknowledge
                </button>
              ) : (
                <span
                  className="flex items-center gap-1 text-sm font-bold text-green-500"
                  aria-label="Acknowledged"
                >
                  <Check className="h-4 w-4" aria-hidden="true" />
                  Acknowledged
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div>
                <h3 className="mb-2 text-xs font-bold uppercase text-slate-500">
                  AI Extracted Intent
                </h3>
                <p className="mb-4 text-lg font-medium text-white">
                  {intent.intent_summary}
                </p>

                <h3 className="mb-2 text-xs font-bold uppercase text-slate-500">
                  Recommended Action
                </h3>
                <div className="rounded border border-slate-800 bg-slate-900/50 p-3 font-mono text-sm text-emerald-400">
                  {">"} {intent.recommended_action}
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-xs font-bold uppercase text-slate-500">
                  Raw User Input
                </h3>
                <div className="min-h-[80px] rounded border border-slate-800 bg-slate-900 p-4 text-sm text-slate-300">
                  &quot;{intent.raw_text}&quot;
                </div>

                {intent.attachments.length > 0 && (
                  <div className="mt-4">
                    <h3 className="mb-3 text-xs font-bold uppercase text-slate-500">
                      Attached Media
                    </h3>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {intent.attachments.map((attachment) => (
                        <div
                          key={attachment.gcs_uri}
                          className="flex flex-col overflow-hidden rounded-lg border border-slate-800 bg-slate-900"
                        >
                          {attachment.type === "image" ? (
                            <>
                              <div className="flex aspect-video w-full items-center justify-center overflow-hidden bg-slate-800">
                                <Image
                                  src={attachment.public_url}
                                  alt={attachment.original_name}
                                  width={320}
                                  height={180}
                                  className="h-full w-full object-contain"
                                />
                              </div>
                              <div className="flex items-center justify-between border-t border-slate-800 p-2">
                                <span className="flex truncate text-[10px] text-slate-500">
                                  {attachment.original_name}
                                </span>
                                <a
                                  href={attachment.public_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[10px] text-blue-400 underline hover:text-blue-300"
                                >
                                  View Full
                                </a>
                              </div>
                            </>
                          ) : (
                            <div className="p-3">
                              <div className="mb-2 flex items-center gap-2">
                                <FileAudio className="h-3 w-3 text-blue-400" />
                                <span className="truncate font-mono text-[10px] text-slate-400">
                                  {attachment.original_name}
                                </span>
                              </div>
                              <audio controls className="h-8 w-full origin-left scale-75">
                                <source
                                  src={attachment.public_url}
                                  type={attachment.mime_type}
                                />
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
          </article>
        ))}
      </div>
    </div>
  );
}
