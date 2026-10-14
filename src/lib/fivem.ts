/**
 * FiveM City Link — the shared vocabulary. Client-safe: nothing here touches
 * the database or the network. The fetching, matching and duty sync live in
 * ./fivem-server.
 *
 * The site learns about the city two ways:
 *
 *  - Pull: it reads the FiveM server's own public HTTP endpoints
 *    (dynamic.json, players.json, info.json), or the cfx.re server list when
 *    only a join code is set. Needs nothing installed on the server, but a
 *    current FXServer hides player identifiers there, so who is who can only
 *    be guessed from names.
 *  - Push: the nexus-ems-sync resource (fivem/ in this repository) posts a
 *    heartbeat every minute with every player's identifiers, character, job
 *    and duty, plus duty changes, unit statuses and calls as they happen. That
 *    is what makes roster matching exact and duty sync possible.
 */

/** FXServer's default port, used when an address is given without one. */
export const DEFAULT_FIVEM_PORT = 30120;

/** The resource is expected every minute; three missed beats and it is treated as gone. */
export const HEARTBEAT_STALE_MS = 3 * 60_000;

/** Most players a heartbeat may list — FXServer's own ceiling is 2048. */
export const MAX_HEARTBEAT_PLAYERS = 2048;

export type MatchMethod = "discord" | "steam" | "name";

export const MATCH_METHOD_LABELS: Record<MatchMethod, string> = {
  discord: "Discord ID",
  steam: "Steam ID",
  name: "Name",
};

/** Where the status came from. */
export type CitySource = "heartbeat" | "direct" | "cfx" | "none";

export const CITY_SOURCE_LABELS: Record<CitySource, string> = {
  heartbeat: "nexus-ems-sync resource",
  direct: "Server address",
  cfx: "cfx.re server list",
  none: "Not connected",
};

/** One player in the city, as the City Link page shows them. */
export interface CityPlayer {
  serverId: number;
  name: string;
  characterName: string | null;
  job: string | null;
  jobGrade: string | null;
  /** Holds one of the EMS jobs the resource is configured with. Null when unknown (pull only). */
  isEms: boolean | null;
  /** On duty in that job. Null when unknown. */
  onDuty: boolean | null;
  ping: number | null;
  /** Which identifier kinds the player had — never the values. */
  identifierKinds: string[];
  match: {
    memberId: string;
    name: string;
    callSign: string | null;
    rank: string;
    via: MatchMethod;
    /** Clocked on the site's duty clock right now. */
    clockedOn: boolean;
  } | null;
}

/** The server card: what anyone may see when the public status is switched on. */
export interface CityStatusPublic {
  /** False when command has hidden the server card from the public site. */
  enabled: boolean;
  /** An address, join code or recent heartbeat exists. */
  configured: boolean;
  online: boolean;
  name: string | null;
  playerCount: number | null;
  maxPlayers: number | null;
  connectUrl: string | null;
  joinCode: string | null;
  updatedAt: string | null;
  ems: {
    inCity: number;
    onDuty: number;
    /** Names, when the viewer is a member or command has made them public. */
    members: { name: string; callSign: string | null; rank: string; onDuty: boolean }[] | null;
  };
}

export interface CityMismatches {
  /** Clocked on the site but nowhere in the city. */
  clockedNotInCity: { memberId: string; name: string; callSign: string | null; since: string; source: string }[];
  /** On EMS duty in game with no open entry on the site's clock. */
  dutyNotClocked: { memberId: string; name: string; callSign: string | null }[];
  /** On an EMS job in game but matching nobody on the roster. */
  emsNotOnRoster: { serverId: number; name: string; characterName: string | null; identifierKinds: string[] }[];
  /**
   * Whether "not in the city" can be trusted. Without the resource and
   * without identifiers in players.json, a member only matches by name — so
   * someone missing from the list may simply be playing under another name.
   */
  reliable: boolean;
}

/** Everything the City Link page reads. */
export interface CityStatusFull {
  online: boolean;
  source: CitySource;
  name: string | null;
  playerCount: number | null;
  maxPlayers: number | null;
  connectUrl: string | null;
  fetchedAt: string;
  heartbeat: {
    at: string | null;
    fresh: boolean;
    resourceVersion: string | null;
    framework: string | null;
  };
  /** Why the pull failed, when it did. */
  pullError: string | null;
  /** players.json listed players but hid their identifiers. */
  identifiersHidden: boolean;
  players: CityPlayer[];
  mismatches: CityMismatches;
}

export interface FiveMSettingsView {
  serverAddress: string | null;
  joinCode: string | null;
  showPublicStatus: boolean;
  showPublicNames: boolean;
  matchByName: boolean;
  dutySync: boolean;
  callSync: boolean;
  statusSync: boolean;
  updatedBy: string | null;
  updatedAt: string | null;
  /** FIVEM_API_KEY is set and long enough — never the key itself. */
  keyConfigured: boolean;
}

/** One check made by "Test connection". */
export interface ProbeResult {
  label: string;
  ok: boolean;
  detail: string;
}

/**
 * The base URL for a server address, or an error saying what is wrong with it.
 * Accepts "203.0.113.10:30120", "play.example.com" (port 30120 assumed) and a
 * full http(s) URL. Only the origin is kept, so a pasted ".../players.json"
 * still works.
 */
export function parseServerAddress(raw: string | null | undefined): { base: string } | { error: string } | null {
  const value = (raw ?? "").trim();
  if (!value) return null;
  if (/^fivem:\/\//i.test(value) || /cfx\.re\/join/i.test(value)) {
    return { error: "That is a join link — put the code after cfx.re/join/ in Join code, and the server's IP:port here." };
  }
  const withScheme = /^https?:\/\//i.test(value) ? value : `http://${value}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return { error: "Not a server address. Use IP:port, e.g. 203.0.113.10:30120." };
  }
  if (!url.hostname) return { error: "Not a server address. Use IP:port, e.g. 203.0.113.10:30120." };
  if (url.username || url.password) return { error: "Leave the login out of the server address." };
  if (!/^https?:\/\//i.test(value) && !url.port) url.port = String(DEFAULT_FIVEM_PORT);
  return { base: url.origin };
}

/** A cfx.re join code from the code itself or any join link that contains it. */
export function parseJoinCode(raw: string | null | undefined): { code: string } | { error: string } | null {
  const value = (raw ?? "").trim();
  if (!value) return null;
  const fromLink = value.match(/cfx\.re\/join\/([a-z0-9]+)/i)?.[1];
  const code = (fromLink ?? value).toLowerCase();
  if (!/^[a-z0-9]{4,12}$/.test(code)) return { error: "A join code is the 4–12 letters and numbers after cfx.re/join/." };
  return { code };
}

export function connectUrlFor(joinCode: string | null | undefined): string | null {
  return joinCode ? `https://cfx.re/join/${joinCode}` : null;
}

/** Strips FiveM's ^1–^9 colour codes and ~r~-style GTA text codes from a server name. */
export function cleanServerName(name: string | null | undefined): string | null {
  if (!name) return null;
  const cleaned = name
    .replace(/\^[0-9]/g, "")
    .replace(/~[a-zA-Z]~/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned ? cleaned.slice(0, 120) : null;
}

/**
 * The hex form FiveM uses for a Steam account ("steam:110000112345678"),
 * from however the roster stored it: that same identifier, the bare hex, or
 * the 17-digit SteamID64 a profile URL shows.
 */
export function steamHex(value: string | null | undefined): string | null {
  const raw = (value ?? "").trim().toLowerCase().replace(/^steam:/, "");
  if (!raw) return null;
  if (/^7656119\d{10}$/.test(raw)) return BigInt(raw).toString(16);
  if (/^1100001[0-9a-f]{8}$/.test(raw)) return raw;
  return null;
}

/** "discord:123" → { discord: "123" }. Unknown kinds are kept by their prefix. */
export function identifierMap(identifiers: readonly string[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const id of identifiers) {
    const at = id.indexOf(":");
    if (at <= 0) continue;
    const kind = id.slice(0, at).toLowerCase();
    if (!map[kind]) map[kind] = id.slice(at + 1).toLowerCase();
  }
  return map;
}

/** Lower-case letters and digits only, for comparing a player's name with a roster name. */
export function nameKey(name: string | null | undefined): string {
  return (name ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}
