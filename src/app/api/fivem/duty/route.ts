import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { apiError } from "@/lib/api-error";
import { rejectUnlessFiveM } from "@/lib/fivem/auth";
import { clockOff, clockOn, matchOnePlayer, notOnRosterBody, parseActor, readFiveMSettings } from "@/lib/fivem/server";
import { memberDisplayLabel } from "@/lib/utils";

/**
 * A player went on or off EMS duty in game. Clocks them on or off the site
 * straight away, rather than waiting up to a minute for the next heartbeat.
 *
 * Going off duty in game closes whatever entry is open, including one opened
 * on the site: with duty sync on, the city is where duty is decided.
 */
export async function POST(req: NextRequest) {
  const denied = rejectUnlessFiveM(req);
  if (denied) return denied;

  try {
    const body = await req.json().catch(() => null);
    const actor = parseActor(body);
    const onDuty = (body as { onDuty?: unknown } | null)?.onDuty;
    if (!actor || typeof onDuty !== "boolean") {
      return NextResponse.json({ error: "Send the player's identifiers and onDuty: true or false" }, { status: 400 });
    }

    const settings = await readFiveMSettings();
    if (settings && !settings.dutySync) {
      return NextResponse.json(
        { error: "Duty sync is off", detail: "Command has switched duty sync off on the website — clock on at the website or with /duty in Discord." },
        { status: 409 }
      );
    }

    const match = await matchOnePlayer(actor, settings?.matchByName ?? false);
    if (!match) return NextResponse.json(notOnRosterBody(settings?.matchByName ?? false), { status: 404 });
    const { member } = match;

    if (onDuty) {
      const opened = await clockOn(member.id, "fivem");
      return NextResponse.json({ action: opened ? "clocked-on" : "already-on", member: memberDisplayLabel(member) });
    }

    const open = await prisma.clockEntry.count({ where: { memberId: member.id, clockOutAt: null } });
    if (open === 0) return NextResponse.json({ action: "already-off", member: memberDisplayLabel(member) });
    const seconds = await clockOff(member.id);
    return NextResponse.json({ action: "clocked-off", member: memberDisplayLabel(member), seconds });
  } catch (error) {
    return apiError("Failed to update duty", error);
  }
}
