import { log } from "@/lib/log";
/** Runs once when a server instance starts, before it answers any request. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // Rank order and insignia set in Admin → Ranks, so the first page already uses them.
  const { loadRankSettings } = await import("./lib/rank-settings");
  await loadRankSettings({ force: true });

  // Open database connections and fill the roster cache in the background, so
  // the first visitor after a restart is not the one who waits for them.
  const { warmRosterCaches } = await import("./lib/roster");
  warmRosterCaches().catch((error) => log.error("Cache warm-up failed", error));

  // A verified database backup every day (DATA_DIR/backups).
  const { scheduleDailyBackups } = await import("./lib/backup");
  scheduleDailyBackups();
}
