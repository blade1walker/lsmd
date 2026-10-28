"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { ArrowDown, ArrowUp, Download, Search, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { fetchJson, errorMessage } from "@/lib/fetch-json";
import { formatHours } from "@/lib/roster";
import {
  ACTIVITY_LIMITS,
  ACTIVITY_PERIODS,
  STANDING_STYLES,
  type ActivityData,
  type ActivityPeriod,
  type ActivityRow,
  type ActivitySettingsView,
  type ActivityStanding,
} from "@/lib/activity";
import { toast } from "sonner";

type SortKey = "name" | "duty" | "city" | "calls" | "lastOnDuty" | "standing";

const STANDINGS: ActivityStanding[] = ["Below", "Meets", "New", "Reserve", "LOA"];
const STANDING_ORDER = new Map(STANDINGS.map((s, i) => [s, i]));

/** formatHours, but nothing logged reads "0h" rather than "< 1m". */
function hours(seconds: number): string {
  return seconds === 0 ? "0h" : formatHours(seconds);
}

function shortDate(iso: string | null): string {
  if (!iso) return "Never";
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function compare(a: ActivityRow, b: ActivityRow, key: SortKey): number {
  switch (key) {
    case "name":
      return a.name.localeCompare(b.name);
    case "duty":
      return a.dutySeconds - b.dutySeconds;
    case "city":
      return (a.citySeconds ?? 0) - (b.citySeconds ?? 0);
    case "calls":
      return a.calls - b.calls;
    case "lastOnDuty":
      return (a.lastOnDuty ? Date.parse(a.lastOnDuty) : 0) - (b.lastOnDuty ? Date.parse(b.lastOnDuty) : 0);
    case "standing":
      return (STANDING_ORDER.get(a.standing) ?? 0) - (STANDING_ORDER.get(b.standing) ?? 0) || a.dutySeconds - b.dutySeconds;
  }
}

function csvCell(value: string | number | null): string {
  const text = value === null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export default function ActivityPage() {
  const [period, setPeriod] = useState<ActivityPeriod>(7);
  const [data, setData] = useState<ActivityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [standing, setStanding] = useState<ActivityStanding | "">("");
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "standing", desc: false });

  const load = useCallback(async (days: ActivityPeriod) => {
    try {
      setData(await fetchJson<ActivityData>(`/api/activity?days=${days}`));
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => load(period), 0);
    return () => clearTimeout(timer);
  }, [load, period]);

  const rows = useMemo(() => {
    const query = q.trim().toLowerCase();
    const filtered = (data?.rows ?? []).filter(
      (r) =>
        (!standing || r.standing === standing) &&
        (!query || [r.name, r.callSign, r.rank].some((v) => v?.toLowerCase().includes(query)))
    );
    return filtered.sort((a, b) => (sort.desc ? -1 : 1) * compare(a, b, sort.key));
  }, [data, q, standing, sort]);

  const toggleSort = (key: SortKey) =>
    setSort((prev) => (prev.key === key ? { key, desc: !prev.desc } : { key, desc: key !== "name" && key !== "standing" }));

  const downloadCsv = () => {
    if (!data) return;
    const header = ["Call Sign", "Name", "Rank", "Status", "Standing", "Duty Hours", ...(data.cityTracked ? ["City Hours"] : []), "Calls", "Last On Duty", ...(data.cityTracked ? ["Last In City"] : [])];
    const lines = rows.map((r) =>
      [
        r.callSign,
        r.name,
        r.rank,
        r.activity,
        r.standing,
        (r.dutySeconds / 3600).toFixed(2),
        ...(data.cityTracked ? [((r.citySeconds ?? 0) / 3600).toFixed(2)] : []),
        r.calls,
        r.lastOnDuty,
        ...(data.cityTracked ? [r.lastInCity] : []),
      ]
        .map(csvCell)
        .join(",")
    );
    const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ems-activity-${data.periodDays}d-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <div className="grid gap-3 sm:grid-cols-5">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }
  if (error && !data) return <ErrorState title="Failed to load activity" message={error} onRetry={() => load(period)} />;
  if (!data) return null;

  const { totals } = data;

  return (
    <div className="max-w-7xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-oswald)] text-2xl font-bold uppercase text-white">Activity</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            Duty hours{data.cityTracked ? ", time in the city" : ""} and calls for every member, measured against the
            activity requirement. Members on LOA or Reserve are listed but not measured.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 rounded-lg border border-[#1e1e28] p-1">
            {ACTIVITY_PERIODS.map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => setPeriod(days)}
                className={`rounded-md px-3 py-1 text-xs font-medium ${
                  period === days ? "bg-red-600/15 text-red-300" : "text-gray-500 hover:text-gray-300"
                }`}
              >
                {days} days
              </button>
            ))}
          </div>
          <Button variant="outline" onClick={downloadCsv} disabled={rows.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            CSV
          </Button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Tile label="Meeting requirement" value={`${totals.meets} / ${totals.measured}`} tone="text-emerald-300" />
        <Tile label="Below requirement" value={String(totals.below)} tone={totals.below ? "text-red-300" : "text-white"} />
        <Tile label={`Duty · ${data.periodDays}d`} value={hours(totals.dutySeconds)} tone="text-white" />
        <Tile label={`City time · ${data.periodDays}d`} value={data.cityTracked ? hours(totals.citySeconds) : "—"} tone="text-white" />
        <Tile label={`Calls · ${data.periodDays}d`} value={String(totals.calls)} tone="text-white" />
      </div>

      <Requirement data={data} onSaved={() => load(period)} />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-600" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, call sign, rank..." className="pl-9" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Chip active={standing === ""} onClick={() => setStanding("")} label={`All · ${data.rows.length}`} />
          {STANDINGS.map((s) => {
            const n = data.rows.filter((r) => r.standing === s).length;
            return n ? <Chip key={s} active={standing === s} onClick={() => setStanding(standing === s ? "" : s)} label={`${s} · ${n}`} /> : null;
          })}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#1e1e28] p-12 text-center text-sm text-gray-500">
          No members match.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#1e1e28] bg-card">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-[#1e1e28] text-left text-xs uppercase tracking-wider text-gray-500">
                <SortHeader label="Member" k="name" sort={sort} onSort={toggleSort} />
                <SortHeader label={`Duty · target ${data.targetHours}h`} k="duty" sort={sort} onSort={toggleSort} />
                {data.cityTracked && <SortHeader label="City time" k="city" sort={sort} onSort={toggleSort} />}
                <SortHeader label="Calls" k="calls" sort={sort} onSort={toggleSort} />
                <SortHeader label="Last on duty" k="lastOnDuty" sort={sort} onSort={toggleSort} />
                {data.cityTracked && <th className="px-4 py-3 font-medium">Last in city</th>}
                <SortHeader label="Standing" k="standing" sort={sort} onSort={toggleSort} />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.memberId} className="border-b border-[#1e1e28]/60 last:border-b-0">
                  <td className="px-4 py-3">
                    <div className="text-gray-200">
                      {r.callSign && <span className="font-[family-name:var(--font-mono)] font-bold text-white">{r.callSign} </span>}
                      {r.name}
                    </div>
                    <div className="text-[11px] text-gray-500">
                      {r.rank}
                      {r.activity !== "Active" && <span> · {r.activity}</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="w-16 font-[family-name:var(--font-mono)] text-xs text-gray-200">{hours(r.dutySeconds)}</span>
                      {r.progress !== null && (
                        <span className="h-1.5 w-24 overflow-hidden rounded-full bg-white/5">
                          <span
                            className={`block h-full rounded-full ${r.progress >= 100 ? "bg-emerald-500" : r.progress >= 50 ? "bg-amber-500" : "bg-red-500"}`}
                            style={{ width: `${Math.min(100, r.progress)}%` }}
                          />
                        </span>
                      )}
                      {r.onDutyNow && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" title="On duty now" />}
                    </div>
                  </td>
                  {data.cityTracked && (
                    <td className="px-4 py-3 font-[family-name:var(--font-mono)] text-xs text-gray-400">
                      {hours(r.citySeconds ?? 0)}
                      {r.citySeconds !== null && r.citySeconds > 0 && r.dutySeconds === 0 && (
                        <span className="ml-1.5 font-sans text-[10px] text-amber-400" title="In the city this period but never on duty">
                          never on duty
                        </span>
                      )}
                    </td>
                  )}
                  <td className="px-4 py-3 font-[family-name:var(--font-mono)] text-xs text-gray-300">{r.calls}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{r.onDutyNow ? <span className="text-emerald-300">On duty now</span> : shortDate(r.lastOnDuty)}</td>
                  {data.cityTracked && <td className="px-4 py-3 text-xs text-gray-400">{shortDate(r.lastInCity)}</td>}
                  <td className="px-4 py-3">
                    <span className={`rounded-md border px-2 py-0.5 text-xs font-semibold ${STANDING_STYLES[r.standing]}`}>{r.standing}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Tile({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-xl border border-[#1e1e28] bg-card px-4 py-3">
      <div className="text-[11px] uppercase tracking-wider text-gray-500">{label}</div>
      <div className={`font-[family-name:var(--font-oswald)] text-2xl font-bold ${tone}`}>{value}</div>
    </div>
  );
}

function Chip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        active ? "border-red-600/50 bg-red-600/15 text-red-200" : "border-[#1e1e28] text-gray-400 hover:text-gray-200"
      }`}
    >
      {label}
    </button>
  );
}

function SortHeader({
  label,
  k,
  sort,
  onSort,
}: {
  label: string;
  k: SortKey;
  sort: { key: SortKey; desc: boolean };
  onSort: (key: SortKey) => void;
}) {
  const active = sort.key === k;
  return (
    <th className="px-4 py-3 font-medium">
      <button type="button" onClick={() => onSort(k)} className={`inline-flex items-center gap-1 uppercase ${active ? "text-gray-200" : "hover:text-gray-300"}`}>
        {label}
        {active && (sort.desc ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />)}
      </button>
    </th>
  );
}

function Requirement({ data, onSaved }: { data: ActivityData; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [hours, setHours] = useState(String(data.settings.weeklyHoursTarget));
  const [grace, setGrace] = useState(String(data.settings.graceDays));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await fetchJson<ActivitySettingsView>("/api/activity/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weeklyHoursTarget: Number(hours), graceDays: Number(grace) }),
      });
      toast.success("Activity requirement saved");
      setEditing(false);
      onSaved();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mb-6 rounded-xl border border-[#1e1e28] bg-card p-4">
      <div className="flex flex-wrap items-center gap-3">
        <Target className="h-5 w-5 text-red-400" />
        <div className="min-w-[220px] flex-1 text-sm text-gray-300">
          <span className="font-semibold text-white">{data.settings.weeklyHoursTarget}h on duty every 7 days</span>
          <span className="text-gray-500">
            {" "}
            — {data.targetHours}h over these {data.periodDays} days. New members have {data.settings.graceDays} days before
            they are measured.
          </span>
        </div>
        {data.canManage && !editing && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setHours(String(data.settings.weeklyHoursTarget));
              setGrace(String(data.settings.graceDays));
              setEditing(true);
            }}
          >
            Change
          </Button>
        )}
      </div>
      {editing && (
        <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-[#1e1e28] pt-4">
          <div>
            <Label>Hours per week</Label>
            <Input
              type="number"
              min={ACTIVITY_LIMITS.weeklyHoursTarget.min}
              max={ACTIVITY_LIMITS.weeklyHoursTarget.max}
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              className="mt-1 w-32"
            />
          </div>
          <div>
            <Label>Grace period (days)</Label>
            <Input
              type="number"
              min={ACTIVITY_LIMITS.graceDays.min}
              max={ACTIVITY_LIMITS.graceDays.max}
              value={grace}
              onChange={(e) => setGrace(e.target.value)}
              className="mt-1 w-32"
            />
          </div>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
          <Button variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
          {data.settings.updatedBy && <span className="text-xs text-gray-600">Last changed by {data.settings.updatedBy}</span>}
        </div>
      )}
    </div>
  );
}
