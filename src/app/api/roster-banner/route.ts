import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied, actorLabel } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import { logAudit } from "@/lib/audit";

/** Long enough for a sentence, short enough to stay one line across the roster. */
const LIMITS = { label: 60, highlight: 80, message: 240 } as const;

/**
 * The spotlight strip on the public roster. The roster itself reads the row
 * straight from the database; this route is only the editor's, so both
 * methods require roster.announce.
 */
export async function GET() {
  const auth = await requireAuth("roster.announce");
  if (isDenied(auth)) return auth.error;

  try {
    const banner = await prisma.rosterBanner.upsert({
      where: { id: "singleton" },
      create: { id: "singleton" },
      update: {},
    });
    return NextResponse.json(banner);
  } catch (error) {
    return apiError("Failed to load the roster banner", error);
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAuth("roster.announce");
  if (isDenied(auth)) return auth.error;

  try {
    const body = await req.json();
    const text = (key: keyof typeof LIMITS) =>
      body[key] === undefined ? undefined : String(body[key] ?? "").trim().slice(0, LIMITS[key]);

    const fields = {
      ...(typeof body.active === "boolean" ? { active: body.active } : {}),
      ...(text("label") !== undefined ? { label: text("label") } : {}),
      ...(text("highlight") !== undefined ? { highlight: text("highlight") } : {}),
      ...(text("message") !== undefined ? { message: text("message") } : {}),
      updatedBy: actorLabel(auth.access),
    };

    const banner = await prisma.rosterBanner.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", ...fields },
      update: fields,
    });

    await logAudit({
      action: "update",
      entityType: "RosterBanner",
      entityId: banner.id,
      entityLabel: banner.label || banner.highlight || "Roster banner",
      details: { active: banner.active },
      performedBy: actorLabel(auth.access),
    });

    return NextResponse.json(banner);
  } catch (error) {
    return apiError("Failed to save the roster banner", error);
  }
}
