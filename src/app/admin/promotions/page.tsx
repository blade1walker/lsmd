"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { ErrorState } from "@/components/ui/error-state";
import { ResultBadge } from "@/components/interviews/InterviewUI";
import { fetchList, errorMessage } from "@/lib/fetch-json";
import { RANK_LIST } from "@/lib/constants";
import { EVALUATION_CATEGORIES, type CategoryKey } from "@/lib/interviews";
import { ArrowRight, ChevronDown, Search, TrendingUp, X } from "lucide-react";

interface PromotionRecord {
  id: string;
  memberId: string | null;
  memberName: string;
  callSign: string | null;
  fromRank: string;
  toRank: string;
  direction: "Promotion" | "Demotion";
  promotedBy: string;
  promotedAt: string;
  /** Set when the change came out of a promotion examination. */
  interviewId: string | null;
  interviewSessionId: string | null;
  finalScore: number | null;
  interview: {
    result: string;
    finalizedAt: string | null;
    categoryScores: Partial<Record<CategoryKey, number>> | null;
    panel: { name: string; rank: string | null; role: string }[];
  } | null;
}

type DirectionFilter = "all" | "Promotion" | "Demotion";
type SourceFilter = "all" | "interview" | "manual";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/** Groups by memberId, falling back to the name for a row with none. */
function employeeKey(r: PromotionRecord) {
  return r.memberId ?? `name:${r.memberName}`;
}

function DirectionBadge({ direction }: { direction: PromotionRecord["direction"] }) {
  return direction === "Promotion" ? (
    <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-emerald-500/10 text-emerald-400">
      Promotion
    </span>
  ) : (
    <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-orange-500/10 text-orange-400">
      Demotion
    </span>
  );
}

export default function AdminPromotionsPage() {
  const [records, setRecords] = useState<PromotionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [direction, setDirection] = useState<DirectionFilter>("all");
  const [employee, setEmployee] = useState("");
  const [rank, setRank] = useState("");
  const [source, setSource] = useState<SourceFilter>("all");
  const [interviewer, setInterviewer] = useState("");
  const [minScore, setMinScore] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setError(null);
    try {
      setRecords(await fetchList<PromotionRecord>("/api/promotions"));
    } catch (err) {
      setError(errorMessage(err));
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // One entry per employee. Records arrive newest first, so the name kept is
  // the most recent one — a renamed member shows under their current name.
  const employees = useMemo(() => {
    const byKey = new Map<string, { key: string; name: string; count: number }>();
    for (const r of records) {
      const key = employeeKey(r);
      const existing = byKey.get(key);
      if (existing) existing.count++;
      else byKey.set(key, { key, name: r.memberName, count: 1 });
    }
    return [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [records]);

  const interviewers = useMemo(() => {
    const names = new Set<string>();
    for (const r of records) for (const p of r.interview?.panel ?? []) names.add(p.name);
    return [...names].sort();
  }, [records]);

  const filtered = useMemo(() => {
    const terms = search.toLowerCase().split(" ").map((t) => t.trim()).filter(Boolean);
    const floor = minScore === "" ? null : Number(minScore);
    // The "to" day is inclusive, so a record made that afternoon still matches.
    const until = to ? new Date(new Date(to).setHours(23, 59, 59, 999)) : null;
    const since = from ? new Date(from) : null;

    return records.filter((r) => {
      if (employee && employeeKey(r) !== employee) return false;
      if (direction !== "all" && r.direction !== direction) return false;
      if (rank && r.fromRank !== rank && r.toRank !== rank) return false;
      if (source === "interview" && !r.interviewId) return false;
      if (source === "manual" && r.interviewId) return false;
      if (interviewer && !(r.interview?.panel ?? []).some((p) => p.name === interviewer)) return false;
      if (floor !== null && (r.finalScore === null || r.finalScore < floor)) return false;
      const when = new Date(r.promotedAt);
      if (since && when < since) return false;
      if (until && when > until) return false;
      if (terms.length === 0) return true;
      const text = [r.memberName, r.callSign, r.fromRank, r.toRank, r.promotedBy, r.interviewSessionId]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return terms.every((t) => text.includes(t));
    });
  }, [records, search, direction, employee, rank, source, interviewer, minScore, from, to]);

  const selectedEmployee = employees.find((e) => e.key === employee) ?? null;
  // Oldest first, so the timeline reads as a career from the joining rank up.
  const timeline = useMemo(
    () => (employee ? records.filter((r) => employeeKey(r) === employee).reverse() : []),
    [records, employee]
  );

  const promotionsThisMonth = useMemo(() => {
    const now = new Date();
    return records.filter((r) => {
      const d = new Date(r.promotedAt);
      return r.direction === "Promotion" && d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }).length;
  }, [records]);

  const fromInterview = useMemo(() => records.filter((r) => r.interviewId).length, [records]);

  const filtersActive = Boolean(
    search || direction !== "all" || employee || rank || source !== "all" || interviewer || minScore || from || to
  );

  function clearFilters() {
    setSearch("");
    setDirection("all");
    setEmployee("");
    setRank("");
    setSource("all");
    setInterviewer("");
    setMinScore("");
    setFrom("");
    setTo("");
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="text-gray-500">Loading promotion history...</div></div>;
  }

  if (error) {
    return <ErrorState title="Failed to load promotion history" message={error} onRetry={fetchData} />;
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-[family-name:var(--font-oswald)] text-2xl font-bold text-white uppercase flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-[#dc2626]" />
          Promotion History
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Every rank change made on the roster or through a promotion examination, recorded automatically and kept
          permanently.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Rank changes recorded", value: records.length },
          { label: "Promotions this month", value: promotionsThisMonth },
          { label: "From an examination", value: fromInterview },
          { label: "Employees with history", value: employees.length },
        ].map((tile) => (
          <div key={tile.label} className="bg-[#111111] border border-[#1e1e1e] rounded-xl p-4">
            <div className="text-xs uppercase tracking-wider text-gray-500">{tile.label}</div>
            <div className="font-[family-name:var(--font-oswald)] text-2xl font-bold text-white mt-1">{tile.value}</div>
          </div>
        ))}
      </div>

      {selectedEmployee && (
        <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl p-5 mb-6">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <div className="text-xs uppercase tracking-wider text-gray-500">Career history</div>
              <div className="text-white font-semibold text-lg">{selectedEmployee.name}</div>
            </div>
            <button onClick={() => setEmployee("")} className="p-1 text-gray-500 hover:text-white" title="Show everyone">
              <X className="w-4 h-4" />
            </button>
          </div>
          <ol className="space-y-2">
            {timeline.map((r, i) => (
              <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <span className="w-6 text-right font-[family-name:var(--font-mono)] text-xs text-gray-600">{i + 1}.</span>
                <span className="text-gray-500 w-28 shrink-0">{formatDate(r.promotedAt)}</span>
                <span className="text-gray-400">{r.fromRank}</span>
                <ArrowRight className="w-3.5 h-3.5 text-gray-600" />
                <span className="text-white">{r.toRank}</span>
                <DirectionBadge direction={r.direction} />
                {r.finalScore !== null && <span className="text-xs text-emerald-400">{r.finalScore}%</span>}
                <span className="text-gray-600 text-xs">by {r.promotedBy}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl overflow-hidden">
        <div className="p-3 border-b border-[#1e1e1e] flex flex-wrap items-end gap-2">
          <div className="relative flex-1 min-w-48 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, rank, session or promoted by..."
              className="pl-8 h-9 text-sm"
            />
          </div>
          <Filter value={employee} onChange={setEmployee}>
            <option value="">All employees</option>
            {employees.map((e) => (
              <option key={e.key} value={e.key}>
                {e.name} ({e.count})
              </option>
            ))}
          </Filter>
          <Filter value={rank} onChange={setRank}>
            <option value="">Any rank</option>
            {RANK_LIST.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Filter>
          <Filter value={direction} onChange={(v) => setDirection(v as DirectionFilter)}>
            <option value="all">Promotions &amp; demotions</option>
            <option value="Promotion">Promotions only</option>
            <option value="Demotion">Demotions only</option>
          </Filter>
          <Filter value={source} onChange={(v) => setSource(v as SourceFilter)}>
            <option value="all">Any source</option>
            <option value="interview">From an examination</option>
            <option value="manual">Made on the roster</option>
          </Filter>
          <Filter value={interviewer} onChange={setInterviewer}>
            <option value="">Any interviewer</option>
            {interviewers.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Filter>
          <div>
            <label className="mb-1 block text-[11px] text-gray-500">Min score</label>
            <Input
              type="number"
              min={0}
              max={100}
              value={minScore}
              onChange={(e) => setMinScore(e.target.value)}
              className="h-9 w-24 text-sm"
              placeholder="any"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-gray-500">From</label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 w-40 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-gray-500">To</label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 w-40 text-sm" />
          </div>
          {filtersActive && (
            <button onClick={clearFilters} className="pb-2 text-xs text-red-400 hover:text-red-300">
              Clear filters
            </button>
          )}
        </div>

        {records.length === 0 ? (
          <p className="p-6 text-sm text-gray-500">
            No rank changes recorded yet. Promotions made on the roster or through an examination appear here
            automatically.
          </p>
        ) : filtered.length === 0 ? (
          <p className="p-6 text-sm text-gray-500">No records match these filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1e1e1e]">
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">Employee Name</th>
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">Previous Rank</th>
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">New Rank</th>
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">Promotion Date</th>
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">Final Score</th>
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">Promoted By</th>
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">Type</th>
                  <th className="py-3 px-4" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const isOpen = expanded === r.id;
                  return (
                    <ExpandableRow
                      key={r.id}
                      record={r}
                      isOpen={isOpen}
                      onToggle={() => setExpanded(isOpen ? null : r.id)}
                      onPickEmployee={() => setEmployee(employeeKey(r))}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Filter({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 rounded-md border border-[#1e1e1e] bg-[#0a0a0a] px-3 text-sm text-white"
      style={{ colorScheme: "dark" }}
    >
      {children}
    </select>
  );
}

function ExpandableRow({
  record,
  isOpen,
  onToggle,
  onPickEmployee,
}: {
  record: PromotionRecord;
  isOpen: boolean;
  onToggle: () => void;
  onPickEmployee: () => void;
}) {
  return (
    <>
      <tr className="border-b border-[#1e1e1e]/50 hover:bg-white/5">
        <td className="py-3 px-4">
          <button
            onClick={onPickEmployee}
            className="text-white hover:text-[#dc2626] text-left"
            title="Show this employee's full history"
          >
            {record.memberName}
          </button>
          {record.callSign && (
            <span className="ml-2 font-[family-name:var(--font-mono)] text-xs text-gray-500">{record.callSign}</span>
          )}
        </td>
        <td className="py-3 px-4 text-gray-400">{record.fromRank}</td>
        <td className="py-3 px-4 text-white">{record.toRank}</td>
        <td className="py-3 px-4 text-gray-400">{formatDate(record.promotedAt)}</td>
        <td className="py-3 px-4">
          {record.finalScore === null ? (
            <span className="text-gray-600">—</span>
          ) : (
            <span className="font-[family-name:var(--font-oswald)] font-bold text-emerald-400">
              {record.finalScore}%
            </span>
          )}
        </td>
        <td className="py-3 px-4 text-gray-400">{record.promotedBy}</td>
        <td className="py-3 px-4"><DirectionBadge direction={record.direction} /></td>
        <td className="py-3 px-4 text-right">
          {record.interviewId && (
            <button onClick={onToggle} className="p-1 text-gray-500 hover:text-white" title="Show the examination">
              <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
            </button>
          )}
        </td>
      </tr>
      {isOpen && record.interview && (
        <tr className="border-b border-[#1e1e1e]/50 bg-[#0a0a0f]">
          <td colSpan={8} className="px-4 py-4">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-gray-500">Interview session</div>
                <Link
                  href={`/admin/interviews/${record.interviewId}`}
                  className="font-[family-name:var(--font-mono)] text-sm text-blue-400 hover:underline"
                >
                  {record.interviewSessionId}
                </Link>
                <div className="mt-2">
                  <ResultBadge result={record.interview.result} />
                </div>
              </div>

              <div>
                <div className="mb-1 text-[11px] uppercase tracking-wider text-gray-500">Category averages</div>
                <dl className="space-y-0.5 text-sm">
                  {EVALUATION_CATEGORIES.map((category) => (
                    <div key={category.key} className="flex justify-between gap-3">
                      <dt className="text-gray-500">{category.label}</dt>
                      <dd className="text-gray-300">
                        {record.interview?.categoryScores?.[category.key] ?? "—"}
                        {record.interview?.categoryScores?.[category.key] !== undefined && "%"}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>

              <div>
                <div className="mb-1 text-[11px] uppercase tracking-wider text-gray-500">
                  Interview panel ({record.interview.panel.length})
                </div>
                <ul className="space-y-0.5 text-sm text-gray-300">
                  {record.interview.panel.map((p) => (
                    <li key={`${p.name}-${p.role}`}>
                      {p.name}
                      {p.rank && <span className="text-gray-600"> — {p.rank}</span>}
                      <span className="ml-1 text-xs text-gray-600">({p.role})</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
