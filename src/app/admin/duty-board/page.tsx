"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Gamepad2, Radio, RefreshCw, Siren, Timer, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { useNow, elapsedSeconds } from "@/components/roster/DutyStatus";
import { fetchJson, errorMessage } from "@/lib/fetch-json";
import { formatHours } from "@/lib/roster-shared";
import {
  UNIT_LIMITS,
  UNIT_STATUSES,
  UNIT_TONE_CLASSES,
  unitStatusInfo,
  type DutyBoardData,
  type DutyBoardUnit,
  type UnitStatusKey,
} from "@/lib/duty-board";
import { toast } from "sonner";

const ORDER = new Map(UNIT_STATUSES.map((s, i) => [s.key, i]));
/** Statuses that mean "committed to a patient or call". */
const COMMITTED = new Set<UnitStatusKey>(["En Route", "On Scene", "Transporting", "At Hospital", "Busy"]);

export default function DutyBoardPage() {
  const now = useNow();
  const [data, setData] = useState<DutyBoardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<UnitStatusKey | "">("");

  const load = useCallback(async () => {
    try {
      setData(await fetchJson<DutyBoardData>("/api/duty-board"));
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // A live board: re-read every 15 seconds while the tab is in view.
  useEffect(() => {
    const first = setTimeout(() => load(), 0);
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 15_000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [load]);

  const refresh = () => {
    setRefreshing(true);
    load();
  };

  const setStatus = async (memberId: string, body: { status: UnitStatusKey; unit?: string | null; note?: string | null }) => {
    try {
      await fetchJson(`/api/duty-board/${memberId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      await load();
      return true;
    } catch (err) {
      toast.error(errorMessage(err));
      return false;
    }
  };

  const units = useMemo(
    () =>
      [...(data?.units ?? [])].sort(
        (a, b) =>
          (ORDER.get(a.status) ?? 0) - (ORDER.get(b.status) ?? 0) ||
          (a.callSign ?? "").localeCompare(b.callSign ?? "", undefined, { numeric: true }) ||
          a.name.localeCompare(b.name)
      ),
    [data]
  );
  const shown = filter ? units.filter((u) => u.status === filter) : units;

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <div className="grid gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }
  if (error && !data) return <ErrorState title="Failed to load the Duty Board" message={error} onRetry={refresh} />;
  if (!data) return null;

  const me = data.units.find((u) => u.memberId === data.viewerMemberId) ?? null;
  const counts = {
    onDuty: units.length,
    available: units.filter((u) => u.status === "Available").length,
    committed: units.filter((u) => COMMITTED.has(u.status)).length,
    onBreak: units.filter((u) => u.status === "On Break").length,
  };

  return (
    <div className="max-w-7xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-oswald)] text-2xl font-bold uppercase text-white">Duty Board</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            Every medic on duty and what they are doing — set from here, or in the city with{" "}
            <code className="rounded bg-white/10 px-1">/unitstatus</code>. Updates every 15 seconds.
          </p>
        </div>
        <Button variant="outline" onClick={refresh} disabled={refreshing}>
          <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Tile label="On duty" value={counts.onDuty} tone="text-white" />
        <Tile label="Available" value={counts.available} tone="text-emerald-300" />
        <Tile label="Committed" value={counts.committed} tone="text-amber-300" />
        <Tile label="On break" value={counts.onBreak} tone="text-gray-300" />
        <div className="col-span-2 rounded-xl border border-[#1e1e28] bg-card px-4 py-3 lg:col-span-1">
          <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-gray-500">
            <Gamepad2 className="h-3.5 w-3.5" />
            In the city
          </div>
          <div
            className={`font-[family-name:var(--font-oswald)] text-2xl font-bold ${
              !data.city.linked ? "text-gray-600" : data.city.online ? "text-red-300" : "text-gray-500"
            }`}
          >
            {!data.city.linked ? "Not linked" : data.city.online ? `${data.city.emsInCity} EMS` : "Offline"}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
        <div className="min-w-0 space-y-5">
          {me ? (
            <MyStatus unit={me} onSave={(body) => setStatus(me.memberId, body)} />
          ) : (
            data.viewerMemberId && <OffDutyPanel memberId={data.viewerMemberId} onClockedOn={load} />
          )}

          <div className="flex flex-wrap gap-1.5">
            <FilterChip active={filter === ""} onClick={() => setFilter("")} label={`All · ${units.length}`} />
            {UNIT_STATUSES.map((s) => {
              const n = units.filter((u) => u.status === s.key).length;
              if (n === 0 && filter !== s.key) return null;
              return (
                <FilterChip
                  key={s.key}
                  active={filter === s.key}
                  onClick={() => setFilter(filter === s.key ? "" : s.key)}
                  label={`${s.key} · ${n}`}
                  dot={UNIT_TONE_CLASSES[s.tone].dot}
                />
              );
            })}
          </div>

          {shown.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#1e1e28] p-12 text-center">
              <Siren className="mx-auto mb-2 h-6 w-6 text-gray-700" />
              <p className="text-sm text-gray-500">{units.length === 0 ? "Nobody is on duty right now." : "No units with that status."}</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
              {shown.map((unit) => (
                <UnitCard
                  key={unit.memberId}
                  unit={unit}
                  now={now}
                  isMe={unit.memberId === data.viewerMemberId}
                  canChange={data.canManage && unit.memberId !== data.viewerMemberId}
                  onChange={(status) => setStatus(unit.memberId, { status })}
                />
              ))}
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <div className="rounded-xl border border-[#1e1e28] bg-card p-4">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
              <Trophy className="h-4 w-4 text-amber-400" />
              Most hours · 7 days
            </div>
            {data.leaders.length === 0 ? (
              <p className="text-xs text-gray-600">No duty logged this week yet.</p>
            ) : (
              <ol className="space-y-2">
                {data.leaders.map((leader, i) => (
                  <li key={leader.memberId} className="flex items-center gap-3">
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                        i === 0 ? "bg-amber-500/20 text-amber-300" : "bg-white/5 text-gray-500"
                      }`}
                    >
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-gray-200">
                      {leader.callSign && <span className="font-[family-name:var(--font-mono)] text-gray-500">{leader.callSign} </span>}
                      {leader.name}
                    </span>
                    <span className="text-right text-xs">
                      <span className="block font-[family-name:var(--font-mono)] text-gray-300">{formatHours(leader.seconds)}</span>
                      <span className="block text-gray-600">
                        {leader.calls} {leader.calls === 1 ? "call" : "calls"}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className="rounded-xl border border-[#1e1e28] bg-card p-4 text-xs text-gray-500">
            <div className="mb-2 flex items-center gap-2 font-semibold uppercase tracking-wider text-gray-400">
              <Radio className="h-4 w-4" />
              Statuses
            </div>
            <ul className="space-y-1.5">
              {UNIT_STATUSES.map((s) => (
                <li key={s.key} className="flex gap-2">
                  <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${UNIT_TONE_CLASSES[s.tone].dot}`} />
                  <span>
                    <span className="text-gray-300">{s.key}</span> — {s.description}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-gray-600">
              Every shift starts as Available. In the city: <code className="rounded bg-white/10 px-1">/unitstatus enroute Vinewood</code>
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Tile({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-xl border border-[#1e1e28] bg-card px-4 py-3">
      <div className="text-[11px] uppercase tracking-wider text-gray-500">{label}</div>
      <div className={`font-[family-name:var(--font-oswald)] text-2xl font-bold ${tone}`}>{value}</div>
    </div>
  );
}

function FilterChip({ active, onClick, label, dot }: { active: boolean; onClick: () => void; label: string; dot?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        active ? "border-red-600/50 bg-red-600/15 text-red-200" : "border-[#1e1e28] text-gray-400 hover:text-gray-200"
      }`}
    >
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />}
      {label}
    </button>
  );
}

function CityDot({ inCity }: { inCity: boolean | null }) {
  if (inCity === null) return null;
  return (
    <span
      title={inCity ? "In the city" : "Not in the city"}
      className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-px text-[10px] font-semibold uppercase tracking-wider ${
        inCity ? "border-emerald-500/30 text-emerald-300" : "border-red-500/30 text-red-300"
      }`}
    >
      <Gamepad2 className="h-3 w-3" />
      {inCity ? "In city" : "Not in city"}
    </span>
  );
}

function UnitCard({
  unit,
  now,
  isMe,
  canChange,
  onChange,
}: {
  unit: DutyBoardUnit;
  now: number | null;
  isMe: boolean;
  canChange: boolean;
  onChange: (status: UnitStatusKey) => void;
}) {
  const info = unitStatusInfo(unit.status);
  const tone = UNIT_TONE_CLASSES[info.tone];

  return (
    <div className={`relative overflow-hidden rounded-xl border bg-card p-4 ${isMe ? "border-red-600/40" : "border-[#1e1e28]"}`}>
      <span className={`absolute inset-y-0 left-0 w-1 ${tone.dot}`} />
      <div className="flex items-start gap-3 pl-1">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            {unit.callSign && (
              <span className="font-[family-name:var(--font-mono)] text-lg font-bold text-white">{unit.callSign}</span>
            )}
            <span className="truncate font-semibold text-gray-200">{unit.name}</span>
          </div>
          <div className="text-xs text-gray-500">
            {unit.rank}
            {unit.unit && <span className="text-gray-400"> · {unit.unit}</span>}
          </div>
        </div>
        <span className={`shrink-0 rounded-md border px-2 py-0.5 text-xs font-semibold ${tone.chip}`}>{unit.status}</span>
      </div>

      {unit.note && <p className="mt-2 pl-1 text-sm text-gray-300">{unit.note}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-2 pl-1 text-[11px] text-gray-500">
        <span className="inline-flex items-center gap-1">
          <Timer className="h-3 w-3" />
          {now !== null ? formatHours(elapsedSeconds(unit.onDutySince, now)) : "—"}
        </span>
        <CityDot inCity={unit.inCity} />
        {unit.clockSource === "fivem" && <span className="text-gray-600">· clocked on in game</span>}
        {isMe && <span className="text-red-300">· you</span>}
      </div>

      {canChange && (
        <Select
          value={unit.status}
          onChange={(e) => onChange(e.target.value as UnitStatusKey)}
          className="mt-3 h-8 text-xs"
          aria-label={`Set ${unit.name}'s status`}
        >
          {UNIT_STATUSES.map((s) => (
            <option key={s.key} value={s.key}>
              {s.key}
            </option>
          ))}
        </Select>
      )}
      {unit.statusUpdatedBy && (
        <div className="mt-2 pl-1 text-[10px] text-gray-600">
          Set by {unit.statusUpdatedBy}
          {unit.statusUpdatedAt ? ` · ${new Date(unit.statusUpdatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}
        </div>
      )}
    </div>
  );
}

function MyStatus({
  unit,
  onSave,
}: {
  unit: DutyBoardUnit;
  onSave: (body: { status: UnitStatusKey; unit: string | null; note: string | null }) => Promise<boolean>;
}) {
  const [designation, setDesignation] = useState(unit.unit ?? "");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<UnitStatusKey | null>(null);

  const pick = async (status: UnitStatusKey) => {
    setBusy(status);
    const ok = await onSave({ status, unit: designation.trim() || null, note: note.trim() || null });
    setBusy(null);
    if (ok) setNote("");
  };

  return (
    <div className="rounded-xl border border-red-600/30 bg-red-600/[0.04] p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-xs font-semibold uppercase tracking-wider text-gray-400">Your status</div>
        <div className="text-xs text-gray-500">
          Now <span className={UNIT_TONE_CLASSES[unitStatusInfo(unit.status).tone].text}>{unit.status}</span>
          {unit.note ? ` · ${unit.note}` : ""}
        </div>
      </div>
      <div className="mb-3 grid gap-2 sm:grid-cols-[160px_1fr]">
        <Input
          value={designation}
          onChange={(e) => setDesignation(e.target.value)}
          maxLength={UNIT_LIMITS.unit}
          placeholder="Unit, e.g. Medic 1"
          className="h-8 text-sm"
        />
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={UNIT_LIMITS.note}
          placeholder="Where, or what you are on (optional)"
          className="h-8 text-sm"
        />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {UNIT_STATUSES.map((s) => {
          const tone = UNIT_TONE_CLASSES[s.tone];
          const current = unit.status === s.key;
          return (
            <button
              key={s.key}
              type="button"
              disabled={busy !== null}
              onClick={() => pick(s.key)}
              title={s.description}
              className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
                current ? tone.chip : "border-[#1e1e28] text-gray-400 hover:border-white/20 hover:text-gray-200"
              }`}
            >
              {busy === s.key ? "…" : s.key}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function OffDutyPanel({ memberId, onClockedOn }: { memberId: string; onClockedOn: () => void }) {
  const [busy, setBusy] = useState(false);

  const clockOn = async () => {
    setBusy(true);
    try {
      await fetchJson("/api/clock/in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId }),
      });
      toast.success("You are on duty");
      onClockedOn();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#1e1e28] bg-card px-4 py-3">
      <span className="flex-1 text-sm text-gray-400">
        You are off duty. Clock on to appear on the board — or go on duty in the city, if the City Link syncs duty.
      </span>
      <Button size="sm" onClick={clockOn} disabled={busy}>
        {busy ? "Clocking on…" : "Clock on"}
      </Button>
    </div>
  );
}
