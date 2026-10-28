import { loadRankSettings } from "@/lib/rank-settings";

export const dynamic = "force-dynamic";

/**
 * The admin rank changes as a script, loaded by the root layout before the
 * app's own code so the browser's RANKS matches the server's on first render.
 * Public: it holds only the rank order and badge looks the roster shows anyway.
 */
export async function GET() {
  const overrides = await loadRankSettings();
  // "<" escaped so the JSON can never close a surrounding script element.
  const json = JSON.stringify(overrides).replace(/</g, "\\u003c");
  return new Response(`window.__LSMD_RANK_OVERRIDES__=${json};`, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
