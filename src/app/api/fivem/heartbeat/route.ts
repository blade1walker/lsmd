import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { rejectUnlessFiveM } from "@/lib/fivem-auth";
import { applyHeartbeat, parseHeartbeat } from "@/lib/fivem-server";

/**
 * The resource's once-a-minute report of everyone in the city. Keeps city
 * time and, with duty sync on, the duty clock in step with in-game duty —
 * including clocking off whoever left without the resource seeing them go.
 */
export async function POST(req: NextRequest) {
  const denied = rejectUnlessFiveM(req);
  if (denied) return denied;

  try {
    const parsed = parseHeartbeat(await req.json().catch(() => null));
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
    return NextResponse.json(await applyHeartbeat(parsed));
  } catch (error) {
    return apiError("Failed to apply the heartbeat", error);
  }
}
