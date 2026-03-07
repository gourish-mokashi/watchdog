"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface Event {
  id: string;
  sourceTool: string;
  timestamp: string;
  priority: string;
  description: string;
  reportUrl: string;
  count: number;
  askedAnalysis: boolean;
  finished: boolean;
}

export default function EventsAllPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [start, setStart] = useState(searchParams.get("start") ?? "");
  const [end, setEnd] = useState(searchParams.get("end") ?? "");
  const [rows, setRows] = useState(Number(searchParams.get("rows")) || 10);
  const [sortOrder, setSortOrder] = useState<"lf" | "of">(
    searchParams.has("of") ? "of" : "lf",
  );

  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const doFetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/events/all?${searchParams.toString()}`);
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      setEvents(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [searchParams]);

  useEffect(() => {
    doFetch();
  }, [doFetch]);

  function applyFilters() {
    if (!start || !end) {
      setError("Please select both Start Date and End Date.");
      return;
    }

    const params = new URLSearchParams();
    if (start) params.set("start", start);
    if (end) params.set("end", end);
    params.set("rows", String(rows));
    params.set(sortOrder, "true");
    router.push(`/events/all?${params.toString()}`);
  }

  function priorityColor(priority: string) {
    if (priority === "Critical") return "text-red-500";
    if (priority === "Medium") return "text-yellow-500";
    return "text-green-500";
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
        <p className="text-sm text-zinc-500">Loading events…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 font-sans dark:bg-black">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <button
          onClick={() => router.push("/")}
          className="mb-6 flex items-center gap-1 text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:hover:text-zinc-200"
        >
          <span>←</span> Back to filters
        </button>

        <h1 className="mb-8 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Watchdog — Events
        </h1>

        {/* Filters */}
        <div className="mb-6 flex flex-wrap items-end gap-4 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Start Date
            </label>
            <input
              type="datetime-local"
              value={start}
              onChange={(e) => {
                setStart(e.target.value);
                if (error) setError(null);
              }}
              className="rounded-md border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              End Date
            </label>
            <input
              type="datetime-local"
              value={end}
              onChange={(e) => {
                setEnd(e.target.value);
                if (error) setError(null);
              }}
              className="rounded-md border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Rows
            </label>
            <input
              type="number"
              min={1}
              value={rows}
              onChange={(e) => setRows(Number(e.target.value))}
              className="w-24 rounded-md border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Sort Order
            </label>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as "lf" | "of")}
              className="rounded-md border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            >
              <option value="lf">Latest First</option>
              <option value="of">Oldest First</option>
            </select>
          </div>

          <button
            onClick={applyFilters}
            className="rounded-md bg-zinc-900 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            Fetch Events
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
            {error}
          </div>
        )}

        {events.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-100 text-xs font-medium uppercase tracking-wider text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                <tr>
                  <th className="px-4 py-3">Source Tool</th>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Occurrence</th>
                  <th className="px-4 py-3">Analysis</th>
                  <th className="px-4 py-3">Finished</th>
                  <th className="px-4 py-3">Report</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-800 dark:bg-zinc-950">
                {events.map((event) => (
                  <tr
                    key={event.id}
                    onClick={() => router.push(`/event/${event.id}`)}
                    className="cursor-pointer transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900"
                  >
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">
                      {event.sourceTool}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {new Date(event.timestamp).toLocaleString()}
                    </td>
                    <td
                      className={`whitespace-nowrap px-4 py-3 font-semibold ${priorityColor(event.priority)}`}
                    >
                      {event.priority}
                    </td>
                    <td className="max-w-xs truncate px-4 py-3 text-zinc-700 dark:text-zinc-300">
                      {event.description}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-center text-zinc-600 dark:text-zinc-400">
                      {event.count}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                          event.askedAnalysis
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                            : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                        }`}
                      >
                        {event.askedAnalysis ? "Yes" : "No"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                          event.finished
                            ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                            : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                        }`}
                      >
                        {event.finished ? "Analyzed" : "Pending"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {event.reportUrl ? (
                        <a
                          href={event.reportUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-blue-600 underline hover:text-blue-500 dark:text-blue-400"
                        >
                          View
                        </a>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          !error && (
            <p className="mt-10 text-center text-sm text-zinc-400">
              No events found for the given filters.
            </p>
          )
        )}
      </div>
    </div>
  );
}
