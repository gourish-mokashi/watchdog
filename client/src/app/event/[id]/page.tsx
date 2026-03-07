"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Prism from "prismjs";
import "prismjs/components/prism-json";
import "prism-themes/themes/prism-atom-dark.css";

interface EventDetail {
  id: string;
  sourceTool: string;
  timestamp: string;
  severity: number;
  description: string;
  rawPayload: Record<string, unknown>;
  reportUrl: string;
  count: number;
  askedAnalysis: boolean;
  finished: boolean;
}

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const codeRef = useRef<HTMLElement>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/events/${id}`);
        if (!res.ok) throw new Error(`Event not found (${res.status})`);
        const data: EventDetail = await res.json();
        setEvent(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load event");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  useEffect(() => {
    if (event && codeRef.current) {
      Prism.highlightElement(codeRef.current);
    }
  }, [event]);

  function severityColor(severity: number) {
    if (severity >= 0.8) return "text-red-500";
    if (severity >= 0.5) return "text-yellow-500";
    return "text-green-500";
  }

  function severityLabel(severity: number) {
    if (severity >= 0.8) return "Critical";
    if (severity >= 0.5) return "Medium";
    return "Low";
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
        <p className="text-sm text-zinc-500">Loading event…</p>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-50 dark:bg-black">
        <p className="text-sm text-red-500">{error ?? "Event not found"}</p>
        <button
          onClick={() => router.push("/")}
          className="text-sm text-blue-600 underline hover:text-blue-500 dark:text-blue-400"
        >
          Back to events
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 font-sans dark:bg-black">
      <div className="mx-auto max-w-5xl px-6 py-10">
        {/* Back button */}
        <button
          onClick={() => router.push("/")}
          className="mb-6 flex items-center gap-1 text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:hover:text-zinc-200"
        >
          <span>←</span> Back to events
        </button>

        {/* Header */}
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              {event.sourceTool}
            </h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {event.id}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                event.finished
                  ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                  : "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300"
              }`}
            >
              {event.finished ? "Analyzed" : "Pending"}
            </span>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                event.askedAnalysis
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                  : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
              }`}
            >
              {event.askedAnalysis ? "Analysis Requested" : "No Analysis"}
            </span>
          </div>
        </div>

        {/* Info grid */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Severity
            </p>
            <p
              className={`mt-1 text-xl font-bold ${severityColor(event.severity)}`}
            >
              {event.severity.toFixed(2)}{" "}
              <span className="text-sm font-medium">
                ({severityLabel(event.severity)})
              </span>
            </p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Timestamp
            </p>
            <p className="mt-1 text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {new Date(event.timestamp).toLocaleString()}
            </p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Occurrences
            </p>
            <p className="mt-1 text-xl font-bold text-zinc-900 dark:text-zinc-100">
              {event.count}
            </p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Report
            </p>
            {event.reportUrl ? (
              <a
                href={event.reportUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-block text-sm font-medium text-blue-600 underline hover:text-blue-500 dark:text-blue-400"
              >
                View Report
              </a>
            ) : (
              <p className="mt-1 text-sm text-zinc-400">Not available</p>
            )}
          </div>
        </div>

        {/* Description */}
        <div className="mb-8 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Description
          </h2>
          <p className="text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
            {event.description}
          </p>
        </div>

        {/* Raw Payload */}
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800">
          <div className="border-b border-zinc-200 bg-white px-5 py-3 dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Raw Payload
            </h2>
          </div>
          <pre className="!m-0 !rounded-none !rounded-b-lg !text-xs !leading-relaxed">
            <code ref={codeRef} className="language-json">
              {JSON.stringify(event.rawPayload, null, 2)}
            </code>
          </pre>
        </div>
      </div>
    </div>
  );
}
