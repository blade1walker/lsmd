import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { rejectUnlessFiveM } from "@/lib/fivem-auth";
import { readFiveMSettings, toSettingsView } from "@/lib/fivem-server";
import { UNIT_STATUSES } from "@/lib/duty-board";
import { CALL_NATURES, CALL_OUTCOMES, HOSPITALS } from "@/lib/calls";

/**
 * The resource's startup check: proves the key works and tells it which
 * features the website has switched on, plus the lists its commands accept,
 * so /unitstatus and /emscall can show help in game without hard-coding them.
 */
export async function GET(req: NextRequest) {
  const denied = rejectUnlessFiveM(req);
  if (denied) return denied;

  try {
    const settings = toSettingsView(await readFiveMSettings());
    return NextResponse.json({
      ok: true,
      dutySync: settings.dutySync,
      statusSync: settings.statusSync,
      callSync: settings.callSync,
      matchByName: settings.matchByName,
      statuses: UNIT_STATUSES.map((s) => s.key),
      natures: CALL_NATURES,
      outcomes: CALL_OUTCOMES,
      hospitals: HOSPITALS,
    });
  } catch (error) {
    return apiError("Failed to answer the ping", error);
  }
}
