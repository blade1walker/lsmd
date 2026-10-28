/** Runs once when a server instance starts, before it answers any request. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // Rank order and insignia set in Admin → Ranks, so the first page already uses them.
  const { loadRankSettings } = await import("./lib/rank-settings");
  await loadRankSettings({ force: true });
}
