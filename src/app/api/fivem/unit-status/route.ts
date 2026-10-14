import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/api-error";
import { rejectUnlessFiveM } from "@/lib/fivem-auth";
import { matchOnePlayer, notOnRosterBody, parseActor, readFiveMSettings } from "@/lib/fivem-server";
import { isOnDuty, parseUnitStatusInput, setUnitStatus } from "@/lib/duty-board-server";
import { UNIT_STATUSES } from "@/lib/duty-board";
import { memberDisplayLabel } from "@/lib/utils";

/** /unitstatus in game: a medic sets their own status on the Duty Board. */
export async function POST(req: NextRequest) {
  const denied = rejectUnlessFiveM(req);
  if (denied) return denied;

  try {
    const body = await req.json().catch(() => null);
    const actor = parseActor(body);
    if (!actor) return NextResponse.json({ error: "Send the player's identifiers" }, { status: 400 });

    const parsed = parseUnitStatusInput(body);
    if ("error" in parsed) {
      return NextResponse.json(
        { error: "Unknown status", detail: `Use one of: ${UNIT_STATUSES.map((s) => s.key).join(", ")}.` },
        { status: 400 }
      );
    }

    const settings = await readFiveMSettings();
    if (settings && !settings.statusSync) {
      return NextResponse.json(
        { error: "Status sync is off", detail: "Command has switched in-game statuses off — set your status on the website's Duty Board." },
        { status: 409 }
      );
    }

    const match = await matchOnePlayer(actor, settings?.matchByName ?? false);
    if (!match) return NextResponse.json(notOnRosterBody(settings?.matchByName ?? false), { status: 404 });
    const { member } = match;

    if (!(await isOnDuty(member.id))) {
      return NextResponse.json({ error: "Not on duty", detail: "Go on duty before setting a unit status." }, { status: 409 });
    }

    const saved = await setUnitStatus(member.id, parsed.data, "fivem", `${memberDisplayLabel(member)} (in game)`);
    return NextResponse.json({ status: saved.status, unit: saved.unit, note: saved.note, member: memberDisplayLabel(member) });
  } catch (error) {
    return apiError("Failed to set the unit status", error);
  }
}
