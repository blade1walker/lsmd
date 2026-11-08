"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { CalendarOff, CalendarPlus, CheckCircle2, RefreshCw, Search, ShieldCheck, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useNow } from "@/components/roster/DutyStatus";
import { fetchJson, errorMessage } from "@/lib/fetch-json";
import { DAY_MS, LOA_LIMITS, dayCount, daysBetween, type LoaBoard, type LoaEntry } from "@/lib/loa";
import { toast } from "sonner";

const SOON_DAYS = 3;

function shortDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** yyyy-mm-dd for a date input, in local time. */
function inputDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** The start of a picked day, local time. */
function dayStart(value: string): string {
  return new Date(`${value}T00:00`).toISOString();
}

/** The end of a picked day, local time — leave runs through its last day. */
function dayEnd(value: string): string {
  return new Date(`${value}T23:59`).toISOString();
}

function who(entry: { name: string; callSign: string | null }) {
  return entry.callSign ? `${entry.callSign} · ${entry.name}` : entry.name;
}

/** Shows a warning when the leave changed but the Discord role could not follow. */
function noticeRole(result: { discordRole?: string | null }) {
  if (result.discordRole) toast.warning(result.discordRole);
}

export default function LoaPage() {
  const now = useNow();
  const [board, setBoard] = useState<LoaBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [placing, setPlacing] = useState<{ memberId: string } | null>(null);
  const [extending, setExtending] = useState<LoaEntry | null>(null);
  const [ending, setEnding] = useState<LoaEntry | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [showRecent, setShowRecent] = useState(false);
  const autoSynced = useRef(false);

  const load = useCallback(async () => {
    try {
      setBoard(await fetchJson<LoaBoard>("/api/loa/board"));
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const sync = useCallback(
    async (quiet = false) => {
      setSyncing(true);
      try {
        const result = await fetchJson<{ ok: boolean; error: string | null; added: string[]; removed: string[]; createdRole: boolean }>(
          "/api/loa/role-sync",
          { method: "POST" }
        );
        if (result.error) toast.error(result.error);
        else if (!quiet || result.added.length || result.removed.length || result.createdRole) {
          toast.success(
            `${result.createdRole ? "Created the role. " : ""}Given to ${result.added.length}, taken from ${result.removed.length}.`
          );
        }
      } catch (err) {
        toast.error(errorMessage(err));
      } finally {
        setSyncing(false);
        load();
      }
    },
    [load]
  );

  useEffect(() => {
    const first = setTimeout(() => load(), 0);
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 60_000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [load]);

  // The first time the section is opened with everything set up, give the
  // role to everyone who was already on leave before it existed.
  useEffect(() => {
    if (!board || autoSynced.current) return;
    const { role, canManage } = board;
    if (canManage && role.autoRole && role.guildId && role.botTokenSet && !role.lastSyncAt) {
      autoSynced.current = true;
      const timer = setTimeout(() => sync(true), 0);
      return () => clearTimeout(timer);
    }
  }, [board, sync]);

  const refresh = () => {
    setRefreshing(true);
    load();
  };

  const decide = async (entry: LoaEntry, status: "Approved" | "Declined") => {
    if (!entry.id) return;
    setBusyId(entry.id);
    try {
      const result = await fetchJson<{ discordRole?: string | null }>(`/api/loa/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      toast.success(status === "Approved" ? `${entry.name} is on leave` : `Request from ${entry.name} declined`);
      noticeRole(result);
      load();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

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
  if (error && !board) return <ErrorState title="Failed to load the LOA section" message={error} onRetry={refresh} />;
  if (!board) return null;

  const t = now ?? 0;
  const returningSoon = board.onLeave.filter((e) => e.endDate && Date.parse(e.endDate) >= t && Date.parse(e.endDate) - t <= SOON_DAYS * DAY_MS);
  const overdue = board.onLeave.filter((e) => e.endDate && Date.parse(e.endDate) < t);

  return (
    <div className="max-w-7xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-oswald)] text-2xl font-bold uppercase text-white">Leave of Absence</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            Everyone on leave, how long they have been away and when they are back. Members on leave hold the{" "}
            <span className="text-amber-300">{board.role.roleName}</span> role in Discord for as long as it lasts.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={refresh} disabled={refreshing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          {board.canManage && (
            <Button onClick={() => setPlacing({ memberId: "" })}>
              <CalendarPlus className="mr-2 h-4 w-4" />
              Put on LOA
            </Button>
          )}
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Tile label="On leave now" value={board.onLeave.length} tone="text-amber-300" />
        <Tile label={`Back within ${SOON_DAYS} days`} value={returningSoon.length} tone="text-emerald-300" />
        <Tile label="Past their end date" value={overdue.length} tone={overdue.length ? "text-red-300" : "text-white"} />
        <Tile label="Starting soon" value={board.upcoming.length} tone="text-white" />
        <Tile label="Requests waiting" value={board.pending.length} tone={board.pending.length ? "text-sky-300" : "text-white"} />
      </div>

      <RoleCard board={board} syncing={syncing} onSync={() => sync(false)} onSaved={load} />

      {/* On leave */}
      <section className="mb-6">
        <SectionTitle title="On leave now" count={board.onLeave.length} />
        {board.onLeave.length === 0 ? (
          <Empty text="Nobody is on leave." />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[#1e1e28] bg-card">
            <table className="w-full min-w-[960px] text-sm">
              <thead>
                <tr className="border-b border-[#1e1e28] text-left text-xs uppercase tracking-wider text-gray-500">
                  <th className="px-4 py-3 font-medium">Member</th>
                  <th className="px-4 py-3 font-medium">Since</th>
                  <th className="px-4 py-3 font-medium">On leave for</th>
                  <th className="px-4 py-3 font-medium">Back</th>
                  <th className="px-4 py-3 font-medium">Reason</th>
                  <th className="px-4 py-3 font-medium">Approved by</th>
                  {board.canManage && <th className="px-4 py-3 text-right font-medium">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {board.onLeave.map((e) => {
                  const away = e.startDate && now !== null ? daysBetween(e.startDate, t) : null;
                  const left = e.endDate && now !== null ? Math.ceil((Date.parse(e.endDate) - t) / DAY_MS) : null;
                  const planned = e.startDate && e.endDate ? daysBetween(e.startDate, e.endDate) + 1 : null;
                  return (
                    <tr key={e.id ?? `roster-${e.memberId}`} className="border-b border-[#1e1e28]/60 last:border-b-0">
                      <td className="px-4 py-3">
                        <div className="text-gray-200">
                          {e.callSign && <span className="font-[family-name:var(--font-mono)] font-bold text-white">{e.callSign} </span>}
                          {e.name}
                        </div>
                        <div className="text-[11px] text-gray-500">
                          {e.rank}
                          {!e.hasDiscord && <span className="text-amber-400/80"> · no Discord ID</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">{e.startDate ? shortDate(e.startDate) : "Unknown"}</td>
                      <td className="px-4 py-3">
                        {/* Counted the way leave is talked about: the first day is day 1. */}
                        <span className="font-[family-name:var(--font-oswald)] text-lg font-semibold text-amber-300">
                          {away === null ? "—" : `Day ${away + 1}`}
                        </span>
                        {planned !== null && <span className="ml-1.5 text-[11px] text-gray-600">of {planned}</span>}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {!e.endDate ? (
                          <span className="text-gray-500">No end date</span>
                        ) : (
                          <>
                            <div className="text-gray-300">{shortDate(e.endDate)}</div>
                            {left !== null && (
                              <div className={left < 0 ? "text-red-300" : left <= SOON_DAYS ? "text-emerald-300" : "text-gray-500"}>
                                {left < 0 ? `${dayCount(-left)} overdue` : left === 0 ? "back today" : `in ${dayCount(left)}`}
                              </div>
                            )}
                          </>
                        )}
                      </td>
                      <td className="max-w-[260px] px-4 py-3 text-xs text-gray-400">
                        {e.id ? (
                          <span className="line-clamp-2">{e.reason ?? "—"}</span>
                        ) : (
                          <span className="text-gray-500">Set to LOA on the roster — no leave record</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {e.approvedBy ?? (e.requestedBy && e.requestedBy !== "self" ? e.requestedBy : "—")}
                        {e.requestedBy === "self" && <div className="text-[11px] text-gray-600">Requested by the member</div>}
                      </td>
                      {board.canManage && (
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          {e.id ? (
                            <>
                              <Button size="sm" variant="ghost" onClick={() => setExtending(e)}>
                                Change end
                              </Button>
                              <Button size="sm" variant="ghost" className="text-emerald-300" onClick={() => setEnding(e)}>
                                End leave
                              </Button>
                            </>
                          ) : (
                            <Button size="sm" variant="ghost" onClick={() => setPlacing({ memberId: e.memberId })}>
                              Add dates
                            </Button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {board.upcoming.length > 0 && (
        <section className="mb-6">
          <SectionTitle title="Starting soon" count={board.upcoming.length} />
          <div className="divide-y divide-[#1e1e28] rounded-xl border border-[#1e1e28] bg-card">
            {board.upcoming.map((e) => (
              <div key={e.id} className="flex flex-wrap items-center gap-4 px-4 py-3">
                <div className="min-w-[200px] flex-1">
                  <div className="text-sm text-gray-200">{who(e)}</div>
                  <div className="text-[11px] text-gray-500">{e.reason}</div>
                </div>
                <div className="text-xs text-gray-400">
                  {shortDate(e.startDate)} – {shortDate(e.endDate)}
                  {now !== null && e.startDate && (
                    <span className="ml-2 text-sky-300">starts in {dayCount(Math.ceil((Date.parse(e.startDate) - t) / DAY_MS))}</span>
                  )}
                </div>
                {board.canManage && (
                  <Button size="sm" variant="ghost" onClick={() => setEnding(e)}>
                    Cancel
                  </Button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mb-6">
        <SectionTitle title="Requests waiting" count={board.pending.length} />
        {board.pending.length === 0 ? (
          <Empty text="No leave requests are waiting." />
        ) : (
          <div className="divide-y divide-[#1e1e28] rounded-xl border border-[#1e1e28] bg-card">
            {board.pending.map((e) => (
              <div key={e.id} className="flex flex-wrap items-center gap-4 px-4 py-3">
                <div className="min-w-[200px] flex-1">
                  <div className="text-sm text-gray-200">{who(e)}</div>
                  <div className="text-xs text-gray-400">{e.reason}</div>
                  <div className="text-[11px] text-gray-600">
                    {shortDate(e.startDate)} – {shortDate(e.endDate)}
                    {e.startDate && e.endDate && ` · ${dayCount(daysBetween(e.startDate, e.endDate) + 1)}`}
                    {e.createdAt && ` · asked ${shortDate(e.createdAt)}`}
                  </div>
                </div>
                {board.canManage && (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => decide(e, "Approved")} disabled={busyId === e.id}>
                      Approve
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => decide(e, "Declined")} disabled={busyId === e.id}>
                      Decline
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <button
          type="button"
          onClick={() => setShowRecent(!showRecent)}
          className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-400 hover:text-gray-200"
        >
          {showRecent ? "▾" : "▸"} Back from leave · last 30 days ({board.recent.length})
        </button>
        {showRecent &&
          (board.recent.length === 0 ? (
            <Empty text="Nobody has come back from leave in the last 30 days." />
          ) : (
            <div className="divide-y divide-[#1e1e28] rounded-xl border border-[#1e1e28] bg-card">
              {board.recent.map((e) => {
                const back = e.endedAt ?? e.endDate;
                return (
                  <div key={e.id} className="flex flex-wrap items-center gap-4 px-4 py-3 text-sm">
                    <div className="min-w-[200px] flex-1 text-gray-200">{who(e)}</div>
                    <div className="text-xs text-gray-400">
                      {shortDate(e.startDate)} – {shortDate(back)}
                      {e.startDate && back && ` · ${dayCount(Math.max(1, daysBetween(e.startDate, back)))}`}
                    </div>
                    <span className="rounded-md border border-white/10 px-2 py-0.5 text-[11px] text-gray-400">
                      {e.status === "Ended" ? `Ended early${e.endedBy ? ` by ${e.endedBy}` : ""}` : e.status}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
      </section>

      {placing && (
        <PlaceDialog
          board={board}
          initialMemberId={placing.memberId}
          onClose={() => setPlacing(null)}
          onDone={() => {
            setPlacing(null);
            load();
          }}
        />
      )}
      {extending && (
        <ExtendDialog
          entry={extending}
          onClose={() => setExtending(null)}
          onDone={() => {
            setExtending(null);
            load();
          }}
        />
      )}
      {ending && (
        <EndDialog
          entry={ending}
          now={t}
          onClose={() => setEnding(null)}
          onDone={() => {
            setEnding(null);
            load();
          }}
        />
      )}
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

function SectionTitle({ title, count }: { title: string; count: number }) {
  return (
    <h2 className="mb-3 font-[family-name:var(--font-oswald)] text-lg font-semibold uppercase text-white">
      {title} <span className="text-gray-600">· {count}</span>
    </h2>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-xl border border-dashed border-[#1e1e28] p-8 text-center text-sm text-gray-500">{text}</div>;
}

function RoleCard({
  board,
  syncing,
  onSync,
  onSaved,
}: {
  board: LoaBoard;
  syncing: boolean;
  onSync: () => void;
  onSaved: () => void;
}) {
  const { role, canManage } = board;
  const [guildId, setGuildId] = useState(role.guildSource === "settings" ? (role.guildId ?? "") : "");
  const [roleName, setRoleName] = useState(role.roleName);
  const [saving, setSaving] = useState(false);
  const last = role.lastSync;

  const save = async (patch: Record<string, unknown>) => {
    setSaving(true);
    try {
      await fetchJson("/api/loa/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      toast.success("Saved");
      onSaved();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const problem = !role.autoRole
    ? "Switched off — members going on leave are not given the role."
    : !role.botTokenSet
      ? "No Discord bot token is set. Add it in Notification settings → Bot, or set DISCORD_BOT_TOKEN."
      : !role.guildId
        ? "No Discord server is set. Set DISCORD_GUILD_ID, or enter the server ID below."
        : null;

  return (
    <section className="mb-6 rounded-xl border border-[#1e1e28] bg-card p-5">
      <div className="flex flex-wrap items-start gap-4">
        <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${problem ? "bg-white/5 text-gray-500" : "bg-amber-500/15 text-amber-300"}`}>
          <ShieldCheck className="h-5 w-5" />
        </span>
        <div className="min-w-[240px] flex-1">
          <div className="font-semibold text-white">{role.roleName} Discord role</div>
          {problem ? (
            <p className="mt-0.5 text-sm text-amber-200/90">{problem}</p>
          ) : (
            <p className="mt-0.5 text-sm text-gray-400">
              Given automatically when leave is approved or placed, and taken away when it ends.{" "}
              {role.roleId ? (
                <span className="text-gray-600">Role ID {role.roleId}{role.roleFromEnv ? " (DISCORD_LOA_ROLE_ID)" : ""}.</span>
              ) : (
                <span className="text-gray-500">Found in the server by name, or created there, on the first sync.</span>
              )}
            </p>
          )}
        </div>
        {canManage && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => save({ autoRole: !role.autoRole })} disabled={saving}>
              {role.autoRole ? "Turn off" : "Turn on"}
            </Button>
            <Button onClick={onSync} disabled={syncing || !!problem}>
              <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing…" : "Sync now"}
            </Button>
          </div>
        )}
      </div>

      {last && (
        <div className="mt-4 rounded-lg border border-[#1e1e28] bg-[#0a0a0f] p-3 text-xs">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-gray-500">
            {last.ok ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <XCircle className="h-4 w-4 text-red-400" />}
            Last sync {role.lastSyncAt ? new Date(role.lastSyncAt).toLocaleString() : ""} by {last.ranBy}
            {last.createdRole && <span className="text-amber-300">· created the role</span>}
          </div>
          {last.error ? (
            <p className="text-red-300">{last.error}</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              <SyncList
                title={last.method === "roster" ? "Now hold the role" : "Given the role"}
                names={last.added}
                empty={last.method === "roster" ? "Nobody on leave" : "Nobody needed it"}
              />
              <SyncList
                title={last.method === "roster" ? "No longer hold it" : "Role taken away"}
                names={last.removed}
                empty={last.method === "roster" ? "Nobody returned from leave" : "Nobody needed it removed"}
              />
              {last.method === "member-list" && <div className="text-gray-500">Already right: {last.unchanged}</div>}
              {last.skipped.length > 0 && (
                <div className="sm:col-span-2 text-gray-500">
                  Skipped: {last.skipped.map((s) => `${s.name} (${s.reason})`).join(", ")}
                </div>
              )}
              {last.failed.length > 0 && (
                <div className="sm:col-span-2 text-red-300">
                  Failed: {last.failed.map((s) => `${s.name} — ${s.reason}`).join("; ")}
                </div>
              )}
              {last.method === "roster" && (
                <p className="sm:col-span-2 text-gray-600">
                  The bot cannot list the server&apos;s members (Server Members Intent is off), so the role was given to everyone
                  on leave and taken from everyone whose leave has ended.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {canManage && (
        <div className="mt-4 grid gap-3 border-t border-[#1e1e28] pt-4 sm:grid-cols-[1fr_1fr_auto]">
          <div>
            <Label>Role name</Label>
            <Input value={roleName} onChange={(e) => setRoleName(e.target.value)} maxLength={100} className="mt-1" />
          </div>
          <div>
            <Label>Discord server ID</Label>
            <Input
              value={role.guildSource === "env" ? (role.guildId ?? "") : guildId}
              onChange={(e) => setGuildId(e.target.value)}
              disabled={role.guildSource === "env"}
              placeholder="Right-click the server → Copy Server ID"
              className="mt-1 font-[family-name:var(--font-mono)]"
            />
            {role.guildSource === "env" && <p className="mt-1 text-[11px] text-gray-600">Set by DISCORD_GUILD_ID.</p>}
          </div>
          <div className="flex items-end">
            <Button
              variant="outline"
              disabled={saving || (roleName.trim() === role.roleName && (role.guildSource === "env" || guildId.trim() === (role.guildId ?? "")))}
              onClick={() => save({ roleName, ...(role.guildSource === "env" ? {} : { guildId }) })}
            >
              Save
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

function SyncList({ title, names, empty }: { title: string; names: string[]; empty: string }) {
  return (
    <div>
      <div className="text-gray-400">
        {title}: <span className="text-gray-200">{names.length}</span>
      </div>
      <div className="text-gray-500">{names.length ? names.join(", ") : empty}</div>
    </div>
  );
}

function PlaceDialog({
  board,
  initialMemberId,
  onClose,
  onDone,
}: {
  board: LoaBoard;
  initialMemberId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  // A roster-only entry ("Add dates") is on LOA already, so it is not among
  // the candidates; it comes from the on-leave list instead.
  const people = useMemo(() => {
    const flagged = board.onLeave
      .filter((e) => !e.id)
      .map((e) => ({ id: e.memberId, name: e.name, callSign: e.callSign, rank: e.rank, activity: "LOA" }));
    return [...flagged, ...board.candidates];
  }, [board]);

  const today = useMemo(() => inputDate(new Date()), []);
  const [memberId, setMemberId] = useState(initialMemberId);
  const [query, setQuery] = useState("");
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(() => inputDate(new Date(Date.now() + 7 * DAY_MS)));
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [notify, setNotify] = useState(true);
  const [saving, setSaving] = useState(false);

  const chosen = people.find((p) => p.id === memberId) ?? null;
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return people.filter((p) => [p.name, p.callSign, p.rank].some((v) => v?.toLowerCase().includes(q))).slice(0, 8);
  }, [people, query]);

  const submit = async () => {
    setSaving(true);
    try {
      const result = await fetchJson<{ discordRole?: string | null }>("/api/loa/place", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId,
          // Today means "from now", so a leave placed this afternoon is not
          // shown as having started at midnight.
          startDate: start === today ? undefined : dayStart(start),
          endDate: dayEnd(end),
          reason,
          notes,
          notify,
        }),
      });
      toast.success(`${chosen?.name ?? "Member"} is on leave until ${new Date(dayEnd(end)).toLocaleDateString()}`);
      noticeRole(result);
      onDone();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[min(32rem,calc(100vw-2rem))]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarOff className="h-5 w-5 text-amber-300" />
            Put on LOA
          </DialogTitle>
        </DialogHeader>
        <div className="mt-4 space-y-4">
          <div>
            <Label>Member</Label>
            {chosen ? (
              <div className="mt-1 flex items-center justify-between rounded-md border border-[#1e1e28] px-3 py-2 text-sm">
                <span className="text-gray-200">
                  {who(chosen)} <span className="text-gray-500">· {chosen.rank}</span>
                </span>
                <button type="button" onClick={() => setMemberId("")} className="text-xs text-red-400 hover:text-red-300">
                  Change
                </button>
              </div>
            ) : (
              <div className="relative mt-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-600" />
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name, call sign or rank" className="pl-9" autoFocus />
                {matches.length > 0 && (
                  <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border border-[#1e1e28] bg-[#111118] shadow-xl">
                    {matches.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setMemberId(p.id);
                            setQuery("");
                          }}
                          className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-gray-200 hover:bg-white/5"
                        >
                          <span>{who(p)}</span>
                          <span className="text-xs text-gray-500">
                            {p.rank}
                            {p.activity !== "Active" && ` · ${p.activity}`}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>From</Label>
              <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Until (last day of leave)</Label>
              <Input type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} className="mt-1" />
            </div>
          </div>
          <div>
            <Label>Reason</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={LOA_LIMITS.reason} placeholder="e.g. Real-life commitments" className="mt-1" />
          </div>
          <div>
            <Label>Notes for HR (optional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={LOA_LIMITS.notes} rows={2} className="mt-1" />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="accent-red-600" />
            Tell them and post it, the same as an approved request
          </label>
        </div>
        <DialogFooter className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving || !memberId || !reason.trim() || !end}>
            {saving ? "Saving…" : "Put on LOA"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ExtendDialog({ entry, onClose, onDone }: { entry: LoaEntry; onClose: () => void; onDone: () => void }) {
  const [end, setEnd] = useState(() => inputDate(entry.endDate ? new Date(entry.endDate) : new Date()));
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      await fetchJson(`/api/loa/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endDate: dayEnd(end) }),
      });
      toast.success(`${entry.name} is now back on ${new Date(dayEnd(end)).toLocaleDateString()}`);
      onDone();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[min(26rem,calc(100vw-2rem))]">
        <DialogHeader>
          <DialogTitle>Change the end date</DialogTitle>
        </DialogHeader>
        <p className="mt-2 text-sm text-gray-400">{who(entry)} · on leave since {shortDate(entry.startDate)}</p>
        <div className="mt-4">
          <Label>Last day of leave</Label>
          <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="mt-1" />
        </div>
        <DialogFooter className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving || !end}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EndDialog({ entry, now, onClose, onDone }: { entry: LoaEntry; now: number; onClose: () => void; onDone: () => void }) {
  const [saving, setSaving] = useState(false);
  const upcoming = !!entry.startDate && Date.parse(entry.startDate) > now;

  const submit = async () => {
    setSaving(true);
    try {
      const result = await fetchJson<{ discordRole?: string | null }>(`/api/loa/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: upcoming ? "Cancelled" : "Ended" }),
      });
      toast.success(upcoming ? `${entry.name}'s leave is cancelled` : `${entry.name} is back from leave`);
      noticeRole(result);
      onDone();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[min(26rem,calc(100vw-2rem))]">
        <DialogHeader>
          <DialogTitle>{upcoming ? "Cancel this leave?" : "End this leave now?"}</DialogTitle>
        </DialogHeader>
        <p className="mt-2 text-sm text-gray-400">
          {who(entry)} goes back to Active on the roster and loses the EMS LOA role
          {upcoming ? "." : ` — ${entry.endDate ? `${dayCount(Math.max(0, Math.ceil((Date.parse(entry.endDate) - now) / DAY_MS)))} early` : "now"}.`}
        </p>
        <DialogFooter className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Keep it
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Saving…" : upcoming ? "Cancel leave" : "End leave"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
