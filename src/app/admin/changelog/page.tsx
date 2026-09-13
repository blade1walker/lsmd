"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Search } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { fetchList, errorMessage } from "@/lib/fetch-json";
import type { ChangelogEntry, ChangeType } from "@/lib/changelog";

const TYPES: { key: ChangeType; label: string; badge: string }[] = [
  { key: "feature", label: "New", badge: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" },
  { key: "improvement", label: "Improved", badge: "border-sky-500/30 bg-sky-500/10 text-sky-400" },
  { key: "fix", label: "Fixed", badge: "border-amber-500/30 bg-amber-500/10 text-amber-400" },
  { key: "security", label: "Security", badge: "border-red-500/30 bg-red-500/10 text-red-400" },
];

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "14 September 2026", from the stored YYYY-MM-DD without any timezone shifting it a day. */
function longDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return month && day ? `${day} ${MONTHS[month - 1]} ${year}` : iso;
}

export default function ChangelogPage() {
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [type, setType] = useState<ChangeType | "">("");

  const load = useCallback(async () => {
    setError(null);
    try {
      setEntries(await fetchList<ChangelogEntry>("/api/changelog"));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(() => {
    const tally: Record<string, number> = {};
    for (const entry of entries) for (const change of entry.changes) tally[change.type] = (tally[change.type] ?? 0) + 1;
    return tally;
  }, [entries]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries
      .map((entry) => ({
        ...entry,
        changes: entry.changes.filter(
          (change) => (!type || change.type === type) && (!q || change.text.toLowerCase().includes(q))
        ),
      }))
      .filter((entry) => entry.changes.length > 0);
  }, [entries, query, type]);

  const total = entries.reduce((n, e) => n + e.changes.length, 0);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </div>
    );
  }
  if (error) return <ErrorState title="Failed to load the changelog" message={error} onRetry={load} />;

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="font-[family-name:var(--font-oswald)] text-2xl font-bold uppercase text-white">Changelog</h1>
        <p className="mt-1 text-sm text-gray-500">
          Every change made to the site — {total} changes across {entries.length} release days.
        </p>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <div className="relative mr-2 w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-600" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search changes..."
            className="w-full rounded-lg border border-[#1e1e28] bg-[#111118] py-2 pl-9 pr-3 text-sm text-white placeholder-gray-600 focus:border-red-600/50 focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={() => setType("")}
          className={`rounded-full border px-3 py-1 text-xs ${
            !type ? "border-red-500/60 bg-red-600/15 text-white" : "border-[#1e1e28] text-gray-500 hover:text-gray-300"
          }`}
        >
          All ({total})
        </button>
        {TYPES.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setType(type === t.key ? "" : t.key)}
            className={`rounded-full border px-3 py-1 text-xs ${
              type === t.key ? t.badge : "border-[#1e1e28] text-gray-500 hover:text-gray-300"
            }`}
          >
            {t.label} ({counts[t.key] ?? 0})
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-gray-500">No changes match that search.</p>
      ) : (
        <ol className="relative space-y-8 border-l border-[#1e1e28] pl-6">
          {visible.map((entry) => (
            <li key={entry.date} className="relative">
              <span className="absolute -left-[31px] top-1 h-3 w-3 rounded-full border-2 border-[#0a0a0f] bg-red-600" />
              <div className="mb-3">
                <time dateTime={entry.date} className="text-xs font-semibold uppercase tracking-[0.14em] text-red-400">
                  {longDate(entry.date)}
                </time>
                {entry.title && <h2 className="mt-0.5 text-base font-semibold text-white">{entry.title}</h2>}
              </div>
              <ul className="space-y-2 rounded-xl border border-[#1e1e28] bg-card p-4">
                {entry.changes.map((change, i) => {
                  const meta = TYPES.find((t) => t.key === change.type) ?? TYPES[1];
                  return (
                    <li key={i} className="flex items-start gap-3 text-sm">
                      <span
                        className={`mt-0.5 w-[70px] shrink-0 rounded border px-1.5 py-px text-center text-[10px] font-semibold uppercase tracking-wider ${meta.badge}`}
                      >
                        {meta.label}
                      </span>
                      <span className="text-gray-300">{change.text}</span>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
