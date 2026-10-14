import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied, actorLabel } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import { logAudit } from "@/lib/audit";
import { FIVEM_PERMISSIONS } from "@/lib/constants";
import { parseJoinCode, parseServerAddress } from "@/lib/fivem";
import { ensureFiveMSettings, getCitySnapshot, toFullStatus, toSettingsView } from "@/lib/fivem-server";

/** The City Link page: settings, and the city as the link sees it right now. */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(FIVEM_PERMISSIONS.view);
  if (isDenied(auth)) return auth.error;

  try {
    const settings = await ensureFiveMSettings();
    const snapshot = await getCitySnapshot({ fresh: req.nextUrl.searchParams.get("fresh") === "1" });
    return NextResponse.json({ settings: toSettingsView(settings), status: await toFullStatus(snapshot) });
  } catch (error) {
    return apiError("Failed to load the City Link", error);
  }
}

const TOGGLES = ["showPublicStatus", "showPublicNames", "matchByName", "dutySync", "callSync", "statusSync"] as const;

export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(FIVEM_PERMISSIONS.manage);
  if (isDenied(auth)) return auth.error;

  try {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: "Nothing was submitted" }, { status: 400 });

    const data: Record<string, unknown> = {};

    if (body.serverAddress !== undefined) {
      const parsed = parseServerAddress(typeof body.serverAddress === "string" ? body.serverAddress : "");
      if (parsed && "error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
      // Stored as typed (trimmed) so the form shows what was entered; parsed again on every read.
      data.serverAddress = parsed ? String(body.serverAddress).trim().slice(0, 200) : null;
    }
    if (body.joinCode !== undefined) {
      const parsed = parseJoinCode(typeof body.joinCode === "string" ? body.joinCode : "");
      if (parsed && "error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
      data.joinCode = parsed ? parsed.code : null;
    }
    for (const key of TOGGLES) {
      if (typeof body[key] === "boolean") data[key] = body[key];
    }

    const actor = actorLabel(auth.access);
    await ensureFiveMSettings();
    const saved = await prisma.fiveMSettings.update({ where: { id: "singleton" }, data: { ...data, updatedBy: actor } });

    await logAudit({
      action: "update",
      entityType: "FiveMSettings",
      entityId: saved.id,
      entityLabel: "City Link settings",
      details: {
        serverAddress: saved.serverAddress,
        joinCode: saved.joinCode,
        ...Object.fromEntries(TOGGLES.map((k) => [k, saved[k]])),
      },
      performedBy: actor,
    });

    return NextResponse.json(toSettingsView(saved));
  } catch (error) {
    return apiError("Failed to save the City Link settings", error);
  }
}
