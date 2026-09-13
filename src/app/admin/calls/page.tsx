"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { Plus, Search, Star, X, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { fetchJson, fetchList, errorMessage } from "@/lib/fetch-json";
import {
  CALL_NATURES,
  CALL_OUTCOMES,
  CALL_PRIORITIES,
  HOSPITALS,
  TRANSPORT_OUTCOME,
  type CallStats,
  type EmsCallRecord,
} from "@/lib/calls";
import { toast } from "sonner";

interface RosterMember {
  id: string;
  name: string;
  callSign: string | null;
  rank: string;
}

interface CallForm {
  occurredAt: string;
  location: string;
  nature: string;
  priority: string;
  outcome: string;
  hospital: string;
  hospitalOther: string;
  patientName: string;
  patientStateId: string;
  notes: string;
  medicalDocumentNumber: string;
  responders: { memberId: string; role: "Lead" | "Responder" }[];
}

const PRIORITY_STYLES: Record<string, string> = {
  P1: "border-red-500/40 bg-red-500/15 text-red-300",
  P2: "border-amber-500/40 bg-amber-500/15 text-amber-300",
  P3: "border-sky-500/40 bg-sky-500/15 text-sky-300",
};

const OUTCOME_STYLES: Record<string, string> = {
  "Treated on Scene": "bg-emerald-500/15 text-emerald-300",
  Transported: "bg-sky-500/15 text-sky-300",
  "Transferred Care": "bg-violet-500/15 text-violet-300",
  "Refused Treatment": "bg-amber-500/15 text-amber-300",
  "Deceased on Scene": "bg-red-500/15 text-red-300",
  "No Patient Found": "bg-gray-500/15 text-gray-400",
  Cancelled: "bg-gray-500/15 text-gray-400",
};

/** A datetime-local value in the viewer's own time zone. */
function toLocalInput(date: Date): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function blankForm(selfMemberId: string | null | undefined): CallForm {
  return {
    occurredAt: toLocalInput(new Date()),
    location: "",
    nature: "",
    priority: "P2",
    outcome: "",
    hospital: "",
    hospitalOther: "",
    patientName: "",
    patientStateId: "",
    notes: "",
    medicalDocumentNumber: "",
    // Whoever logs a call almost always ran it, so they start as the lead.
    responders: selfMemberId ? [{ memberId: selfMemberId, role: "Lead" }] : [],
  };
}

function formFromCall(call: EmsCallRecord): CallForm {
  const known = (HOSPITALS as readonly string[]).includes(call.hospital ?? "");
  return {
    occurredAt: toLocalInput(new Date(call.occurredAt)),
    location: call.location,
    nature: call.nature,
    priority: call.priority,
    outcome: call.outcome,
    hospital: call.hospital ? (known ? call.hospital : "__other") : "",
    hospitalOther: call.hospital && !known ? call.hospital : "",
    patientName: call.patientName ?? "",
    patientStateId: call.patientStateId ?? "",
    notes: call.notes ?? "",
    medicalDocumentNumber: call.medicalDocumentNumber ?? "",
    responders: call.responders.map((r) => ({ memberId: r.memberId, role: r.role === "Lead" ? "Lead" : "Responder" })),
  };
}

export default function CallLogPage() {
  const { data: session } = useSession();
  const permissions = session?.user?.permissions ?? [];
  const isSuper = !!session?.user?.isSuperAdmin;
  // UX only — every route enforces its own permission.
  const canViewAll = isSuper || permissions.includes("calls.view");
  const canCreate = isSuper || permissions.includes("calls.create");
  const canManage = isSuper || permissions.includes("calls.manage");

  const [calls, setCalls] = useState<EmsCallRecord[]>([]);
  const [stats, setStats] = useState<CallStats | null>(null);
  const [members, setMembers] = useState<RosterMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [nature, setNature] = useState("");
  const [outcome, setOutcome] = useState("");
  const [priority, setPriority] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [mine, setMine] = useState(false);

  const [editing, setEditing] = useState<EmsCallRecord | "new" | null>(null);
  const [form, setForm] = useState<CallForm>(() => blankForm(null));
  const [saving, setSaving] = useState(false);
  const [viewing, setViewing] = useState<EmsCallRecord | null>(null);
  const [responderQuery, setResponderQuery] = useState("");

  const loadStats = useCallback(async () => {
    try {
      setStats(await fetchJson<CallStats>("/api/calls/stats"));
    } catch {
      // The log itself still works without the figures.
    }
  }, []);

  const loadCalls = useCallback(async () => {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (nature) params.set("nature", nature);
    if (outcome) params.set("outcome", outcome);
    if (priority) params.set("priority", priority);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (mine) params.set("mine", "1");
    try {
      setCalls(await fetchList<EmsCallRecord>(`/api/calls?${params}`));
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [q, nature, outcome, priority, from, to, mine]);

  useEffect(() => {
    // Debounced, so typing in the search box does not fire a request per key.
    const timer = setTimeout(loadCalls, 250);
    return () => clearTimeout(timer);
  }, [loadCalls]);

  useEffect(() => {
    loadStats();
    fetchList<{ members?: RosterMember[] }>("/api/members")
      .then((sections) => setMembers(sections.flatMap((s) => s.members ?? [])))
      .catch(() => {});
  }, [loadStats]);

  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);

  const responderMatches = useMemo(() => {
    const query = responderQuery.trim().toLowerCase();
    if (!query) return [];
    const chosen = new Set(form.responders.map((r) => r.memberId));
    return members
      .filter((m) => !chosen.has(m.id) && [m.name, m.callSign].some((v) => v?.toLowerCase().includes(query)))
      .slice(0, 8);
  }, [responderQuery, members, form.responders]);

  const openNew = () => {
    setForm(blankForm(session?.user?.memberId));
    setResponderQuery("");
    setEditing("new");
  };

  const openEdit = (call: EmsCallRecord) => {
    setForm(formFromCall(call));
    setResponderQuery("");
    setViewing(null);
    setEditing(call);
  };

  const edit = (patch: Partial<CallForm>) => setForm((prev) => ({ ...prev, ...patch }));

  const addResponder = (memberId: string) => {
    setForm((prev) => ({
      ...prev,
      responders: [...prev.responders, { memberId, role: prev.responders.length === 0 ? "Lead" : "Responder" }],
    }));
    setResponderQuery("");
  };

  const removeResponder = (memberId: string) =>
    setForm((prev) => {
      const remaining = prev.responders.filter((r) => r.memberId !== memberId);
      // Never leave the call without a lead.
      if (remaining.length && !remaining.some((r) => r.role === "Lead")) remaining[0] = { ...remaining[0], role: "Lead" };
      return { ...prev, responders: remaining };
    });

  const makeLead = (memberId: string) =>
    setForm((prev) => ({
      ...prev,
      responders: prev.responders.map((r) => ({ ...r, role: r.memberId === memberId ? "Lead" : "Responder" })),
    }));

  const submit = async () => {
    setSaving(true);
    try {
      const hospital = form.hospital === "__other" ? form.hospitalOther : form.hospital;
      const body = JSON.stringify({
        ...form,
        hospital,
        occurredAt: new Date(form.occurredAt).toISOString(),
      });
      const isNew = editing === "new";
      const saved = await fetchJson<EmsCallRecord>(isNew ? "/api/calls" : `/api/calls/${(editing as EmsCallRecord).id}`, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body,
      });
      toast.success(isNew ? `Logged as ${saved.callNumber}` : `${saved.callNumber} updated`);
      setEditing(null);
      loadCalls();
      loadStats();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (call: EmsCallRecord) => {
    if (!confirm(`Delete ${call.callNumber}? This cannot be undone.`)) return;
    try {
      await fetchJson(`/api/calls/${call.id}`, { method: "DELETE" });
      toast.success(`${call.callNumber} deleted`);
      setViewing(null);
      loadCalls();
      loadStats();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const mayEdit = (call: EmsCallRecord) => canManage || (canCreate && call.createdByDiscordId === session?.user?.discordId);
  const filtersActive = !!(q || nature || outcome || priority || from || to || mine);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <div className="grid gap-3 sm:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }
  if (error && calls.length === 0) return <ErrorState title="Failed to load the call log" message={error} onRetry={loadCalls} />;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-oswald)] text-2xl font-bold uppercase text-white">EMS Call Log</h1>
          <p className="mt-1 text-sm text-gray-500">
            {canViewAll
              ? "Every patient contact and EMS response across the department."
              : "The calls you logged or responded to."}
          </p>
        </div>
        {canCreate && (
          <Button onClick={openNew}>
            <Plus className="mr-2 h-4 w-4" />
            Log a call
          </Button>
        )}
      </div>

      {stats && (
        <div className="mb-6 grid gap-3 lg:grid-cols-[repeat(4,minmax(0,1fr))_1.4fr_1.4fr]">
          {[
            { label: "Today", value: stats.today },
            { label: "Last 7 days", value: stats.last7Days },
            { label: "Last 30 days", value: stats.last30Days },
            { label: "Transport rate", value: `${stats.transportRate}%` },
          ].map((tile) => (
            <div key={tile.label} className="rounded-xl border border-[#1e1e28] bg-card px-4 py-3">
              <div className="text-[11px] uppercase tracking-wider text-gray-500">{tile.label}</div>
              <div className="font-[family-name:var(--font-oswald)] text-2xl font-bold text-white">{tile.value}</div>
            </div>
          ))}
          <div className="rounded-xl border border-[#1e1e28] bg-card px-4 py-3">
            <div className="mb-1.5 text-[11px] uppercase tracking-wider text-gray-500">Top call types · 30 days</div>
            {stats.byNature.length === 0 ? (
              <div className="text-xs text-gray-600">No calls yet</div>
            ) : (
              <ul className="space-y-0.5 text-xs">
                {stats.byNature.slice(0, 4).map((n) => (
                  <li key={n.nature} className="flex justify-between gap-2">
                    <span className="truncate text-gray-300">{n.nature}</span>
                    <span className="font-[family-name:var(--font-mono)] text-gray-500">{n.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="rounded-xl border border-[#1e1e28] bg-card px-4 py-3">
            <div className="mb-1.5 text-[11px] uppercase tracking-wider text-gray-500">
              {stats.departmentWide ? "Most active medics · 30 days" : "Your calls · 30 days"}
            </div>
            {stats.topResponders.length === 0 ? (
              <div className="text-xs text-gray-600">No calls yet</div>
            ) : (
              <ul className="space-y-0.5 text-xs">
                {stats.topResponders.slice(0, 4).map((r) => (
                  <li key={r.memberId} className="flex justify-between gap-2">
                    <span className="truncate text-gray-300">
                      {r.name}
                      {r.callSign && <span className="text-gray-600"> · {r.callSign}</span>}
                    </span>
                    <span className="font-[family-name:var(--font-mono)] text-gray-500">{r.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-600" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Call no., location, patient, State ID..."
            className="pl-9"
          />
        </div>
        <Select value={nature} onChange={(e) => setNature(e.target.value)} className="w-48">
          <option value="">All call types</option>
          {CALL_NATURES.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </Select>
        <Select value={outcome} onChange={(e) => setOutcome(e.target.value)} className="w-44">
          <option value="">All outcomes</option>
          {CALL_OUTCOMES.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </Select>
        <div className="flex gap-1">
          {CALL_PRIORITIES.map((p) => (
            <button
              key={p.key}
              type="button"
              title={p.label}
              onClick={() => setPriority(priority === p.key ? "" : p.key)}
              className={`rounded-md border px-2.5 py-1.5 text-xs font-bold ${
                priority === p.key ? PRIORITY_STYLES[p.key] : "border-[#1e1e28] text-gray-500 hover:text-gray-300"
              }`}
            >
              {p.key}
            </button>
          ))}
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-gray-500">From</label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-gray-500">To</label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
        </div>
        {canViewAll && (
          <label className="flex items-center gap-2 pb-2 text-sm text-gray-400">
            <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} className="accent-red-600" />
            My calls
          </label>
        )}
        {filtersActive && (
          <button
            type="button"
            onClick={() => {
              setQ("");
              setNature("");
              setOutcome("");
              setPriority("");
              setFrom("");
              setTo("");
              setMine(false);
            }}
            className="pb-2 text-xs text-red-400 hover:text-red-300"
          >
            Clear filters
          </button>
        )}
      </div>

      {calls.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#1e1e28] p-12 text-center">
          <p className="text-sm text-gray-500">
            {filtersActive ? "No calls match these filters." : "No calls logged yet."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#1e1e1e] bg-card">
          <table className="w-full min-w-[1000px] text-sm">
            <thead>
              <tr className="border-b border-[#1e1e1e] text-left text-xs uppercase tracking-wider text-gray-500">
                <th className="px-4 py-3 font-medium">Call No.</th>
                <th className="px-4 py-3 font-medium">When</th>
                <th className="px-4 py-3 font-medium">Pri.</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Location</th>
                <th className="px-4 py-3 font-medium">Patient</th>
                <th className="px-4 py-3 font-medium">Outcome</th>
                <th className="px-4 py-3 font-medium">Responders</th>
              </tr>
            </thead>
            <tbody>
              {calls.map((call) => (
                <tr
                  key={call.id}
                  onClick={() => setViewing(call)}
                  className="cursor-pointer border-b border-[#1e1e1e]/50 transition-colors hover:bg-white/5"
                >
                  <td className="whitespace-nowrap px-4 py-3 font-[family-name:var(--font-mono)] text-xs text-blue-400">
                    {call.callNumber}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-400">{formatWhen(call.occurredAt)}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded border px-1.5 py-0.5 text-[11px] font-bold ${PRIORITY_STYLES[call.priority] ?? ""}`}>
                      {call.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-200">{call.nature}</td>
                  <td className="max-w-[220px] truncate px-4 py-3 text-gray-400">{call.location}</td>
                  <td className="px-4 py-3">
                    {call.patientName ? (
                      <>
                        <div className="text-gray-200">{call.patientName}</div>
                        {call.patientStateId && <div className="text-xs text-gray-600">State ID {call.patientStateId}</div>}
                      </>
                    ) : (
                      <span className="text-gray-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`whitespace-nowrap rounded px-2 py-0.5 text-xs ${OUTCOME_STYLES[call.outcome] ?? ""}`}>
                      {call.outcome}
                    </span>
                    {call.hospital && <div className="mt-0.5 truncate text-[11px] text-gray-600">{call.hospital}</div>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {call.responders.map((r) => r.callSign ?? r.name).join(", ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Call details */}
      <Dialog open={viewing !== null} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="max-w-lg">
          {viewing && (
            <>
              <DialogHeader>
                <DialogTitle>
                  <span className="font-[family-name:var(--font-mono)]">{viewing.callNumber}</span>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded border px-1.5 py-0.5 text-[11px] font-bold ${PRIORITY_STYLES[viewing.priority] ?? ""}`}>
                    {viewing.priority}
                  </span>
                  <span className="font-semibold text-white">{viewing.nature}</span>
                  <span className={`rounded px-2 py-0.5 text-xs ${OUTCOME_STYLES[viewing.outcome] ?? ""}`}>{viewing.outcome}</span>
                </div>
                <dl className="grid grid-cols-[120px_1fr] gap-x-3 gap-y-2">
                  <dt className="text-gray-500">When</dt>
                  <dd className="text-gray-200">{formatWhen(viewing.occurredAt)}</dd>
                  <dt className="text-gray-500">Location</dt>
                  <dd className="text-gray-200">{viewing.location}</dd>
                  {viewing.hospital && (
                    <>
                      <dt className="text-gray-500">Hospital</dt>
                      <dd className="text-gray-200">{viewing.hospital}</dd>
                    </>
                  )}
                  <dt className="text-gray-500">Patient</dt>
                  <dd className="text-gray-200">
                    {viewing.patientName ?? "—"}
                    {viewing.patientStateId && <span className="text-gray-500"> · State ID {viewing.patientStateId}</span>}
                  </dd>
                  <dt className="text-gray-500">Responders</dt>
                  <dd className="space-y-0.5 text-gray-200">
                    {viewing.responders.map((r) => (
                      <div key={r.memberId}>
                        {r.name}
                        {r.callSign && <span className="text-gray-500"> · {r.callSign}</span>}
                        {r.role === "Lead" && <span className="ml-1.5 text-[10px] uppercase text-amber-400">Lead</span>}
                      </div>
                    ))}
                  </dd>
                  {viewing.medicalDocumentNumber && (
                    <>
                      <dt className="text-gray-500">Document</dt>
                      <dd className="font-[family-name:var(--font-mono)] text-xs text-gray-200">{viewing.medicalDocumentNumber}</dd>
                    </>
                  )}
                  <dt className="text-gray-500">Logged by</dt>
                  <dd className="text-gray-400">{viewing.createdByName}</dd>
                </dl>
                {viewing.notes && (
                  <div className="whitespace-pre-wrap rounded-lg border border-[#1e1e28] bg-[#0a0a0f] p-3 text-gray-300">
                    {viewing.notes}
                  </div>
                )}
              </div>
              <DialogFooter>
                {canManage && (
                  <Button variant="ghost" className="text-red-400" onClick={() => remove(viewing)}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                )}
                {mayEdit(viewing) && (
                  <Button variant="outline" onClick={() => openEdit(viewing)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Log / edit */}
      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing === "new" ? "Log a call" : `Edit ${(editing as EmsCallRecord | null)?.callNumber ?? ""}`}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>When</Label>
                <Input type="datetime-local" value={form.occurredAt} onChange={(e) => edit({ occurredAt: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label>Priority</Label>
                <div className="mt-1 flex gap-1">
                  {CALL_PRIORITIES.map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => edit({ priority: p.key })}
                      className={`flex-1 rounded-md border px-2 py-2 text-xs font-semibold ${
                        form.priority === p.key ? PRIORITY_STYLES[p.key] : "border-[#1e1e28] text-gray-500 hover:text-gray-300"
                      }`}
                    >
                      {p.key} · {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Call type</Label>
                <Select value={form.nature} onChange={(e) => edit({ nature: e.target.value })} className="mt-1">
                  <option value="">Select…</option>
                  {CALL_NATURES.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Location</Label>
                <Input
                  value={form.location}
                  maxLength={120}
                  onChange={(e) => edit({ location: e.target.value })}
                  placeholder="e.g. Legion Square, Vinewood Blvd"
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label>Responding medics</Label>
              <div className="mt-1 flex flex-wrap gap-2">
                {form.responders.map((r) => {
                  const member = memberById.get(r.memberId);
                  return (
                    <span
                      key={r.memberId}
                      className={`inline-flex items-center gap-1.5 rounded-full border py-1 pl-2 pr-1 text-xs ${
                        r.role === "Lead" ? "border-amber-500/50 bg-amber-500/10 text-amber-200" : "border-[#2a2a33] bg-white/5 text-gray-300"
                      }`}
                    >
                      <button
                        type="button"
                        title={r.role === "Lead" ? "Lead medic" : "Make lead"}
                        onClick={() => makeLead(r.memberId)}
                        className={r.role === "Lead" ? "text-amber-400" : "text-gray-600 hover:text-amber-400"}
                      >
                        <Star className="h-3 w-3" fill={r.role === "Lead" ? "currentColor" : "none"} />
                      </button>
                      {member ? `${member.name}${member.callSign ? ` · ${member.callSign}` : ""}` : "Unknown member"}
                      <button
                        type="button"
                        aria-label="Remove"
                        onClick={() => removeResponder(r.memberId)}
                        className="rounded-full p-0.5 text-gray-500 hover:bg-white/10 hover:text-white"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  );
                })}
              </div>
              <Input
                value={responderQuery}
                onChange={(e) => setResponderQuery(e.target.value)}
                placeholder="Add a medic by name or call sign"
                className="mt-2"
              />
              {responderMatches.length > 0 && (
                <div className="mt-1 divide-y divide-[#1e1e28] rounded-lg border border-[#1e1e28]">
                  {responderMatches.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => addResponder(m.id)}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-white/5"
                    >
                      <span className="text-white">{m.name}</span>
                      <span className="text-gray-500">
                        {m.callSign ? ` · ${m.callSign}` : ""} · {m.rank}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              <p className="mt-1 text-xs text-gray-600">The starred medic is the lead — the one in charge of the patient.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Patient name</Label>
                <Input value={form.patientName} maxLength={80} onChange={(e) => edit({ patientName: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label>Patient State ID</Label>
                <Input
                  value={form.patientStateId}
                  maxLength={20}
                  onChange={(e) => edit({ patientStateId: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Outcome</Label>
                <Select value={form.outcome} onChange={(e) => edit({ outcome: e.target.value })} className="mt-1">
                  <option value="">Select…</option>
                  {CALL_OUTCOMES.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </Select>
              </div>
              {form.outcome === TRANSPORT_OUTCOME && (
                <div>
                  <Label>Receiving hospital</Label>
                  <Select value={form.hospital} onChange={(e) => edit({ hospital: e.target.value })} className="mt-1">
                    <option value="">Select…</option>
                    {HOSPITALS.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                    <option value="__other">Other…</option>
                  </Select>
                  {form.hospital === "__other" && (
                    <Input
                      value={form.hospitalOther}
                      maxLength={80}
                      onChange={(e) => edit({ hospitalOther: e.target.value })}
                      placeholder="Facility name"
                      className="mt-2"
                    />
                  )}
                </div>
              )}
            </div>

            <div>
              <Label>Related medical document (optional)</Label>
              <Input
                value={form.medicalDocumentNumber}
                maxLength={40}
                onChange={(e) => edit({ medicalDocumentNumber: e.target.value })}
                placeholder="e.g. EMS-MED-2026-000124"
                className="mt-1 font-[family-name:var(--font-mono)]"
              />
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea
                value={form.notes}
                maxLength={2000}
                rows={3}
                onChange={(e) => edit({ notes: e.target.value })}
                placeholder="Brief summary of findings and care given"
                className="mt-1"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={saving}>
              {saving ? "Saving…" : editing === "new" ? "Log call" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
