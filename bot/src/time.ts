import { config } from "./config.js";

/** Minutes the zone is ahead of UTC at `date` (negative when behind). */
function zoneOffsetMinutes(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - date.getTime()) / 60_000);
}

/** A wall-clock time in `timeZone`, as the instant it names. */
function zonedToDate(y: number, mo: number, d: number, h: number, mi: number, timeZone: string): Date {
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  // Two passes settle the offset across a DST boundary.
  let offset = zoneOffsetMinutes(new Date(guess), timeZone);
  offset = zoneOffsetMinutes(new Date(guess - offset * 60_000), timeZone);
  return new Date(guess - offset * 60_000);
}

/** Today's date in the zone, as [year, month, day]. */
function zonedToday(timeZone: string): [number, number, number] {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" })
    .format(new Date())
    .split("-")
    .map(Number);
  return [parts[0], parts[1], parts[2]];
}

const UNITS: Record<string, number> = { m: 60_000, min: 60_000, h: 3_600_000, hr: 3_600_000, d: 86_400_000, w: 604_800_000 };

/**
 * Reads the times people actually type:
 *   "in 30m", "2h", "1d 4h"             — relative
 *   "18:30", "6:30pm"                    — today (tomorrow if already past)
 *   "tomorrow 18:30"
 *   "2026-10-05 18:30", "05/10/2026 18:30" (day first)
 *   "<t:1759680000:F>" or a Unix timestamp
 * Wall-clock times are in the configured TIMEZONE.
 */
export function parseWhen(input: string, timeZone = config.timezone): Date | null {
  const raw = input.trim().toLowerCase().replace(/^in\s+/, "");
  if (!raw) return null;

  const stamp = raw.match(/^<t:(\d+)(?::\w)?>$/) ?? raw.match(/^(\d{10})$/);
  if (stamp) return new Date(Number(stamp[1]) * 1000);

  // Relative: one or more "<n><unit>" pieces.
  const pieces = [...raw.matchAll(/(\d+)\s*(min|hr|m|h|d|w)\b/g)];
  if (pieces.length > 0 && raw.replace(/(\d+)\s*(min|hr|m|h|d|w)\b|\s+/g, "") === "") {
    const ms = pieces.reduce((sum, p) => sum + Number(p[1]) * UNITS[p[2]], 0);
    return new Date(Date.now() + ms);
  }

  const time = (text: string): [number, number] | null => {
    const m = text.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
    if (!m || (!m[2] && !m[3])) return null;
    let h = Number(m[1]);
    const mi = Number(m[2] ?? 0);
    if (m[3]) {
      if (h < 1 || h > 12) return null;
      h = (h % 12) + (m[3] === "pm" ? 12 : 0);
    }
    if (h > 23 || mi > 59) return null;
    return [h, mi];
  };

  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})[ t]+(.+)$/);
  if (iso) {
    const t = time(iso[4]);
    return t ? zonedToDate(+iso[1], +iso[2], +iso[3], t[0], t[1], timeZone) : null;
  }

  const dmy = raw.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})\s+(.+)$/);
  if (dmy) {
    const t = time(dmy[4]);
    return t ? zonedToDate(+dmy[3], +dmy[2], +dmy[1], t[0], t[1], timeZone) : null;
  }

  const tomorrow = raw.match(/^tomorrow\s+(.+)$/);
  const t = time(tomorrow ? tomorrow[1] : raw);
  if (!t) return null;
  const [y, mo, d] = zonedToday(timeZone);
  let when = zonedToDate(y, mo, d, t[0], t[1], timeZone);
  if (tomorrow || when.getTime() <= Date.now()) when = new Date(when.getTime() + 86_400_000);
  return when;
}

/** Discord renders this in every viewer's own timezone. */
export function discordTime(date: Date | string, style: "F" | "f" | "R" | "d" | "t" = "F") {
  return `<t:${Math.floor(new Date(date).getTime() / 1000)}:${style}>`;
}
