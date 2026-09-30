"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { Trash2, ShieldCheck, Users, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { fetchJson, errorMessage } from "@/lib/fetch-json";
import { ALL_COMMANDS, BOT_COMMANDS, PUBLIC_BOT_COMMANDS, commandLabel } from "@/lib/bot-commands";
import { toast } from "sonner";

interface Grant {
  id: string;
  guildId: string;
  targetType: "role" | "user";
  targetId: string;
  targetName: string;
  command: string;
  grantedByName: string;
  createdAt: string;
}

const SNOWFLAKE = /^\d{15,22}$/;

export default function BotPermissionsPage() {
  const { data: session } = useSession();
  const canManage =
    !!session?.user &&
    (session.user.isSuperAdmin || (session.user.permissions ?? []).includes("bot.permissions.manage"));

  const [grants, setGrants] = useState<Grant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [guildId, setGuildId] = useState("");
  const [targetType, setTargetType] = useState<"role" | "user">("role");
  const [targetId, setTargetId] = useState("");
  const [targetName, setTargetName] = useState("");
  const [command, setCommand] = useState<string>(ALL_COMMANDS);

  // State is only set once the request settles, never synchronously in the effect.
  const load = useCallback(
    () =>
      fetchJson<Grant[]>("/api/bot/permissions")
        .then((rows) => {
          setError(null);
          setGrants(rows);
          // Most servers only ever have one; pre-fill it.
          if (rows[0]) setGuildId((g) => g || rows[0].guildId);
        })
        .catch((err) => setError(errorMessage(err)))
        .finally(() => setLoading(false)),
    []
  );

  useEffect(() => {
    void load();
  }, [load]);

  /** Grouped by who holds them, so "what can this role do" reads in one line. */
  const byTarget = useMemo(() => {
    const groups = new Map<string, { type: Grant["targetType"]; id: string; name: string; guildId: string; grants: Grant[] }>();
    for (const g of grants) {
      const key = `${g.guildId}:${g.targetType}:${g.targetId}`;
      const group = groups.get(key) ?? { type: g.targetType, id: g.targetId, name: g.targetName, guildId: g.guildId, grants: [] };
      group.grants.push(g);
      groups.set(key, group);
    }
    return [...groups.values()].sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === "role" ? -1 : 1));
  }, [grants]);

  const grant = async () => {
    if (!SNOWFLAKE.test(guildId)) return toast.error("Enter your Discord server ID.");
    if (!SNOWFLAKE.test(targetId)) return toast.error(`Enter the ${targetType === "role" ? "role" : "user"}'s Discord ID.`);
    setBusy(true);
    try {
      await fetchJson("/api/bot/permissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guildId, targetType, targetId, targetName, command }),
      });
      toast.success(`${commandLabel(command)} granted — the bot picks it up within a minute`);
      setTargetId("");
      setTargetName("");
      await load();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (g: Grant) => {
    if (!confirm(`Remove ${commandLabel(g.command)} from ${g.targetName}?`)) return;
    try {
      await fetchJson(`/api/bot/permissions/${g.id}`, { method: "DELETE" });
      toast.success("Access removed");
      setGrants((all) => all.filter((x) => x.id !== g.id));
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-64 w-full max-w-3xl" />
      </div>
    );
  }
  if (error) return <ErrorState title="Failed to load bot permissions" message={error} onRetry={load} />;

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-oswald)] text-2xl font-bold uppercase text-white">Bot Permissions</h1>
        <p className="mt-1 text-sm text-gray-500">
          Which Discord roles and people may use the Nexus EMS Bot&apos;s commands. The same list is managed in Discord
          with <code className="rounded bg-white/5 px-1">/permissions</code>.
        </p>
      </div>

      <div className="grid gap-3 rounded-xl border border-[#1e1e28] bg-card p-5 text-sm text-gray-400 sm:grid-cols-3">
        <div>
          <p className="font-semibold text-white">Always allowed</p>
          <p className="mt-1">Server administrators and the owner can use every command, with no grant needed.</p>
        </div>
        <div>
          <p className="font-semibold text-white">Open to everyone</p>
          <p className="mt-1">{PUBLIC_BOT_COMMANDS.map((c) => `/${c}`).join(" and ")} work for every member.</p>
        </div>
        <div>
          <p className="font-semibold text-white">Everything else</p>
          <p className="mt-1">
            Needs a grant below. <span className="text-gray-300">All commands</span> covers every command except{" "}
            <code className="rounded bg-white/5 px-1">/permissions</code>, which is granted on its own.
          </p>
        </div>
      </div>

      {canManage && (
        <div className="space-y-4 rounded-xl border border-[#1e1e28] bg-card p-5">
          <h2 className="font-[family-name:var(--font-oswald)] text-sm font-semibold uppercase text-white">Give access</h2>
          <p className="text-xs text-gray-500">
            The quickest way is <code className="rounded bg-white/5 px-1">/permissions grant</code> in Discord, where you
            pick the role from a list. Here you need Discord IDs: turn on User Settings → Advanced → Developer Mode, then
            right-click the server, role or person → Copy ID.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Discord server ID</Label>
              <Input value={guildId} onChange={(e) => setGuildId(e.target.value.trim())} placeholder="e.g. 1139376084014612510" className="mt-1" />
            </div>
            <div>
              <Label>Command</Label>
              <select
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                className="mt-1 h-9 w-full rounded-md border border-[#1e1e28] bg-[#0a0a0f] px-3 text-sm text-white"
              >
                <option value={ALL_COMMANDS}>All commands (except /permissions)</option>
                {BOT_COMMANDS.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.label} — {c.description}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Give it to</Label>
              <div className="mt-1 flex gap-2">
                {(["role", "user"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTargetType(t)}
                    className={`flex-1 rounded-md border px-3 py-2 text-sm ${
                      targetType === t ? "border-red-600/60 bg-red-600/10 text-white" : "border-[#1e1e28] text-gray-400 hover:text-white"
                    }`}
                  >
                    {t === "role" ? "A role" : "One person"}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>{targetType === "role" ? "Role ID" : "User ID"}</Label>
              <Input value={targetId} onChange={(e) => setTargetId(e.target.value.trim())} placeholder="e.g. 1234567890123456789" className="mt-1" />
            </div>
            <div className="sm:col-span-2">
              <Label>Name (for this list)</Label>
              <Input
                value={targetName}
                maxLength={100}
                onChange={(e) => setTargetName(e.target.value)}
                placeholder={targetType === "role" ? "e.g. EMS High Command" : "e.g. John Doe"}
                className="mt-1"
              />
            </div>
          </div>
          <Button onClick={grant} disabled={busy}>
            {busy ? "Saving…" : "Give access"}
          </Button>
        </div>
      )}

      <div className="rounded-xl border border-[#1e1e28] bg-card">
        <div className="border-b border-[#1e1e28] px-5 py-3">
          <h2 className="font-[family-name:var(--font-oswald)] text-sm font-semibold uppercase text-white">
            Who has access · {byTarget.length}
          </h2>
        </div>
        {byTarget.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-gray-500">
            <ShieldCheck className="mx-auto mb-2 h-6 w-6 text-gray-600" />
            No one has been given access yet — only server administrators can use the staff commands.
          </div>
        ) : (
          <ul className="divide-y divide-[#1e1e28]">
            {byTarget.map((group) => (
              <li key={`${group.guildId}:${group.type}:${group.id}`} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start">
                <div className="flex min-w-[220px] items-center gap-2">
                  {group.type === "role" ? <Users className="h-4 w-4 text-red-400" /> : <User className="h-4 w-4 text-blue-400" />}
                  <div>
                    <div className="text-sm font-medium text-white">{group.type === "role" ? `@${group.name}` : group.name}</div>
                    <div className="font-mono text-[11px] text-gray-600">
                      {group.type} · {group.id}
                    </div>
                  </div>
                </div>
                <div className="flex flex-1 flex-wrap gap-2">
                  {group.grants.map((g) => (
                    <span
                      key={g.id}
                      title={`Granted by ${g.grantedByName} · ${new Date(g.createdAt).toLocaleString()}`}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${
                        g.command === ALL_COMMANDS ? "border-red-600/40 bg-red-600/10 text-red-300" : "border-[#26262f] text-gray-300"
                      }`}
                    >
                      {commandLabel(g.command)}
                      {canManage && (
                        <button type="button" onClick={() => revoke(g)} aria-label={`Remove ${commandLabel(g.command)}`} className="text-gray-500 hover:text-red-400">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
