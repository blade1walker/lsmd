const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Whole days from `start` to `now`, counted by calendar date in UTC — someone
 * who joined yesterday evening has served 1 day this morning, not 0 because
 * 24 hours have not yet passed.
 */
export function daysSince(start: Date, now: Date = new Date()): number {
  const from = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  const to = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.max(0, Math.round((to - from) / DAY_MS));
}
