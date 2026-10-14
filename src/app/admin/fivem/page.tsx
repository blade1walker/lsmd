"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSession } from "next-auth/react";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Gamepad2,
  Link2,
  Plug,
  RefreshCw,
  Search,
  ShieldAlert,
  UserX,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { fetchJson, errorMessage } from "@/lib/fetch-json";
import {
  CITY_SOURCE_LABELS,
  MATCH_METHOD_LABELS,
  type CityPlayer,
  type CityStatusFull,
  type FiveMSettingsView,
  type ProbeResult,
} from "@/lib/fivem";
import { toast } from "sonner";

interface CityLinkData {
  settings: FiveMSettingsView;
  status: CityStatusFull;
}

type Toggle = "showPublicStatus" | "showPublicNames" | "matchByName" | "dutySync" | "statusSync" | "callSync";

const TOGGLES: { key: Toggle; label: string; help: string }[] = [
  { key: "dutySync", label: "Sync duty from the city", help: "Going on or off EMS duty in game clocks the member on or off the site. Leaving the city clocks them off." },
  { key: "statusSync", label: "In-game unit statuses", help: "/unitstatus in game updates the Duty Board." },
  { key: "callSync", label: "In-game call logging", help: "/emscall in game, or the LogCall export, adds the call to the Call Log." },
  { key: "showPublicStatus", label: "Show the server on the public site", help: "The home page and roster show whether the city is up, how full it is, and how many EMS are in it." },
  { key: "showPublicNames", label: "Show EMS names to the public", help: "Visitors who are not signed in also see who is in the city. Members always do." },
  { key: "matchByName", label: "Match by name as a fallback", help: "When no Discord or Steam ID matches, match a player whose character or player name is exactly a roster name. Names can collide — leave off unless identifiers are unavailable." },
];

type PlayerFilter = "all" | "ems" | "unmatched";

function ago(iso: string | null): string {
  if (!iso) return "never";
  const seconds = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.round(seconds / 3600)}h ago`;
  return `${Math.round(seconds / 86_400)}d ago`;
}

function since(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000));
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
}

export default function CityLinkPage() {
  const { data: session } = useSession();
  const permissions = session?.user?.permissions ?? [];
  // UX only — the routes enforce fivem.view and fivem.manage themselves.
  const canManage = !!session?.user?.isSuperAdmin || permissions.includes("fivem.manage");

  const [data, setData] = useState<CityLinkData | null>(null);
  const [form, setForm] = useState<FiveMSettingsView | null>(null);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [probes, setProbes] = useState<ProbeResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<PlayerFilter>("ems");
  const [q, setQ] = useState("");

  // Read by the auto-refresh, which must never overwrite what someone is typing.
  const dirtyRef = useRef(false);
  const markDirty = (value: boolean) => {
    dirtyRef.current = value;
    setDirty(value);
  };

  const load = useCallback(async (fresh = false) => {
    try {
      const next = await fetchJson<CityLinkData>(`/api/admin/fivem${fresh ? "?fresh=1" : ""}`);
      setData(next);
      setError(null);
      setForm((prev) => (prev && dirtyRef.current ? prev : next.settings));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const refresh = () => {
    setRefreshing(true);
    load(true);
  };

  // Loads now, then every 30 seconds while the tab is in view — the city
  // changes by the minute.
  useEffect(() => {
    const first = setTimeout(() => load(), 0);
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 30_000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [load]);

  const edit = (patch: Partial<FiveMSettingsView>) => {
    if (!form) return;
    setForm({ ...form, ...patch });
    markDirty(true);
  };

  const save = async () => {
    if (!form) return;
    setSaving(true);
    try {
      const saved = await fetchJson<FiveMSettingsView>("/api/admin/fivem", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serverAddress: form.serverAddress ?? "",
          joinCode: form.joinCode ?? "",
          ...Object.fromEntries(TOGGLES.map((t) => [t.key, form[t.key]])),
        }),
      });
      setForm(saved);
      markDirty(false);
      toast.success("City Link settings saved");
      const next = await fetchJson<CityLinkData>("/api/admin/fivem?fresh=1");
      setData(next);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    if (!form) return;
    setTesting(true);
    setProbes(null);
    try {
      const result = await fetchJson<{ probes: ProbeResult[] }>("/api/admin/fivem/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serverAddress: form.serverAddress ?? "", joinCode: form.joinCode ?? "" }),
      });
      setProbes(result.probes);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setTesting(false);
    }
  };

  const players = useMemo(() => {
    const list = data?.status.players ?? [];
    const query = q.trim().toLowerCase();
    return list.filter((p) => {
      if (filter === "ems" && !p.match && !p.isEms) return false;
      if (filter === "unmatched" && p.match) return false;
      if (!query) return true;
      return [p.name, p.characterName, p.match?.name, p.match?.callSign, String(p.serverId), p.job]
        .some((v) => v?.toLowerCase().includes(query));
    });
  }, [data, filter, q]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-28 w-full rounded-xl" />
        <div className="grid gap-3 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }
  if (error && !data) return <ErrorState title="Failed to load the City Link" message={error} onRetry={refresh} />;
  if (!data || !form) return null;

  const { status, settings } = data;
  const configured = !!(settings.serverAddress || settings.joinCode || status.heartbeat.at);
  const emsCount = status.players.filter((p) => p.match).length;
  const { mismatches } = status;

  return (
    <div className="max-w-7xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-oswald)] text-2xl font-bold uppercase text-white">City Link</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            The FiveM server, linked to the roster: who is in the city, whether in-game duty matches the duty clock, and
            the settings for duty sync, unit statuses and calls logged in game.
          </p>
        </div>
        <Button variant="outline" onClick={refresh} disabled={refreshing}>
          <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Server status */}
      <section className="mb-6 overflow-hidden rounded-xl border border-[#1e1e28] bg-card">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-4 px-5 py-4">
          <div className="flex min-w-[220px] flex-1 items-center gap-3">
            <span
              className={`flex h-11 w-11 items-center justify-center rounded-lg ${
                status.online ? "bg-emerald-500/15 text-emerald-400" : "bg-white/5 text-gray-500"
              }`}
            >
              <Gamepad2 className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${status.online ? "animate-pulse bg-emerald-400" : "bg-gray-600"}`} />
                <span className={`text-xs font-semibold uppercase tracking-wider ${status.online ? "text-emerald-300" : "text-gray-500"}`}>
                  {!configured ? "Not linked" : status.online ? "City online" : "City offline"}
                </span>
              </div>
              <div className="truncate font-[family-name:var(--font-oswald)] text-lg font-semibold text-white">
                {status.name ?? (configured ? "FiveM server" : "No server linked yet")}
              </div>
            </div>
          </div>
          <Metric label="Players" value={status.playerCount !== null ? `${status.playerCount}${status.maxPlayers ? ` / ${status.maxPlayers}` : ""}` : "—"} />
          <Metric label="EMS in city" value={status.online ? String(emsCount) : "—"} />
          <Metric label="Source" value={CITY_SOURCE_LABELS[status.source]} />
          <Metric
            label="Resource"
            value={status.heartbeat.fresh ? `Live · ${ago(status.heartbeat.at)}` : status.heartbeat.at ? `Silent · ${ago(status.heartbeat.at)}` : "Not installed"}
            tone={status.heartbeat.fresh ? "text-emerald-300" : status.heartbeat.at ? "text-amber-300" : "text-gray-500"}
          />
          {status.connectUrl && (
            <a
              href={status.connectUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
            >
              <Plug className="h-4 w-4" />
              Connect
            </a>
          )}
        </div>
        {(status.heartbeat.resourceVersion || status.heartbeat.framework) && status.heartbeat.fresh && (
          <div className="border-t border-[#1e1e28] px-5 py-2 text-xs text-gray-500">
            nexus-ems-sync {status.heartbeat.resourceVersion ?? ""} · framework {status.heartbeat.framework ?? "unknown"}
          </div>
        )}
        {status.pullError && (
          <Notice tone="red">Could not read the server: {status.pullError}</Notice>
        )}
        {status.identifiersHidden && (
          <Notice tone="amber">
            The server lists its players without their Discord or Steam IDs, so they cannot be matched to the roster
            {settings.matchByName ? " except by name" : ""}. Install the nexus-ems-sync resource (below) for exact
            matching, or add <code className="rounded bg-white/10 px-1">set sv_exposePlayerIdentifiersInHttpEndpoint true</code> to server.cfg.
          </Notice>
        )}
        {!settings.keyConfigured && (
          <Notice tone="amber">
            FIVEM_API_KEY is not set on the website, so the in-game resource cannot report duty, statuses or calls. The
            server can still be read from its address.
          </Notice>
        )}
      </section>

      {/* Mismatches */}
      {configured && (
        <section className="mb-6">
          <div className="mb-3 flex items-baseline justify-between gap-4">
            <h2 className="font-[family-name:var(--font-oswald)] text-lg font-semibold uppercase text-white">Duty check</h2>
            {!mismatches.reliable && (
              <span className="text-xs text-amber-400/80">
                Players cannot be identified exactly — someone listed as not in the city may be playing under another name.
              </span>
            )}
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <MismatchCard
              icon={ShieldAlert}
              title="Clocked on, not in the city"
              empty="Everyone on the duty clock is in the city."
              items={mismatches.clockedNotInCity.map((m) => ({
                key: m.memberId,
                primary: `${m.callSign ? `[${m.callSign}] ` : ""}${m.name}`,
                secondary: `On the clock ${since(m.since)} · ${m.source === "fivem" ? "from the city" : "from the site"}`,
              }))}
            />
            <MismatchCard
              icon={AlertTriangle}
              title="On duty in game, not clocked"
              empty={settings.dutySync ? "Duty sync keeps these in step." : "Everyone on duty in game is on the clock."}
              items={mismatches.dutyNotClocked.map((m) => ({
                key: m.memberId,
                primary: `${m.callSign ? `[${m.callSign}] ` : ""}${m.name}`,
                secondary: settings.dutySync ? "Will be clocked on at the next heartbeat" : "Duty sync is off",
              }))}
            />
            <MismatchCard
              icon={UserX}
              title="EMS job, not on the roster"
              empty="Every player on an EMS job is on the roster."
              items={mismatches.emsNotOnRoster.map((p) => ({
                key: String(p.serverId),
                primary: p.characterName ?? p.name,
                secondary: `ID ${p.serverId} · ${p.name}${p.identifierKinds.length ? ` · has ${p.identifierKinds.join(", ")}` : ""}`,
              }))}
            />
          </div>
        </section>
      )}

      {/* Players */}
      {configured && (
        <section className="mb-6">
          <div className="mb-3 flex flex-wrap items-end gap-3">
            <h2 className="mr-auto font-[family-name:var(--font-oswald)] text-lg font-semibold uppercase text-white">In the city</h2>
            <div className="flex gap-1 rounded-lg border border-[#1e1e28] p-1">
              {(
                [
                  ["ems", "EMS"],
                  ["unmatched", "Not on roster"],
                  ["all", "Everyone"],
                ] as [PlayerFilter, string][]
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(key)}
                  className={`rounded-md px-3 py-1 text-xs font-medium ${
                    filter === key ? "bg-red-600/15 text-red-300" : "text-gray-500 hover:text-gray-300"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-600" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, call sign, server ID..." className="pl-9" />
            </div>
          </div>

          {players.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#1e1e28] p-10 text-center text-sm text-gray-500">
              {!status.online
                ? "The city is offline, or the link cannot reach it."
                : status.players.length === 0
                  ? "Nobody is in the city right now."
                  : "No players match."}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[#1e1e28] bg-card">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="border-b border-[#1e1e28] text-left text-xs uppercase tracking-wider text-gray-500">
                    <th className="px-4 py-3 font-medium">ID</th>
                    <th className="px-4 py-3 font-medium">Player</th>
                    <th className="px-4 py-3 font-medium">Job</th>
                    <th className="px-4 py-3 font-medium">In-game duty</th>
                    <th className="px-4 py-3 font-medium">Roster</th>
                    <th className="px-4 py-3 font-medium">Duty clock</th>
                    <th className="px-4 py-3 text-right font-medium">Ping</th>
                  </tr>
                </thead>
                <tbody>
                  {players.map((p) => (
                    <PlayerRow key={p.serverId} player={p} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        {/* Settings */}
        <section className="min-w-0 rounded-xl border border-[#1e1e28] bg-card p-5">
          <h2 className="mb-1 font-[family-name:var(--font-oswald)] text-lg font-semibold uppercase text-white">Settings</h2>
          <p className="mb-4 text-xs text-gray-500">
            {canManage ? "Changes apply as soon as they are saved." : "You can read these; changing them needs fivem.manage."}
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Server address</Label>
              <Input
                value={form.serverAddress ?? ""}
                onChange={(e) => edit({ serverAddress: e.target.value })}
                placeholder="203.0.113.10:30120"
                disabled={!canManage}
                className="mt-1 font-[family-name:var(--font-mono)]"
              />
              <p className="mt-1 text-[11px] text-gray-600">The IP and port players connect to. Port 30120 if left out.</p>
            </div>
            <div>
              <Label>Join code</Label>
              <Input
                value={form.joinCode ?? ""}
                onChange={(e) => edit({ joinCode: e.target.value })}
                placeholder="abc123 or cfx.re/join/abc123"
                disabled={!canManage}
                className="mt-1 font-[family-name:var(--font-mono)]"
              />
              <p className="mt-1 text-[11px] text-gray-600">For the Connect button. Read from the cfx.re list when no address is set.</p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {TOGGLES.map((t) => (
              <label key={t.key} className={`flex gap-3 ${canManage ? "cursor-pointer" : "cursor-default"}`}>
                <input
                  type="checkbox"
                  checked={form[t.key]}
                  onChange={(e) => edit({ [t.key]: e.target.checked } as Partial<FiveMSettingsView>)}
                  disabled={!canManage}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-red-600"
                />
                <span>
                  <span className="block text-sm text-gray-200">{t.label}</span>
                  <span className="block text-xs text-gray-500">{t.help}</span>
                </span>
              </label>
            ))}
          </div>

          {canManage && (
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button onClick={save} disabled={saving || !dirty}>
                {saving ? "Saving…" : "Save settings"}
              </Button>
              <Button variant="outline" onClick={test} disabled={testing}>
                <Link2 className="mr-2 h-4 w-4" />
                {testing ? "Testing…" : "Test connection"}
              </Button>
              {settings.updatedBy && (
                <span className="text-xs text-gray-600">
                  Last changed by {settings.updatedBy}
                  {settings.updatedAt ? ` · ${new Date(settings.updatedAt).toLocaleString()}` : ""}
                </span>
              )}
            </div>
          )}

          {probes && (
            <ul className="mt-4 space-y-1.5 rounded-lg border border-[#1e1e28] bg-[#0a0a0f] p-3">
              {probes.map((probe, i) => (
                <li key={i} className="flex gap-2 text-xs">
                  {probe.ok ? (
                    <CheckCircle2 className="mt-px h-4 w-4 shrink-0 text-emerald-400" />
                  ) : (
                    <XCircle className="mt-px h-4 w-4 shrink-0 text-red-400" />
                  )}
                  <span>
                    <span className="font-semibold text-gray-200">{probe.label}</span>
                    <span className="text-gray-500"> — {probe.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Setup */}
        <section className="min-w-0 rounded-xl border border-[#1e1e28] bg-card p-5">
          <h2 className="mb-1 font-[family-name:var(--font-oswald)] text-lg font-semibold uppercase text-white">
            In-game resource
          </h2>
          <p className="mb-4 text-xs text-gray-500">
            nexus-ems-sync reports every player&apos;s identifiers, character, job and duty each minute, and adds
            /emsduty, /unitstatus and /emscall in game. It is in the <code className="rounded bg-white/10 px-1">fivem/</code>{" "}
            folder of the website&apos;s repository.
          </p>
          <ol className="space-y-3 text-sm text-gray-300">
            <SetupStep n={1} done={settings.keyConfigured}>
              Set <code className="rounded bg-white/10 px-1">FIVEM_API_KEY</code> on the website to 32+ random characters
              {settings.keyConfigured ? " — done." : ", then redeploy."}
            </SetupStep>
            <SetupStep n={2}>
              Copy <code className="rounded bg-white/10 px-1">fivem/nexus-ems-sync</code> into the server&apos;s resources folder.
            </SetupStep>
            <SetupStep n={3}>
              Add to <code className="rounded bg-white/10 px-1">server.cfg</code>:
              <pre className="mt-2 overflow-x-auto rounded-md bg-[#0a0a0f] p-3 font-[family-name:var(--font-mono)] text-[11px] leading-relaxed text-gray-400">
{`set nexus_ems_url "${siteOrigin()}"
set nexus_ems_api_key "<the same FIVEM_API_KEY>"
ensure nexus-ems-sync`}
              </pre>
            </SetupStep>
            <SetupStep n={4} done={status.heartbeat.fresh}>
              Restart the server. The resource reports in within a minute
              {status.heartbeat.fresh ? " — it is live." : "."}
            </SetupStep>
          </ol>
          {status.connectUrl && (
            <a href={status.connectUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1 text-xs text-red-400 hover:text-red-300">
              {status.connectUrl}
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </section>
      </div>
    </div>
  );
}

/** This site's address, for the server.cfg snippet. The page only renders it after loading in the browser. */
function siteOrigin(): string {
  return typeof window === "undefined" ? "https://your-site" : window.location.origin;
}

function Metric({ label, value, tone = "text-white" }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-gray-500">{label}</div>
      <div className={`font-[family-name:var(--font-oswald)] text-lg font-semibold ${tone}`}>{value}</div>
    </div>
  );
}

function Notice({ tone, children }: { tone: "red" | "amber"; children: React.ReactNode }) {
  return (
    <div
      className={`flex gap-2 border-t px-5 py-3 text-xs ${
        tone === "red" ? "border-red-500/20 bg-red-500/5 text-red-300" : "border-amber-500/20 bg-amber-500/5 text-amber-200/90"
      }`}
    >
      <AlertTriangle className="mt-px h-4 w-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

function MismatchCard({
  icon: Icon,
  title,
  empty,
  items,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  empty: string;
  items: { key: string; primary: string; secondary: string }[];
}) {
  return (
    <div className={`rounded-xl border bg-card p-4 ${items.length ? "border-amber-500/30" : "border-[#1e1e28]"}`}>
      <div className="mb-2 flex items-center gap-2">
        <Icon className={`h-4 w-4 ${items.length ? "text-amber-400" : "text-gray-600"}`} />
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">{title}</span>
        <span className={`ml-auto font-[family-name:var(--font-oswald)] text-lg font-bold ${items.length ? "text-amber-300" : "text-gray-600"}`}>
          {items.length}
        </span>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-gray-600">{empty}</p>
      ) : (
        <ul className="max-h-48 space-y-1.5 overflow-y-auto">
          {items.map((item) => (
            <li key={item.key} className="text-sm">
              <div className="truncate text-gray-200">{item.primary}</div>
              <div className="truncate text-[11px] text-gray-500">{item.secondary}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PlayerRow({ player: p }: { player: CityPlayer }) {
  return (
    <tr className="border-b border-[#1e1e28]/60 last:border-b-0">
      <td className="px-4 py-3 font-[family-name:var(--font-mono)] text-xs text-gray-500">{p.serverId}</td>
      <td className="px-4 py-3">
        <div className="text-gray-200">{p.characterName ?? p.name}</div>
        {p.characterName && <div className="text-[11px] text-gray-500">{p.name}</div>}
      </td>
      <td className="px-4 py-3 text-xs">
        {p.job ? (
          <span className={p.isEms ? "text-red-300" : "text-gray-400"}>
            {p.job}
            {p.jobGrade && <span className="text-gray-600"> · {p.jobGrade}</span>}
          </span>
        ) : (
          <span className="text-gray-600">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-xs">
        {p.onDuty === null ? (
          <span className="text-gray-600">—</span>
        ) : p.onDuty ? (
          <span className="inline-flex items-center gap-1.5 text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            On duty
          </span>
        ) : (
          <span className="text-gray-500">Off duty</span>
        )}
      </td>
      <td className="px-4 py-3">
        {p.match ? (
          <div>
            <div className="text-gray-200">
              {p.match.callSign && <span className="font-[family-name:var(--font-mono)] font-bold text-white">{p.match.callSign} </span>}
              {p.match.name}
            </div>
            <div className="text-[11px] text-gray-500">
              {p.match.rank} · by {MATCH_METHOD_LABELS[p.match.via]}
            </div>
          </div>
        ) : (
          <span className="text-xs text-gray-600">
            Not matched{p.identifierKinds.length ? ` · has ${p.identifierKinds.join(", ")}` : ""}
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-xs">
        {!p.match ? (
          <span className="text-gray-700">—</span>
        ) : p.match.clockedOn ? (
          <span className="text-emerald-300">Clocked on</span>
        ) : (
          <span className="text-gray-500">Off the clock</span>
        )}
      </td>
      <td className="px-4 py-3 text-right font-[family-name:var(--font-mono)] text-xs text-gray-500">{p.ping ?? "—"}</td>
    </tr>
  );
}

function SetupStep({ n, done, children }: { n: number; done?: boolean; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
          done ? "bg-emerald-500/15 text-emerald-300" : "bg-white/5 text-gray-400"
        }`}
      >
        {done ? <CheckCircle2 className="h-4 w-4" /> : n}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </li>
  );
}
