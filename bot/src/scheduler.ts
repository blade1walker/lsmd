import type { Client } from "discord.js";
import { apiWithHeaders, ApiError, type Actor } from "./api.js";
import { deliver, type Announcement } from "./announcements.js";
import { staffLog } from "./log.js";

/**
 * The longest the scheduler sleeps between checks. It normally wakes exactly
 * when the next post is due (the website says when) or when this bot
 * schedules one, so this is only a safety net — for a post made by another
 * bot process, or a clock that drifted.
 *
 * It used to ask every 20 seconds. That kept the website's database awake
 * around the clock and used up its host's monthly quota, after which every
 * request failed.
 */
const MAX_SLEEP_MS = 30 * 60_000;
/** After an outage, try again this soon rather than waiting the full safety net. */
const RETRY_MS = 2 * 60_000;
/** After posting, check again shortly: a repeating post has just re-armed itself. */
const AFTER_SEND_MS = 5_000;

let wake: ((at?: Date | string | null) => void) | null = null;

/**
 * Makes the scheduler check at `at` (or now) if that is sooner than it
 * planned to — called when this bot schedules or reschedules a post.
 */
export function wakeScheduler(at?: Date | string | null) {
  wake?.(at);
}

/**
 * Posts scheduled announcements when they fall due. The schedule lives on the
 * website, so a restart — or a move to another host — loses nothing: the
 * first check picks up whatever is due, including anything missed while down.
 */
export function startScheduler(client: Client) {
  const actor: Actor = { id: client.user!.id, name: "Announcement scheduler" };
  let running = false;
  let warned = false;
  let timer: NodeJS.Timeout | null = null;
  let nextAt = Infinity;

  const plan = (delayMs: number) => {
    const at = Date.now() + Math.min(Math.max(delayMs, 0), MAX_SLEEP_MS);
    if (timer && at >= nextAt) return;
    if (timer) clearTimeout(timer);
    nextAt = at;
    timer = setTimeout(() => {
      timer = null;
      nextAt = Infinity;
      void tick();
    }, at - Date.now());
  };

  const tick = async () => {
    if (running) return plan(AFTER_SEND_MS);
    running = true;
    try {
      const { data: due, headers } = await apiWithHeaders<Announcement[]>(actor, "POST", "/api/announcements/claim");
      warned = false;
      for (const a of due) {
        const result = await deliver(client, actor, a);
        if (result.ok) {
          console.log(`[scheduler] posted "${a.title}" → ${result.url}`);
        } else {
          console.warn(`[scheduler] "${a.title}" failed: ${result.error}`);
          await staffLog(client, { id: a.createdByDiscordId }, `Scheduled announcement failed: ${a.title}`, result.error);
        }
      }
      const nextDue = Date.parse(headers.get("x-next-due") ?? "");
      if (due.length > 0) plan(AFTER_SEND_MS);
      // A website without the header yet: fall back to checking every minute.
      else if (!headers.has("x-nexus-schedule")) plan(60_000);
      else plan(Number.isNaN(nextDue) ? MAX_SLEEP_MS : nextDue - Date.now() + 1_000);
    } catch (err) {
      // Say it once per outage, not on every retry.
      if (!warned) {
        console.error("[scheduler] could not reach the website:", err instanceof ApiError ? err.message : err);
        warned = true;
      }
      plan(RETRY_MS);
    } finally {
      running = false;
    }
  };

  wake = (at) => {
    const t = at ? new Date(at).getTime() : Date.now();
    plan(Number.isNaN(t) ? 0 : t - Date.now() + 1_000);
  };

  void tick();
}
