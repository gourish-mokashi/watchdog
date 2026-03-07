"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [rows, setRows] = useState(10);
  const [sortOrder, setSortOrder] = useState<"lf" | "of">("lf");
  const [validationError, setValidationError] = useState<string | null>(null);
  const router = useRouter();

  function fetchEvents() {
    if (!start || !end) {
      setValidationError("Please select both Start Date and End Date.");
      return;
    }

    setValidationError(null);
    const params = new URLSearchParams();
    if (start) params.set("start", start);
    if (end) params.set("end", end);
    params.set("rows", String(rows));
    params.set(sortOrder, "true");
    router.push(`/events/all?${params.toString()}`);
  }

  return (
    <div className="min-h-screen bg-zinc-50 font-sans dark:bg-black">
      <div className="mx-auto max-w-7xl px-6 py-10">
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
                if (validationError) setValidationError(null);
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
                if (validationError) setValidationError(null);
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
            onClick={fetchEvents}
            className="rounded-md bg-zinc-900 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            Fetch Events
          </button>
        </div>

        {validationError && (
          <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
            {validationError}
          </div>
        )}

        <p className="mt-10 text-center text-sm text-zinc-400">
          Set your filters and click Fetch Events to view results.
        </p>
      </div>
    </div>
  );
}
