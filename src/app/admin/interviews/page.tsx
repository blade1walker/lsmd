"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ResultBadge, StatusBadge, StatTile, EligibilityBadge } from "@/components/interviews/InterviewUI";
import { fetchJson, errorMessage } from "@/lib/fetch-json";
import { RANK_LIST } from "@/lib/constants";
import {
  DEFAULT_PROMOTION_SETTINGS,
  INTERVIEW_RESULTS,
  INTERVIEW_STATUSES,
  MAX_PANEL,
  PANEL_ROLES,
  evaluateEligibility,
  formatDuration,
  scoreColor,
  type CandidateSnapshot,
  type EligibilityVerdict,
  type InterviewSummary,
  type PromotionSettingsValues,
} from "@/lib/interviews";
import { ClipboardCheck, Plus, Search, Sliders, UserPlus, X } from "lucide-react";

interface DashboardData {
  interviews: InterviewSummary[];
  stats: {
    total: number;
    ongoing: number;
    passed: number;
    failed: number;
    pending: number;
    reviewRequired: number;
    promoted: number;
  };
}

interface Panelist {
  discordId: string;
  name: string;
  rank: string;
  callSign: string | null;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

const EMPTY_STATS: DashboardData["stats"] = {
  total: 0,
  ongoing: 0,
  passed: 0,
  failed: 0,
  pending: 0,
  reviewRequired: 0,
  promoted: 0,
};

export default function AdminInterviewsPage() {
  const { data: session } = useSession();
  const permissions = useMemo(() => session?.user?.permissions ?? [], [session]);
  const isSuperAdmin = session?.user?.isSuperAdmin ?? false;
  const can = useCallback(
    (permission: string) => isSuperAdmin || permissions.includes(permission),
    [isSuperAdmin, permissions]
  );

  const [data, setData] = useState<DashboardData>({ interviews: [], stats: EMPTY_STATS });
  const [settings, setSettings] = useState<PromotionSettingsValues>(DEFAULT_PROMOTION_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [result, setResult] = useState("");
  const [employee, setEmployee] = useState("");
  const [currentRank, setCurrentRank] = useState("");
  const [targetRank, setTargetRank] = useState("");
  const [interviewer, setInterviewer] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [creating, setCreating] = useState(false);

  const query = useMemo(() => {
    const sp = new URLSearchParams();
    if (q.trim()) sp.set("q", q.trim());
    if (status) sp.set("status", status);
    if (result) sp.set("result", result);
    if (employee) sp.set("memberId", employee);
    if (currentRank) sp.set("currentRank", currentRank);
    if (targetRank) sp.set("targetRank", targetRank);
    // `interviewer` is deliberately not sent: the route filters the panel by
    // Discord id, and this dropdown is built from the panel names in the
    // loaded list. It narrows below instead, against the same names.
    if (from) sp.set("from", from);
    if (to) sp.set("to", to);
    return sp.toString();
  }, [q, status, result, employee, currentRank, targetRank, from, to]);

  const fetchData = useCallback(async () => {
    setError(null);
    try {
      setData(await fetchJson<DashboardData>(`/api/interviews${query ? `?${query}` : ""}`));
    } catch (err) {
      setError(errorMessage(err));
      setData({ interviews: [], stats: EMPTY_STATS });
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    const timer = setTimeout(fetchData, q ? 250 : 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchData]);

  useEffect(() => {
    fetchJson<PromotionSettingsValues>("/api/interviews/settings")
      .then(setSettings)
      .catch(() => {
        // The thresholds only colour the scores here; the dashboard is still
        // readable on the defaults if the settings row cannot be read.
      });
  }, []);

  // Distinct employees and interviewers across the loaded sessions, for the
  // filter dropdowns — no extra request, and the options are always ones that
  // actually appear in the list.
  const employees = useMemo(() => {
    const byId = new Map<string, string>();
    for (const i of data.interviews) if (i.memberId) byId.set(i.memberId, i.memberName);
    return [...byId.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [data.interviews]);

  const interviewers = useMemo(() => {
    const names = new Set<string>();
    for (const i of data.interviews) for (const n of i.panelNames) names.add(n);
    return [...names].sort();
  }, [data.interviews]);

  const filtersActive = Boolean(
    q || status || result || employee || currentRank || targetRank || interviewer || from || to
  );

  function clearFilters() {
    setQ("");
    setStatus("");
    setResult("");
    setEmployee("");
    setCurrentRank("");
    setTargetRank("");
    setInterviewer("");
    setFrom("");
    setTo("");
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-gray-500">Loading promotion interviews...</div>
      </div>
    );
  }

  if (error) {
    return <ErrorState title="Failed to load promotion interviews" message={error} onRetry={fetchData} />;
  }

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-[family-name:var(--font-oswald)] text-2xl font-bold uppercase text-white">
            <ClipboardCheck className="h-6 w-6 text-[#dc2626]" />
            Promotion &amp; Interview
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Run promotion examinations, score candidates as a panel and promote on a pass — the roster and Promotion
            History update themselves.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {can("interviews.manage") && (
            <Link href="/admin/interviews/settings">
              <Button variant="outline" size="sm">
                <Sliders className="mr-2 h-4 w-4" />
                Settings
              </Button>
            </Link>
          )}
          {can("interviews.create") && (
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Interview
            </Button>
          )}
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Total interviews" value={data.stats.total} />
        <StatTile label="Ongoing" value={data.stats.ongoing} tone="text-amber-400" />
        <StatTile label="Passed" value={data.stats.passed} tone="text-emerald-400" />
        <StatTile label="Failed" value={data.stats.failed} tone="text-red-400" />
        <StatTile label="Under review" value={data.stats.reviewRequired} tone="text-blue-400" />
        <StatTile label="Promotions completed" value={data.stats.promoted} tone="text-emerald-400" />
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-[#1e1e1e] bg-[#111111] p-3">
        <div className="relative min-w-48 flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search session, employee or interviewer..."
            className="h-9 pl-8 text-sm"
          />
        </div>

        <Select label="Employee" value={employee} onChange={setEmployee}>
          <option value="">All employees</option>
          {employees.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </Select>

        <Select label="Current rank" value={currentRank} onChange={setCurrentRank}>
          <option value="">Any</option>
          {RANK_LIST.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </Select>

        <Select label="Target rank" value={targetRank} onChange={setTargetRank}>
          <option value="">Any</option>
          {RANK_LIST.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </Select>

        <Select label="Status" value={status} onChange={setStatus}>
          <option value="">Any</option>
          {INTERVIEW_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>

        <Select label="Result" value={result} onChange={setResult}>
          <option value="">Any</option>
          {INTERVIEW_RESULTS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </Select>

        <div>
          <label className="mb-1 block text-[11px] text-gray-500">From</label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 w-40" />
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-gray-500">To</label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 w-40" />
        </div>

        <Select label="Interviewer" value={interviewer} onChange={setInterviewer}>
          <option value="">Anyone</option>
          {interviewers.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </Select>

        {filtersActive && (
          <button type="button" onClick={clearFilters} className="pb-2 text-xs text-red-400 hover:text-red-300">
            Clear filters
          </button>
        )}
      </div>

      <InterviewTable
        interviews={
          interviewer ? data.interviews.filter((i) => i.panelNames.includes(interviewer)) : data.interviews
        }
        passingScore={settings.passingScore}
        filtersActive={filtersActive}
      />

      {creating && (
        <CreateInterviewDialog
          settings={settings}
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            fetchData();
          }}
        />
      )}
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-[11px] text-gray-500">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 rounded-md border border-[#1e1e1e] bg-[#0a0a0a] px-3 text-sm text-white"
        style={{ colorScheme: "dark" }}
      >
        {children}
      </select>
    </div>
  );
}

function InterviewTable({
  interviews,
  passingScore,
  filtersActive,
}: {
  interviews: InterviewSummary[];
  passingScore: number;
  filtersActive: boolean;
}) {
  if (interviews.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[#1e1e28] p-12 text-center">
        <p className="text-sm text-gray-500">
          {filtersActive ? "No interviews match these filters." : "No promotion interviews have been created yet."}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-[#1e1e1e] bg-[#111111]">
      <table className="w-full min-w-[980px] text-sm">
        <thead>
          <tr className="border-b border-[#1e1e1e] text-left text-xs uppercase tracking-wider text-gray-500">
            <th className="px-4 py-3 font-medium">Session</th>
            <th className="px-4 py-3 font-medium">Employee</th>
            <th className="px-4 py-3 font-medium">Current → Target</th>
            <th className="px-4 py-3 font-medium">Panel</th>
            <th className="px-4 py-3 font-medium">Score</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Result</th>
            <th className="px-4 py-3 font-medium">Created</th>
          </tr>
        </thead>
        <tbody>
          {interviews.map((i) => (
            <tr key={i.id} className="border-b border-[#1e1e1e]/50 transition-colors hover:bg-white/5">
              <td className="whitespace-nowrap px-4 py-3">
                <Link
                  href={`/admin/interviews/${i.id}`}
                  className="font-[family-name:var(--font-mono)] text-xs text-blue-400 hover:underline"
                >
                  {i.sessionId}
                </Link>
              </td>
              <td className="px-4 py-3">
                <div className="text-white">{i.memberName}</div>
                {i.callSign && (
                  <div className="font-[family-name:var(--font-mono)] text-xs text-gray-600">{i.callSign}</div>
                )}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-gray-400">
                {i.currentRank} <span className="text-gray-600">→</span>{" "}
                <span className="text-white">{i.targetRank}</span>
              </td>
              <td className="px-4 py-3 text-xs text-gray-400">
                {i.submittedCount}/{i.panelCount} submitted
              </td>
              <td className="px-4 py-3">
                <span
                  className={`font-[family-name:var(--font-oswald)] font-bold ${scoreColor(i.liveScore, passingScore)}`}
                >
                  {i.liveScore === null ? "—" : `${i.liveScore}%`}
                </span>
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={i.status} />
              </td>
              <td className="px-4 py-3">
                <ResultBadge result={i.result} />
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500">{formatDate(i.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Create
 * ------------------------------------------------------------------ */

function CreateInterviewDialog({
  settings,
  onClose,
  onCreated,
}: {
  settings: PromotionSettingsValues;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [candidates, setCandidates] = useState<CandidateSnapshot[]>([]);
  const [panelists, setPanelists] = useState<Panelist[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [memberId, setMemberId] = useState("");
  const [targetRank, setTargetRank] = useState("");
  const [search, setSearch] = useState("");
  const [panel, setPanel] = useState<{ discordId: string; role: string }[]>([]);
  const [override, setOverride] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchJson<{ candidates: CandidateSnapshot[]; panelists: Panelist[] }>("/api/interviews/candidates")
      .then((d) => {
        setCandidates(d.candidates);
        setPanelists(d.panelists);
      })
      .catch((err) => setLoadError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  const candidate = candidates.find((c) => c.memberId === memberId) ?? null;

  const matches = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return candidates.slice(0, 40);
    return candidates
      .filter(
        (c) =>
          c.name.toLowerCase().includes(term) ||
          c.rank.toLowerCase().includes(term) ||
          (c.callSign ?? "").toLowerCase().includes(term)
      )
      .slice(0, 40);
  }, [candidates, search]);

  // The same rules the create route applies, run here so the form can say
  // "Not Yet Eligible" with the reason before anything is submitted. The
  // server checks again on create — this is the explanation, not the gate.
  const eligibility: EligibilityVerdict | null = useMemo(() => {
    if (!candidate || !targetRank) return null;
    return evaluateEligibility(candidate, targetRank, settings);
  }, [candidate, targetRank, settings]);

  async function submit() {
    if (!memberId || !targetRank) {
      toast.error("Choose the employee and the rank they are being evaluated for");
      return;
    }
    setSaving(true);
    try {
      await fetchJson("/api/interviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId, targetRank, panel, overrideEligibility: override }),
      });
      toast.success("Interview session created");
      onCreated();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Promotion Interview</DialogTitle>
        </DialogHeader>

        {loading ? (
          <p className="py-8 text-center text-sm text-gray-500">Loading the roster...</p>
        ) : loadError ? (
          <p className="py-8 text-center text-sm text-red-400">{loadError}</p>
        ) : (
          <div className="space-y-5">
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wider text-gray-500">EMS Employee</label>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search the roster by name, call sign or rank..."
                className="mb-2 h-9 text-sm"
              />
              <div className="max-h-44 overflow-y-auto rounded-md border border-[#1e1e28]">
                {matches.map((c) => (
                  <button
                    key={c.memberId}
                    type="button"
                    onClick={() => setMemberId(c.memberId)}
                    className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors ${
                      memberId === c.memberId ? "bg-[#dc2626]/10 text-[#dc2626]" : "text-gray-300 hover:bg-white/5"
                    }`}
                  >
                    <span>
                      {c.name}
                      {c.callSign && (
                        <span className="ml-2 font-[family-name:var(--font-mono)] text-xs text-gray-600">
                          {c.callSign}
                        </span>
                      )}
                    </span>
                    <span className="text-xs text-gray-500">{c.rank}</span>
                  </button>
                ))}
                {matches.length === 0 && <p className="px-3 py-4 text-sm text-gray-500">Nobody matches that search.</p>}
              </div>
            </div>

            {candidate && (
              <div className="rounded-lg border border-[#1e1e28] bg-[#0a0a0f] p-4">
                <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
                  <Field label="Current Rank" value={candidate.rank} />
                  <Field label="Roster status" value={candidate.activity} />
                  <Field label="Time in Current Rank" value={formatDuration(candidate.rankSince)} />
                  <Field label="Total EMS Tenure" value={formatDuration(candidate.joinedEmsAt)} />
                  <Field
                    label="EMS Joining Date"
                    value={candidate.joinedEmsAt ? formatDate(candidate.joinedEmsAt) : "Unknown"}
                  />
                  <Field label="Training completion" value={`${candidate.trainingPercent}%`} />
                </dl>
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs uppercase tracking-wider text-gray-500">Target Rank</label>
              <select
                value={targetRank}
                onChange={(e) => setTargetRank(e.target.value)}
                className="h-9 w-full rounded-md border border-[#1e1e28] bg-[#0a0a0a] px-3 text-sm text-white"
                style={{ colorScheme: "dark" }}
              >
                <option value="">Choose the rank being evaluated for</option>
                {RANK_LIST.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            {eligibility && (
              <div className="rounded-lg border border-[#1e1e28] bg-[#0a0a0f] p-4">
                <div className="mb-3">
                  <EligibilityBadge eligible={eligibility.eligible} />
                </div>
                <ul className="space-y-1 text-sm">
                  {eligibility.checks.map((check) => (
                    <li key={check.label} className="flex items-start gap-2">
                      <span className={check.ok ? "text-emerald-400" : "text-red-400"}>{check.ok ? "✓" : "✕"}</span>
                      <span className="text-gray-400">
                        <span className="text-gray-300">{check.label}</span> — {check.detail}
                      </span>
                    </li>
                  ))}
                </ul>
                {!eligibility.eligible && (
                  <label className="mt-3 flex items-start gap-2 text-sm text-gray-400">
                    <input
                      type="checkbox"
                      checked={override}
                      onChange={(e) => setOverride(e.target.checked)}
                      className="mt-0.5 accent-red-600"
                    />
                    <span>
                      Open the interview anyway. Needs the <code className="text-gray-300">interviews.manage</code>{" "}
                      permission, and the override is recorded on the session.
                    </span>
                  </label>
                )}
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs uppercase tracking-wider text-gray-500">
                Interview Panel <span className="text-gray-600">(you are seated as Lead Interviewer)</span>
              </label>
              <PanelPicker panelists={panelists} panel={panel} onChange={setPanel} />
            </div>

            <div className="flex justify-end gap-2 border-t border-[#1e1e28] pt-4">
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={submit} disabled={saving || !memberId || !targetRank}>
                {saving ? "Creating..." : "Create Interview Session"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 sm:block">
      <dt className="text-xs uppercase tracking-wider text-gray-500">{label}</dt>
      <dd className="text-gray-200 sm:mt-0.5">{value}</dd>
    </div>
  );
}

function PanelPicker({
  panelists,
  panel,
  onChange,
}: {
  panelists: Panelist[];
  panel: { discordId: string; role: string }[];
  onChange: (panel: { discordId: string; role: string }[]) => void;
}) {
  const [search, setSearch] = useState("");

  const available = useMemo(() => {
    const term = search.trim().toLowerCase();
    return panelists
      .filter((p) => !panel.some((s) => s.discordId === p.discordId))
      .filter((p) => !term || p.name.toLowerCase().includes(term) || p.rank.toLowerCase().includes(term))
      .slice(0, 12);
  }, [panelists, panel, search]);

  return (
    <div className="rounded-md border border-[#1e1e28] p-3">
      {panel.length > 0 && (
        <ul className="mb-3 space-y-2">
          {panel.map((seat) => {
            const person = panelists.find((p) => p.discordId === seat.discordId);
            return (
              <li key={seat.discordId} className="flex items-center gap-2">
                <span className="flex-1 text-sm text-gray-200">
                  {person?.name ?? seat.discordId}
                  {person && <span className="ml-2 text-xs text-gray-500">{person.rank}</span>}
                </span>
                <select
                  value={seat.role}
                  onChange={(e) =>
                    onChange(panel.map((s) => (s.discordId === seat.discordId ? { ...s, role: e.target.value } : s)))
                  }
                  className="h-8 rounded-md border border-[#1e1e28] bg-[#0a0a0a] px-2 text-xs text-white"
                  style={{ colorScheme: "dark" }}
                >
                  {PANEL_ROLES.map((r) => (
                    <option key={r.key} value={r.key}>
                      {r.key}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => onChange(panel.filter((s) => s.discordId !== seat.discordId))}
                  className="p-1 text-gray-500 hover:text-red-400"
                  title="Remove from panel"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {panel.length >= MAX_PANEL - 1 ? (
        <p className="text-xs text-gray-500">The panel is full.</p>
      ) : (
        <>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Add an interviewer..."
            className="h-8 text-sm"
          />
          {search && (
            <div className="mt-2 max-h-36 overflow-y-auto">
              {available.map((p) => (
                <button
                  key={p.discordId}
                  type="button"
                  onClick={() => {
                    onChange([...panel, { discordId: p.discordId, role: "Interviewer" }]);
                    setSearch("");
                  }}
                  className="flex w-full items-center justify-between px-2 py-1.5 text-left text-sm text-gray-300 hover:bg-white/5"
                >
                  <span className="flex items-center gap-2">
                    <UserPlus className="h-3.5 w-3.5 text-gray-600" />
                    {p.name}
                  </span>
                  <span className="text-xs text-gray-500">{p.rank}</span>
                </button>
              ))}
              {available.length === 0 && <p className="px-2 py-2 text-xs text-gray-500">Nobody else matches.</p>}
            </div>
          )}
        </>
      )}
    </div>
  );
}
