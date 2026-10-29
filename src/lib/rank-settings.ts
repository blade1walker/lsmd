import { prisma } from "./db/prisma";
import { applyRankOverrides, type RankOverride } from "./constants";
import { log } from "./log";

/**
 * Loads the admin rank changes (RankSetting rows) into RANKS for this server
 * process. Runs at startup (src/instrumentation.ts), after every save in
 * Admin → Ranks, and at most every REFRESH_MS from /api/rank-config, which
 * every page requests — so a second server instance catches up within that.
 */
const REFRESH_MS = 30_000;

declare global {
  var __lsmdRanksLoadedAt: number | undefined;
  var __lsmdRankOverrides: RankOverride[] | undefined;
}

export async function loadRankSettings({ force = false } = {}): Promise<RankOverride[]> {
  const fresh = Date.now() - (globalThis.__lsmdRanksLoadedAt ?? 0) < REFRESH_MS;
  if (!force && fresh && globalThis.__lsmdRankOverrides) return globalThis.__lsmdRankOverrides;

  try {
    const rows = await prisma.rankSetting.findMany();
    const overrides: RankOverride[] = rows.map((r) => ({
      name: r.name,
      position: r.position,
      shape: r.shape,
      count: r.count,
      color: r.color,
      layout: r.layout,
    }));
    applyRankOverrides(overrides);
    globalThis.__lsmdRankOverrides = overrides;
    globalThis.__lsmdRanksLoadedAt = Date.now();
    return overrides;
  } catch (error) {
    // The table may not exist yet on a deploy that has not pushed the schema.
    // Keep whatever is in effect (the shipped ladder at worst) and retry later.
    log.error("Rank settings could not be loaded", error);
    globalThis.__lsmdRanksLoadedAt = Date.now();
    return globalThis.__lsmdRankOverrides ?? [];
  }
}
