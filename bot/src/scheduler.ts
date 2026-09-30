import type { Client } from "discord.js";
import { api, ApiError, type Actor } from "./api.js";
import { deliver, type Announcement } from "./announcements.js";
import { staffLog } from "./log.js";

const INTERVAL_MS = 20_000;

/**
 * Posts scheduled announcements when they fall due. The schedule lives on the
 * website, so a restart — or a move to another host — loses nothing: the
 * next tick picks up whatever is due, including anything missed while down.
 */
export function startScheduler(client: Client) {
  const actor: Actor = { id: client.user!.id, name: "Announcement scheduler" };
  let running = false;
  let warned = false;

  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const due = await api<Announcement[]>(actor, "POST", "/api/announcements/claim");
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
    } catch (err) {
      // Say it once per outage, not every 20 seconds.
      if (!warned) {
        console.error("[scheduler] could not reach the website:", err instanceof ApiError ? err.message : err);
        warned = true;
      }
    } finally {
      running = false;
    }
  };

  void tick();
  return setInterval(tick, INTERVAL_MS);
}
