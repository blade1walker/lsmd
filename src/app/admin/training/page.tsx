"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { CheckCircle2, Circle, ChevronDown, Minus, Plus, Search } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import RankInsignia from "@/components/RankInsignia";
import { fetchJson, fetchList, errorMessage } from "@/lib/fetch-json";
import { getRankWeight } from "@/lib/constants";
import {
  EMS_TRAINING,
  overallProgress,
  phaseProgress,
  type EmsProgress,
  type TrainingSummaryRow,
} from "@/lib/training";
import { toast } from "sonner";

type Filter = "all" | "not-started" | "in-progress" | "complete";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "not-started", label: "Not started" },
  { key: "in-progress", label: "In progress" },
  { key: "complete", label: "Complete" },
];

function formatDay(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function stageOf(percent: number, done: number): Filter {
  if (done === 0) return "not-started";
  return percent >= 100 ? "complete" : "in-progress";
}

export default function AdminTrainingPage() {
  const { data: session } = useSession();
  // UX only — the PATCH route enforces training.manage regardless.
  const canManage =
    !!session?.user && (session.user.isSuperAdmin || (session.user.permissions ?? []).includes("training.manage"));

  const [rows, setRows] = useState<TrainingSummaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setRows(await fetchList<TrainingSummaryRow>("/api/training/summary"));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const replaceProgress = (memberId: string, progress: EmsProgress) =>
    setRows((prev) => prev.map((r) => (r.memberId === memberId ? { ...r, progress } : r)));

  /** Shows the change immediately, then settles on what the server recorded — or rolls back. */
  const send = async (row: TrainingSummaryRow, body: Record<string, unknown>, optimistic: EmsProgress, key: string) => {
    const previous = row.progress;
    replaceProgress(row.memberId, optimistic);
    setSaving(`${row.memberId}:${key}`);
    try {
      const updated = await fetchJson<{ emsProgress: EmsProgress }>(`/api/training/${row.memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      replaceProgress(row.memberId, updated.emsProgress);
    } catch (err) {
      replaceProgress(row.memberId, previous);
      toast.error(errorMessage(err));
    } finally {
      setSaving(null);
    }
  };

  const toggleCheckpoint = (row: TrainingSummaryRow, key: string) => {
    const done = !row.progress.checkpoints[key];
    const checkpoints = { ...row.progress.checkpoints };
    if (done) checkpoints[key] = { by: session?.user?.name ?? null, at: new Date().toISOString() };
    else delete checkpoints[key];
    send(row, { checkpoint: key, done }, { ...row.progress, checkpoints }, key);
  };

  const setCounter = (row: TrainingSummaryRow, key: string, value: number) => {
    const next = Math.max(0, Math.min(99, value));
    send(row, { counter: key, value: next }, { ...row.progress, counters: { ...row.progress.counters, [key]: next } }, key);
  };

  const saveReportNumber = async (row: TrainingSummaryRow, value: string) => {
    const trimmed = value.trim();
    if (trimmed === row.reportNumber) return;
    try {
      await fetchJson(`/api/training/${row.memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportNumber: trimmed }),
      });
      setRows((prev) => prev.map((r) => (r.memberId === row.memberId ? { ...r, reportNumber: trimmed } : r)));
      toast.success("Report number saved");
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const withStats = useMemo(
    () =>
      rows
        .map((row) => {
          const overall = overallProgress(row.progress);
          return { row, overall, stage: stageOf(overall.percent, overall.done) };
        })
        // Most junior first — they are the ones in training.
        .sort(
          (a, b) =>
            getRankWeight(a.row.member.rank) - getRankWeight(b.row.member.rank) ||
            a.row.member.name.localeCompare(b.row.member.name)
        ),
    [rows]
  );

  const counts = useMemo(() => {
    const tally: Record<Filter, number> = { all: withStats.length, "not-started": 0, "in-progress": 0, complete: 0 };
    for (const item of withStats) tally[item.stage] += 1;
    return tally;
  }, [withStats]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return withStats.filter(
      ({ row, stage }) =>
        (filter === "all" || stage === filter) &&
        (!q || [row.member.name, row.member.callSign, row.member.rank].some((v) => v?.toLowerCase().includes(q)))
    );
  }, [withStats, filter, query]);

  const allExpanded = visible.length > 0 && visible.every(({ row }) => expanded[row.memberId]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
    );
  }
  if (error) return <ErrorState title="Failed to load training records" message={error} onRetry={load} />;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-oswald)] text-2xl font-bold uppercase text-white">EMS Training</h1>
          <p className="mt-1 text-sm text-gray-500">
            Sign off clinical skills as each medic completes them. Your name and the date are recorded automatically.
          </p>
          {!canManage && (
            <p className="mt-1 text-xs text-yellow-500/80">View only — signing off skills needs the training.manage permission.</p>
          )}
        </div>
        <button
          type="button"
          onClick={() =>
            setExpanded(Object.fromEntries(visible.map(({ row }) => [row.memberId, !allExpanded])))
          }
          className="text-xs text-gray-400 hover:text-white"
        >
          {allExpanded ? "Collapse all" : "Expand all"}
        </button>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="relative mr-2 w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-600" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, call sign or rank..."
            className="w-full rounded-lg border border-[#1e1e28] bg-[#111118] py-2 pl-9 pr-3 text-sm text-white placeholder-gray-600 focus:border-red-600/50 focus:outline-none"
          />
        </div>
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`rounded-full border px-3 py-1 text-xs ${
              filter === f.key ? "border-red-500/60 bg-red-600/15 text-white" : "border-[#1e1e28] text-gray-500 hover:text-gray-300"
            }`}
          >
            {f.label} ({counts[f.key]})
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-gray-500">No members match.</p>
      ) : (
        <div className="space-y-3">
          {visible.map(({ row, overall }) => {
            const open = !!expanded[row.memberId];
            return (
              <div key={row.memberId} className="rounded-xl border border-[#1e1e1e] bg-[#111111]">
                <button
                  type="button"
                  onClick={() => setExpanded((prev) => ({ ...prev, [row.memberId]: !open }))}
                  aria-expanded={open}
                  className="flex w-full items-center gap-4 p-5 text-left"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#dc2626] to-[#b91c1c] text-sm font-bold text-black">
                    {row.member.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 3)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold text-white">{row.member.name}</div>
                    <div className="flex flex-wrap items-center gap-2 text-sm text-gray-400">
                      <span className="font-[family-name:var(--font-mono)]">{row.member.callSign ?? "—"}</span>
                      <span>•</span>
                      <RankInsignia rank={row.member.rank} size={12} />
                      <span>{row.member.rank}</span>
                      {row.member.ftoRole && (
                        <span className="rounded border border-amber-500/30 bg-amber-500/10 px-1.5 text-[10px] font-semibold uppercase text-amber-300">
                          {row.member.ftoRole}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="hidden w-52 sm:block">
                    <div className="mb-1 flex justify-between text-xs text-gray-500">
                      <span>
                        {overall.done}/{overall.total}
                      </span>
                      <span className={overall.percent >= 100 ? "text-green-400" : ""}>{overall.percent}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-[#1e1e28]">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-green-600 to-green-500 transition-all"
                        style={{ width: `${overall.percent}%` }}
                      />
                    </div>
                  </div>
                  <ChevronDown className={`h-4 w-4 shrink-0 text-gray-500 transition-transform ${open ? "" : "-rotate-90"}`} />
                </button>

                {open && (
                  <div className="grid gap-6 border-t border-[#1e1e1e] p-5 md:grid-cols-2 xl:grid-cols-4">
                    {EMS_TRAINING.map((phase) => {
                      const stats = phaseProgress(phase, row.progress);
                      return (
                        <div key={phase.key}>
                          <div className="flex items-baseline justify-between gap-2">
                            <h4 className="text-sm font-medium uppercase tracking-wider text-[#dc2626]">{phase.title}</h4>
                            <span className="text-xs text-gray-600">
                              {stats.done}/{stats.total}
                            </span>
                          </div>
                          <p className="mb-3 text-[11px] text-gray-600">{phase.subtitle}</p>

                          <div className="space-y-1">
                            {phase.checkpoints.map((cp) => {
                              const mark = row.progress.checkpoints[cp.key];
                              const busy = saving === `${row.memberId}:${cp.key}`;
                              return (
                                <button
                                  key={cp.key}
                                  type="button"
                                  disabled={!canManage || busy}
                                  onClick={() => toggleCheckpoint(row, cp.key)}
                                  title={cp.description}
                                  className="flex w-full items-start gap-2 rounded-lg p-2 text-left transition-colors hover:bg-white/5 disabled:cursor-default disabled:hover:bg-transparent"
                                >
                                  {mark ? (
                                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-400" />
                                  ) : (
                                    <Circle className="mt-0.5 h-4 w-4 shrink-0 text-gray-600" />
                                  )}
                                  <span className="min-w-0 flex-1">
                                    <span className={`block text-sm ${mark ? "text-gray-200" : "text-gray-400"}`}>{cp.label}</span>
                                    {mark ? (
                                      <span className="block text-[11px] text-gray-500">
                                        {mark.by ?? "Unknown"}
                                        {mark.at && ` · ${formatDay(mark.at)}`}
                                      </span>
                                    ) : (
                                      <span className="block text-[11px] leading-snug text-gray-600">{cp.description}</span>
                                    )}
                                  </span>
                                </button>
                              );
                            })}

                            {(phase.counters ?? []).map((counter) => {
                              const value = row.progress.counters[counter.key] ?? 0;
                              const met = value >= counter.target;
                              const busy = saving === `${row.memberId}:${counter.key}`;
                              return (
                                <div key={counter.key} className="flex items-center gap-2 rounded-lg p-2">
                                  {met ? (
                                    <CheckCircle2 className="h-4 w-4 shrink-0 text-green-400" />
                                  ) : (
                                    <Circle className="h-4 w-4 shrink-0 text-gray-600" />
                                  )}
                                  <span className={`flex-1 text-sm ${met ? "text-gray-200" : "text-gray-400"}`}>{counter.label}</span>
                                  <button
                                    type="button"
                                    aria-label={`One fewer ${counter.label}`}
                                    disabled={!canManage || busy || value <= 0}
                                    onClick={() => setCounter(row, counter.key, value - 1)}
                                    className="rounded p-1 text-gray-500 hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent"
                                  >
                                    <Minus className="h-3.5 w-3.5" />
                                  </button>
                                  <span
                                    className={`w-10 text-center font-[family-name:var(--font-mono)] text-xs ${
                                      met ? "text-green-400" : "text-gray-400"
                                    }`}
                                  >
                                    {value}/{counter.target}
                                  </span>
                                  <button
                                    type="button"
                                    aria-label={`One more ${counter.label}`}
                                    disabled={!canManage || busy}
                                    onClick={() => setCounter(row, counter.key, value + 1)}
                                    className="rounded p-1 text-gray-500 hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent"
                                  >
                                    <Plus className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              );
                            })}

                            {phase.key === "probationary" && (
                              <label className="block p-2">
                                <span className="mb-1 block text-[11px] uppercase tracking-wider text-gray-600">
                                  Evaluation report no.
                                </span>
                                <input
                                  key={`${row.memberId}:${row.reportNumber}`}
                                  defaultValue={row.reportNumber}
                                  disabled={!canManage}
                                  onBlur={(e) => saveReportNumber(row, e.target.value)}
                                  placeholder="e.g. EVAL-0042"
                                  className="w-full rounded-md border border-[#1e1e28] bg-[#0a0a0f] px-2 py-1.5 text-sm text-white placeholder-gray-700 focus:border-red-600/50 focus:outline-none disabled:opacity-60"
                                />
                              </label>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
