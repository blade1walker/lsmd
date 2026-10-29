import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, isDenied, actorLabel } from "@/lib/auth/api";
import { apiError } from "@/lib/api-error";
import { logAudit } from "@/lib/audit";
import { ACTIVITY_PERMISSIONS } from "@/lib/constants";
import { ACTIVITY_LIMITS } from "@/lib/activity";
import { ensureActivitySettings, toActivitySettingsView } from "@/lib/activity/server";

/** The weekly activity requirement. */
export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(ACTIVITY_PERMISSIONS.manage);
  if (isDenied(auth)) return auth.error;

  try {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: "Nothing was submitted" }, { status: 400 });

    const data: { weeklyHoursTarget?: number; graceDays?: number } = {};
    for (const key of ["weeklyHoursTarget", "graceDays"] as const) {
      if (body[key] === undefined) continue;
      const n = Number(body[key]);
      const { min, max } = ACTIVITY_LIMITS[key];
      if (!Number.isInteger(n) || n < min || n > max) {
        return NextResponse.json(
          { error: `${key === "weeklyHoursTarget" ? "Weekly hours" : "Grace period"} must be a whole number from ${min} to ${max}` },
          { status: 400 }
        );
      }
      data[key] = n;
    }

    const actor = actorLabel(auth.access);
    await ensureActivitySettings();
    const saved = await prisma.activitySettings.update({ where: { id: "singleton" }, data: { ...data, updatedBy: actor } });

    await logAudit({
      action: "update",
      entityType: "ActivitySettings",
      entityId: saved.id,
      entityLabel: "Activity requirement",
      details: { weeklyHoursTarget: saved.weeklyHoursTarget, graceDays: saved.graceDays },
      performedBy: actor,
    });

    return NextResponse.json(toActivitySettingsView(saved));
  } catch (error) {
    return apiError("Failed to save the activity requirement", error);
  }
}
