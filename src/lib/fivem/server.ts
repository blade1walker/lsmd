import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { prisma } from "../db/prisma";
import type { FiveMSettings, Prisma } from "@/generated/prisma/client";
import {
  HEARTBEAT_STALE_MS,
  MAX_HEARTBEAT_PLAYERS,
  cleanServerName,
  connectUrlFor,
  identifierMap,
  nameKey,
  parseJoinCode,
  parseServerAddress,
  steamHex,
  type CityMismatches,
  type CityPlayer,
  type CitySource,
  type CityStatusFull,
  type CityStatusPublic,
  type FiveMSettingsView,
  type MatchMethod,
  type ProbeResult,
} from "./";
import { fiveMKeyState } from "./auth";

/**
 * Server half of the FiveM City Link: reading the server, matching players to
 * the roster, and applying what the nexus-ems-sync resource reports to the
 * duty clock and city time. See ./fivem for the overview.
 */

// ─── Settings ───────────────────────────────────────────────────────────────

/** The settings row, or null when its table does not exist yet (a failed schema push). */
export async function readFiveMSettings(): Promise<FiveMSettings | null> {
  try {
    return await prisma.fiveMSettings.findUnique({ where: { id: "singleton" } });
  } catch (error) {
    console.error("City Link settings could not be read:", error);
    return null;
  }
}

export async function ensureFiveMSettings(): Promise<FiveMSettings> {
  return prisma.fiveMSettings.upsert({ where: { id: "singleton" }, create: { id: "singleton" }, update: {} });
}

export function toSettingsView(settings: FiveMSettings | null): FiveMSettingsView {
  return {
    serverAddress: settings?.serverAddress ?? null,
    joinCode: settings?.joinCode ?? null,
    showPublicStatus: settings?.showPublicStatus ?? true,
    showPublicNames: settings?.showPublicNames ?? false,
    matchByName: settings?.matchByName ?? false,
    dutySync: settings?.dutySync ?? true,
    callSync: settings?.callSync ?? true,
    statusSync: settings?.statusSync ?? true,
    updatedBy: settings?.updatedBy ?? null,
    updatedAt: settings?.updatedAt?.toISOString() ?? null,
    keyConfigured: fiveMKeyState() === "ok",
  };
}

// ─── Players ────────────────────────────────────────────────────────────────

/** A player as either source reports them, before matching. */
export interface RawPlayer {
  serverId: number;
  name: string;
  identifiers: string[];
  ping: number | null;
  characterName: string | null;
  job: string | null;
  jobGrade: string | null;
  isEms: boolean | null;
  onDuty: boolean | null;
}

/** What the last heartbeat said, as stored on the settings row. */
export interface StoredHeartbeat {
  players: RawPlayer[];
  name: string | null;
  maxPlayers: number | null;
  resourceVersion: string | null;
  framework: string | null;
}

function str(value: unknown, max: number): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const trimmed = String(value).trim().slice(0, max);
  return trimmed === "" ? null : trimmed;
}

function int(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? Math.trunc(n) : null;
}

function bool(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (value === 1 || value === "1" || value === "true") return true;
  if (value === 0 || value === "0" || value === "false") return false;
  return null;
}

function identifierList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === "string" && v.includes(":") && v.length <= 100)
    .slice(0, 16);
}

/**
 * One player from a heartbeat, players.json or the cfx.re list. Tolerates
 * every source's field names (id / serverId, ems / isEms, duty / onDuty), so
 * the same parser serves all three.
 */
function parsePlayer(value: unknown): RawPlayer | null {
  if (!value || typeof value !== "object") return null;
  const p = value as Record<string, unknown>;
  const serverId = int(p.serverId ?? p.id);
  const name = str(p.name, 64);
  if (serverId === null || serverId < 0 || !name) return null;
  return {
    serverId,
    name,
    identifiers: identifierList(p.identifiers),
    ping: int(p.ping),
    characterName: str(p.characterName ?? p.character, 64),
    job: str(p.job, 40),
    jobGrade: str(p.jobGrade ?? p.grade, 40),
    isEms: bool(p.isEms ?? p.ems),
    onDuty: bool(p.onDuty ?? p.duty),
  };
}

export function parsePlayers(value: unknown): RawPlayer[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<number>();
  const players: RawPlayer[] = [];
  for (const entry of value.slice(0, MAX_HEARTBEAT_PLAYERS)) {
    const player = parsePlayer(entry);
    if (!player || seen.has(player.serverId)) continue;
    seen.add(player.serverId);
    players.push(player);
  }
  return players;
}

function readStoredHeartbeat(value: Prisma.JsonValue | null | undefined): StoredHeartbeat | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  return {
    players: parsePlayers(v.players),
    name: str(v.name, 120),
    maxPlayers: int(v.maxPlayers),
    resourceVersion: str(v.resourceVersion, 20),
    framework: str(v.framework, 20),
  };
}

// ─── Matching ───────────────────────────────────────────────────────────────

export interface RosterLite {
  id: string;
  name: string;
  callSign: string | null;
  rank: string;
  discordId: string | null;
  steamId: string | null;
}

export interface PlayerMatch {
  member: RosterLite;
  via: MatchMethod;
}

const ROSTER_LITE = { id: true, name: true, callSign: true, rank: true, discordId: true, steamId: true } as const;

/** "[912] John Doe" and "John Doe | EMS" → "John Doe": the tags people wrap their names in. */
function withoutTags(name: string): string {
  return name
    .replace(/^\s*[[(][^\])]*[\])]\s*/, "")
    .replace(/\s*[|/-]\s*(ems|lsmd|lsems|medic)\b.*$/i, "")
    .trim();
}

export function buildMatcher(members: RosterLite[], matchByName: boolean) {
  const byDiscord = new Map<string, RosterLite>();
  const bySteam = new Map<string, RosterLite>();
  // A name two members share matches neither — a wrong match is worse than none.
  const byName = new Map<string, RosterLite | null>();

  for (const member of members) {
    if (member.discordId && !byDiscord.has(member.discordId)) byDiscord.set(member.discordId, member);
    const steam = steamHex(member.steamId);
    if (steam && !bySteam.has(steam)) bySteam.set(steam, member);
    const key = nameKey(member.name);
    if (key.length >= 4) byName.set(key, byName.has(key) ? null : member);
  }

  return (player: Pick<RawPlayer, "identifiers" | "name" | "characterName">): PlayerMatch | null => {
    const ids = identifierMap(player.identifiers);
    const discord = ids.discord ? byDiscord.get(ids.discord) : undefined;
    if (discord) return { member: discord, via: "discord" };
    const steam = ids.steam ? bySteam.get(ids.steam) : undefined;
    if (steam) return { member: steam, via: "steam" };

    if (matchByName) {
      for (const candidate of [player.characterName, player.name]) {
        if (!candidate) continue;
        for (const key of new Set([nameKey(candidate), nameKey(withoutTags(candidate))])) {
          const member = key ? byName.get(key) : undefined;
          if (member) return { member, via: "name" };
        }
      }
    }
    return null;
  };
}

export async function loadMatcher(matchByName: boolean) {
  const members = await prisma.member.findMany({ select: ROSTER_LITE });
  return buildMatcher(members, matchByName);
}

/** The roster member a single player is, for the resource's per-player requests. */
export async function matchOnePlayer(
  player: Pick<RawPlayer, "identifiers" | "name" | "characterName">,
  matchByName: boolean
): Promise<PlayerMatch | null> {
  return (await loadMatcher(matchByName))(player);
}

// ─── Pull: reading the server ───────────────────────────────────────────────

interface PullResult {
  ok: boolean;
  source: "direct" | "cfx";
  name: string | null;
  playerCount: number | null;
  maxPlayers: number | null;
  players: RawPlayer[];
  identifiersHidden: boolean;
  error: string | null;
  probes: ProbeResult[];
}

const PULL_TIMEOUT_MS = 3500;
const PULL_MAX_BYTES = 3_000_000;
const PULL_TTL_MS = 20_000;

/** Addresses no server-side fetch should reach: link-local (cloud metadata) and "this host". */
function isForbiddenAddress(address: string): boolean {
  const v4 = address.match(/^(\d+)\.(\d+)\.\d+\.\d+$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    return a === 0 || (a === 169 && b === 254) || address === "100.100.100.200";
  }
  const v6 = address.toLowerCase();
  return v6 === "::" || /^fe[89ab]/.test(v6) || v6.startsWith("fd00:ec2:") || /^::ffff:(0|169\.254)\./.test(v6);
}

/**
 * Refuses an address that resolves to cloud metadata or link-local space. The
 * address is set by an admin, but the request is made by the site's own
 * server, so it must not become a way to read the host's metadata service.
 */
async function hostProblem(base: string): Promise<string | null> {
  const host = new URL(base).hostname.replace(/^\[|\]$/g, "");
  if (/^metadata(\.google)?\.internal$/i.test(host)) return "That address is not allowed.";
  let addresses: string[];
  if (isIP(host)) {
    addresses = [host];
  } else {
    try {
      addresses = (await lookup(host, { all: true })).map((a) => a.address);
    } catch {
      return `${host} does not resolve to an address. Check the spelling, or use the server's IP.`;
    }
  }
  return addresses.some(isForbiddenAddress) ? "That address is not allowed." : null;
}

type FetchOutcome = { ok: true; data: unknown } | { ok: false; error: string };

async function getJson(url: string, headers: Record<string, string> = {}): Promise<FetchOutcome> {
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Accept: "application/json", ...headers },
      signal: AbortSignal.timeout(PULL_TIMEOUT_MS),
      cache: "no-store",
      // A redirect would take the request somewhere the address check never saw.
      redirect: "manual",
    });
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    const cause = err instanceof Error && err.cause && typeof err.cause === "object" ? (err.cause as { code?: string }).code : undefined;
    if (name === "TimeoutError" || name === "AbortError") return { ok: false, error: `did not answer within ${PULL_TIMEOUT_MS / 1000}s` };
    if (cause === "ECONNREFUSED") return { ok: false, error: "refused the connection — the server is down or the port is wrong" };
    if (cause === "ENOTFOUND") return { ok: false, error: "the address does not resolve" };
    if (cause === "EHOSTUNREACH" || cause === "ENETUNREACH") return { ok: false, error: "the address cannot be reached" };
    return { ok: false, error: "could not be reached" };
  }
  if (res.status >= 300 && res.status < 400) return { ok: false, error: `redirected (HTTP ${res.status}) — use the address it redirects to` };
  if (!res.ok) return { ok: false, error: `answered HTTP ${res.status}` };
  const length = Number(res.headers.get("content-length") ?? 0);
  if (length > PULL_MAX_BYTES) return { ok: false, error: "answered with far more data than a FiveM server sends" };
  const text = await res.text();
  if (text.length > PULL_MAX_BYTES) return { ok: false, error: "answered with far more data than a FiveM server sends" };
  try {
    return { ok: true, data: JSON.parse(text) };
  } catch {
    return { ok: false, error: "did not answer with JSON — is this the FiveM server's port?" };
  }
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

async function pullDirect(base: string): Promise<PullResult> {
  const fail = (error: string, probes: ProbeResult[] = []): PullResult => ({
    ok: false,
    source: "direct",
    name: null,
    playerCount: null,
    maxPlayers: null,
    players: [],
    identifiersHidden: false,
    error,
    probes,
  });

  const problem = await hostProblem(base);
  if (problem) return fail(problem, [{ label: "Address", ok: false, detail: problem }]);

  const [dynamic, players, info] = await Promise.all([
    getJson(`${base}/dynamic.json`),
    getJson(`${base}/players.json`),
    getJson(`${base}/info.json`),
  ]);

  const probes: ProbeResult[] = [
    { label: "dynamic.json", ok: dynamic.ok, detail: dynamic.ok ? "Server name and player count read" : `The server ${dynamic.error}` },
    { label: "info.json", ok: info.ok, detail: info.ok ? "Server details read" : `The server ${info.error}` },
  ];

  if (!dynamic.ok && !players.ok && !info.ok) {
    probes.push({ label: "players.json", ok: false, detail: `The server ${players.error}` });
    return fail(`${base} ${dynamic.error}.`, probes);
  }

  const dyn = dynamic.ok ? record(dynamic.data) : {};
  const vars = info.ok ? record(record(info.data).vars) : {};
  const list = players.ok ? parsePlayers(players.data) : [];
  const identifiersHidden = list.length > 0 && list.every((p) => p.identifiers.length === 0);

  probes.push({
    label: "players.json",
    ok: players.ok,
    detail: !players.ok
      ? `The server ${players.error}`
      : identifiersHidden
        ? `${list.length} players listed, but without identifiers — roster matching needs the nexus-ems-sync resource, or sv_exposePlayerIdentifiersInHttpEndpoint true in server.cfg`
        : `${list.length} players listed with identifiers`,
  });

  return {
    ok: true,
    source: "direct",
    name: cleanServerName(str(vars.sv_projectName, 200)) ?? cleanServerName(str(dyn.hostname, 200)),
    playerCount: players.ok ? list.length : int(dyn.clients),
    maxPlayers: int(dyn.sv_maxclients) ?? int(vars.sv_maxClients),
    players: list,
    identifiersHidden,
    error: null,
    probes,
  };
}

async function pullCfx(code: string): Promise<PullResult> {
  const result = await getJson(`https://servers-frontend.fivem.net/api/servers/single/${code}`, {
    "User-Agent": "NexusEMS-CityLink/1.0",
  });
  if (!result.ok) {
    const detail = /HTTP 404/.test(result.error)
      ? `cfx.re lists no server with join code ${code} — it is offline, or the code is wrong`
      : `cfx.re ${result.error}`;
    return {
      ok: false,
      source: "cfx",
      name: null,
      playerCount: null,
      maxPlayers: null,
      players: [],
      identifiersHidden: false,
      error: detail,
      probes: [{ label: "cfx.re server list", ok: false, detail }],
    };
  }
  const data = record(record(result.data).Data);
  const vars = record(data.vars);
  const list = parsePlayers(data.players);
  const identifiersHidden = list.length > 0 && list.every((p) => p.identifiers.length === 0);
  return {
    ok: true,
    source: "cfx",
    name: cleanServerName(str(vars.sv_projectName, 200)) ?? cleanServerName(str(data.hostname, 200)),
    playerCount: int(data.clients) ?? list.length,
    maxPlayers: int(data.sv_maxclients) ?? int(data.svMaxclients) ?? int(vars.sv_maxClients),
    players: list,
    identifiersHidden,
    error: null,
    probes: [
      {
        label: "cfx.re server list",
        ok: true,
        detail: `Listed with ${int(data.clients) ?? list.length} players${identifiersHidden || list.length === 0 ? " (no identifiers — roster matching needs the nexus-ems-sync resource)" : ""}`,
      },
    ],
  };
}

const pullCache = new Map<string, { at: number; result: Promise<PullResult> }>();

/** Reads the server, at most once per 20 seconds per address on this instance. */
async function pullServer(settings: Pick<FiveMSettings, "serverAddress" | "joinCode">, fresh = false): Promise<PullResult | null> {
  const address = parseServerAddress(settings.serverAddress);
  const code = parseJoinCode(settings.joinCode);
  const key = address && "base" in address ? `direct:${address.base}` : code && "code" in code ? `cfx:${code.code}` : null;
  if (!key) return null;

  const hit = pullCache.get(key);
  if (!fresh && hit && Date.now() - hit.at < PULL_TTL_MS) return hit.result;

  const result =
    address && "base" in address ? pullDirect(address.base) : pullCfx((code as { code: string }).code);
  if (pullCache.size > 20) pullCache.clear();
  pullCache.set(key, { at: Date.now(), result });
  return result;
}

/** "Test connection": every check, against values that may not be saved yet. */
export async function probeServer(serverAddress: string | null, joinCode: string | null): Promise<ProbeResult[]> {
  const probes: ProbeResult[] = [];
  const address = parseServerAddress(serverAddress);
  const code = parseJoinCode(joinCode);

  if (address && "error" in address) probes.push({ label: "Server address", ok: false, detail: address.error });
  if (code && "error" in code) probes.push({ label: "Join code", ok: false, detail: code.error });

  if (address && "base" in address) probes.push(...(await pullDirect(address.base)).probes);
  if (code && "code" in code) probes.push(...(await pullCfx(code.code)).probes);

  if (!address && !code) probes.push({ label: "Server", ok: false, detail: "Enter a server address or a join code to test." });

  const settings = await readFiveMSettings();
  const beatAge = settings?.lastHeartbeatAt ? Date.now() - settings.lastHeartbeatAt.getTime() : null;
  const keyState = fiveMKeyState();
  probes.push(
    keyState === "ok"
      ? { label: "FIVEM_API_KEY", ok: true, detail: "Set on the website — the resource can report duty, statuses and calls" }
      : {
          label: "FIVEM_API_KEY",
          ok: false,
          detail:
            keyState === "short"
              ? "Set, but shorter than 32 characters, so it is ignored"
              : "Not set on the website — the resource cannot connect until it is",
        },
    beatAge !== null && beatAge < HEARTBEAT_STALE_MS
      ? { label: "Resource heartbeat", ok: true, detail: `Last heartbeat ${Math.round(beatAge / 1000)}s ago` }
      : {
          label: "Resource heartbeat",
          ok: false,
          detail:
            beatAge === null
              ? "The nexus-ems-sync resource has never reported in"
              : `Last heartbeat ${Math.round(beatAge / 60_000)} minutes ago — the resource is stopped or cannot reach the website`,
        }
  );
  return probes;
}

// ─── The snapshot every view is built from ──────────────────────────────────

export interface CitySnapshot {
  settings: FiveMSettings | null;
  configured: boolean;
  online: boolean;
  source: CitySource;
  name: string | null;
  playerCount: number | null;
  maxPlayers: number | null;
  joinCode: string | null;
  connectUrl: string | null;
  heartbeatAt: Date | null;
  heartbeatFresh: boolean;
  resourceVersion: string | null;
  framework: string | null;
  pullError: string | null;
  identifiersHidden: boolean;
  /** Whether a member missing from `players` can be taken as not in the city. */
  reliable: boolean;
  players: (RawPlayer & { match: PlayerMatch | null })[];
  fetchedAt: Date;
}

/**
 * The city right now. A fresh heartbeat is preferred — it is the only source
 * with identifiers, characters, jobs and duty — and the server is only read
 * directly when the resource has gone quiet or was never installed.
 */
export async function getCitySnapshot(options: { fresh?: boolean } = {}): Promise<CitySnapshot> {
  const settings = await readFiveMSettings();
  const code = parseJoinCode(settings?.joinCode);
  const joinCode = code && "code" in code ? code.code : null;

  const heartbeatAt = settings?.lastHeartbeatAt ?? null;
  const heartbeatFresh = !!heartbeatAt && Date.now() - heartbeatAt.getTime() < HEARTBEAT_STALE_MS;
  const beat = heartbeatFresh ? readStoredHeartbeat(settings?.lastHeartbeat) : null;

  const pull = beat || !settings ? null : await pullServer(settings, options.fresh).catch(() => null);
  const configured = !!(settings?.serverAddress || joinCode || heartbeatAt);

  const raw = beat?.players ?? (pull?.ok ? pull.players : []);
  const matcher = raw.length ? await loadMatcher(settings?.matchByName ?? false) : null;
  const players = raw.map((p) => ({ ...p, match: matcher ? matcher(p) : null }));

  const source: CitySource = beat ? "heartbeat" : pull?.ok ? pull.source : "none";

  return {
    settings,
    configured,
    online: !!beat || !!pull?.ok,
    source,
    name: beat?.name ?? pull?.name ?? null,
    playerCount: beat ? beat.players.length : (pull?.playerCount ?? null),
    maxPlayers: beat?.maxPlayers ?? pull?.maxPlayers ?? null,
    joinCode,
    connectUrl: connectUrlFor(joinCode),
    heartbeatAt,
    heartbeatFresh,
    resourceVersion: beat?.resourceVersion ?? null,
    framework: beat?.framework ?? null,
    pullError: pull && !pull.ok ? pull.error : null,
    identifiersHidden: !beat && !!pull?.identifiersHidden,
    reliable: !!beat || (!!pull?.ok && !pull.identifiersHidden),
    players,
    fetchedAt: new Date(),
  };
}

/** Members present in the snapshot, by id. */
export function presentMemberIds(snapshot: CitySnapshot): Set<string> {
  return new Set(snapshot.players.flatMap((p) => (p.match ? [p.match.member.id] : [])));
}

async function openClockMap(): Promise<Map<string, { clockInAt: Date; source: string }>> {
  const open = await prisma.clockEntry.findMany({
    where: { clockOutAt: null },
    orderBy: { clockInAt: "asc" },
    select: { memberId: true, clockInAt: true, source: true },
  });
  const map = new Map<string, { clockInAt: Date; source: string }>();
  for (const entry of open) if (!map.has(entry.memberId)) map.set(entry.memberId, entry);
  return map;
}

export async function toPublicStatus(snapshot: CitySnapshot, includeNames: boolean): Promise<CityStatusPublic> {
  const enabled = snapshot.settings?.showPublicStatus ?? true;
  const clocked = snapshot.players.some((p) => p.match) ? await openClockMap() : new Map();

  const seen = new Set<string>();
  const ems: { name: string; callSign: string | null; rank: string; onDuty: boolean }[] = [];
  for (const player of snapshot.players) {
    if (!player.match || seen.has(player.match.member.id)) continue;
    seen.add(player.match.member.id);
    const { member } = player.match;
    ems.push({ name: member.name, callSign: member.callSign, rank: member.rank, onDuty: clocked.has(member.id) });
  }
  ems.sort((a, b) => Number(b.onDuty) - Number(a.onDuty) || a.name.localeCompare(b.name));

  return {
    enabled,
    configured: snapshot.configured,
    online: snapshot.online,
    name: snapshot.name,
    playerCount: snapshot.playerCount,
    maxPlayers: snapshot.maxPlayers,
    connectUrl: snapshot.connectUrl,
    joinCode: snapshot.joinCode,
    updatedAt: snapshot.fetchedAt.toISOString(),
    ems: {
      inCity: ems.length,
      onDuty: ems.filter((m) => m.onDuty).length,
      members: includeNames ? ems : null,
    },
  };
}

export async function toFullStatus(snapshot: CitySnapshot): Promise<CityStatusFull> {
  const clocked = await openClockMap();
  const present = presentMemberIds(snapshot);

  const players: CityPlayer[] = snapshot.players
    .map((p) => ({
      serverId: p.serverId,
      name: p.name,
      characterName: p.characterName,
      job: p.job,
      jobGrade: p.jobGrade,
      isEms: p.isEms,
      onDuty: p.onDuty,
      ping: p.ping,
      identifierKinds: [...new Set(p.identifiers.map((id) => id.split(":")[0].toLowerCase()))].sort(),
      match: p.match
        ? {
            memberId: p.match.member.id,
            name: p.match.member.name,
            callSign: p.match.member.callSign,
            rank: p.match.member.rank,
            via: p.match.via,
            clockedOn: clocked.has(p.match.member.id),
          }
        : null,
    }))
    .sort((a, b) => Number(!!b.match) - Number(!!a.match) || Number(!!b.isEms) - Number(!!a.isEms) || a.serverId - b.serverId);

  let mismatches: CityMismatches = { clockedNotInCity: [], dutyNotClocked: [], emsNotOnRoster: [], reliable: snapshot.reliable };

  if (snapshot.configured) {
    const clockedIds = [...clocked.keys()].filter((id) => !present.has(id));
    const names = clockedIds.length
      ? await prisma.member.findMany({ where: { id: { in: clockedIds } }, select: { id: true, name: true, callSign: true } })
      : [];
    const byId = new Map(names.map((m) => [m.id, m]));

    const dutyNotClocked = new Map<string, CityMismatches["dutyNotClocked"][number]>();
    for (const p of snapshot.players) {
      if (p.match && p.isEms && p.onDuty && !clocked.has(p.match.member.id)) {
        dutyNotClocked.set(p.match.member.id, { memberId: p.match.member.id, name: p.match.member.name, callSign: p.match.member.callSign });
      }
    }

    mismatches = {
      clockedNotInCity: clockedIds.flatMap((id) => {
        const member = byId.get(id);
        const entry = clocked.get(id)!;
        return member
          ? [{ memberId: id, name: member.name, callSign: member.callSign, since: entry.clockInAt.toISOString(), source: entry.source }]
          : [];
      }),
      dutyNotClocked: [...dutyNotClocked.values()],
      emsNotOnRoster: snapshot.players
        .filter((p) => p.isEms && !p.match)
        .map((p) => ({
          serverId: p.serverId,
          name: p.name,
          characterName: p.characterName,
          identifierKinds: [...new Set(p.identifiers.map((id) => id.split(":")[0].toLowerCase()))].sort(),
        })),
      reliable: snapshot.reliable,
    };
  }

  return {
    online: snapshot.online,
    source: snapshot.source,
    name: snapshot.name,
    playerCount: snapshot.playerCount,
    maxPlayers: snapshot.maxPlayers,
    connectUrl: snapshot.connectUrl,
    fetchedAt: snapshot.fetchedAt.toISOString(),
    heartbeat: {
      at: snapshot.heartbeatAt?.toISOString() ?? null,
      fresh: snapshot.heartbeatFresh,
      resourceVersion: snapshot.resourceVersion,
      framework: snapshot.framework,
    },
    pullError: snapshot.pullError,
    identifiersHidden: snapshot.identifiersHidden,
    players,
    mismatches,
  };
}

// ─── Push: applying what the resource reports ───────────────────────────────

/** Opens a duty clock entry unless one is already open. Returns whether it opened one. */
export async function clockOn(memberId: string, source: "site" | "fivem", at = new Date()): Promise<boolean> {
  const open = await prisma.clockEntry.findFirst({ where: { memberId, clockOutAt: null }, select: { id: true } });
  if (open) return false;
  await prisma.clockEntry.create({ data: { memberId, clockInAt: at, source } });
  return true;
}

/**
 * Closes a member's open entries at `at` (never before each entry began).
 * `onlySource` limits it to entries the City Link opened. Returns the seconds closed.
 */
export async function clockOff(memberId: string, at = new Date(), onlySource?: string): Promise<number> {
  const open = await prisma.clockEntry.findMany({
    where: { memberId, clockOutAt: null, ...(onlySource ? { source: onlySource } : {}) },
    select: { id: true, clockInAt: true },
  });
  let total = 0;
  for (const entry of open) {
    const end = at < entry.clockInAt ? entry.clockInAt : at;
    const durationSec = Math.floor((end.getTime() - entry.clockInAt.getTime()) / 1000);
    total += durationSec;
    await prisma.clockEntry.update({ where: { id: entry.id }, data: { clockOutAt: end, durationSec } });
  }
  return total;
}

export interface HeartbeatInput {
  players: RawPlayer[];
  name: string | null;
  maxPlayers: number | null;
  resourceVersion: string | null;
  framework: string | null;
}

export function parseHeartbeat(body: unknown): HeartbeatInput | { error: string } {
  if (!body || typeof body !== "object") return { error: "Nothing was sent" };
  const b = body as Record<string, unknown>;
  // Lua has one table type, and FiveM's json.encode writes an empty one as
  // {} — which is how an empty city arrives.
  const emptyTable = !!b.players && typeof b.players === "object" && Object.keys(b.players).length === 0;
  if (!Array.isArray(b.players) && !emptyTable) return { error: "players must be a list" };
  return {
    players: parsePlayers(emptyTable ? [] : b.players),
    name: cleanServerName(str(b.name ?? b.hostname, 200)),
    maxPlayers: int(b.maxPlayers),
    resourceVersion: str(b.resourceVersion, 20),
    framework: str(b.framework, 20),
  };
}

export interface HeartbeatSummary {
  players: number;
  matched: number;
  cityJoined: number;
  cityLeft: number;
  clockedOn: string[];
  clockedOff: string[];
  /** The gap since the previous beat was long enough to treat as a restart. */
  resumedAfterGap: boolean;
}

/**
 * Applies a heartbeat. Whoever has gone since the previous one is taken to
 * have left when that beat was sent — the last moment the city vouched for
 * them — so a crashed server or a missed playerDropped never credits time
 * nobody spent. After a gap long enough to be a restart, every open session
 * and every duty entry the link opened is closed at the last beat, and the
 * ones still true are reopened from now.
 */
export async function applyHeartbeat(input: HeartbeatInput): Promise<HeartbeatSummary> {
  const settings = await ensureFiveMSettings();
  const now = new Date();
  const previous = settings.lastHeartbeatAt;
  const resumedAfterGap = !previous || now.getTime() - previous.getTime() > HEARTBEAT_STALE_MS;
  const lastSeen = previous ?? now;

  const matcher = await loadMatcher(settings.matchByName);
  const matched = new Map<string, { player: RawPlayer; member: RosterLite }>();
  for (const player of input.players) {
    const match = matcher(player);
    if (match && !matched.has(match.member.id)) matched.set(match.member.id, { player, member: match.member });
  }

  // City time.
  const openSessions = await prisma.citySession.findMany({ where: { leftAt: null }, select: { id: true, memberId: true, joinedAt: true } });
  let cityLeft = 0;
  const stillOpen = new Set<string>();
  for (const session of openSessions) {
    if (!resumedAfterGap && matched.has(session.memberId) && !stillOpen.has(session.memberId)) {
      stillOpen.add(session.memberId);
      continue;
    }
    const leftAt = lastSeen < session.joinedAt ? session.joinedAt : lastSeen;
    await prisma.citySession.update({
      where: { id: session.id },
      data: { leftAt, durationSec: Math.floor((leftAt.getTime() - session.joinedAt.getTime()) / 1000) },
    });
    cityLeft++;
  }
  const joining = [...matched.entries()].filter(([memberId]) => !stillOpen.has(memberId));
  if (joining.length) {
    await prisma.citySession.createMany({
      data: joining.map(([memberId, { player }]) => ({ memberId, joinedAt: now, characterName: player.characterName })),
    });
  }

  // Duty.
  const clockedOn: string[] = [];
  const clockedOffIds: string[] = [];
  if (settings.dutySync) {
    const linkEntries = await prisma.clockEntry.findMany({
      where: { clockOutAt: null, source: "fivem" },
      select: { memberId: true },
    });
    for (const memberId of new Set(linkEntries.map((e) => e.memberId))) {
      const here = matched.get(memberId);
      const stillOnDuty = !resumedAfterGap && here && here.player.onDuty !== false && here.player.isEms !== false;
      if (stillOnDuty) continue;
      // Gone, or the city says they are off duty: gone counts from the last
      // beat that saw them, off duty from now.
      await clockOff(memberId, here && !resumedAfterGap ? now : lastSeen, "fivem");
      clockedOffIds.push(memberId);
    }
    for (const { player, member } of matched.values()) {
      if (player.isEms && player.onDuty && (await clockOn(member.id, "fivem", now))) clockedOn.push(member.name);
    }
  }
  const clockedOff = clockedOffIds.length
    ? (await prisma.member.findMany({ where: { id: { in: clockedOffIds } }, select: { name: true } })).map((m) => m.name)
    : [];

  const stored: StoredHeartbeat = {
    players: input.players,
    name: input.name,
    maxPlayers: input.maxPlayers,
    resourceVersion: input.resourceVersion,
    framework: input.framework,
  };
  await prisma.fiveMSettings.update({
    where: { id: "singleton" },
    data: { lastHeartbeatAt: now, lastHeartbeat: stored as unknown as Prisma.InputJsonValue },
  });

  return {
    players: input.players.length,
    matched: matched.size,
    cityJoined: joining.length,
    cityLeft,
    clockedOn,
    clockedOff,
    resumedAfterGap,
  };
}

/**
 * Who a per-player request from the resource is about. The resource sends the
 * player's identifiers with every request, read server-side from FXServer, so
 * a player cannot claim to be someone else.
 */
export function parseActor(body: unknown): Pick<RawPlayer, "identifiers" | "name" | "characterName"> | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const identifiers = identifierList(b.identifiers);
  const name = str(b.name, 64) ?? "";
  if (identifiers.length === 0 && !name) return null;
  return { identifiers, name, characterName: str(b.characterName ?? b.character, 64) };
}

/** The 404 body when a player matches nobody on the roster — worded for the player who sees it in game. */
export function notOnRosterBody(matchByName: boolean) {
  return {
    error: "Not on the EMS roster",
    detail: matchByName
      ? "No roster member has your Discord ID, Steam ID or name. Ask HR to check your roster entry."
      : "No roster member has your Discord ID or Steam ID. Make sure Discord is open before joining the city, and ask HR to check your roster entry.",
  };
}
