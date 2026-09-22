import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied, actorLabel } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import { logAudit } from "@/lib/audit";
import { INTERVIEW_SECTION_PERMISSIONS } from "@/lib/constants";
import { getPromotionSettings } from "@/lib/interviews-server";

/**
 * The scoring thresholds and announcement wiring.
 *
 * Readable by anyone in the section — the session page shows the passing score
 * beside the panel total and colours the scores against it, so hiding the
 * numbers behind the manage permission would only make the scores unreadable.
 * Writing them is interviews.manage.
 */
export async function GET() {
  const auth = await requireAuth(INTERVIEW_SECTION_PERMISSIONS);
  if (isDenied(auth)) return auth.error;

  try {
    return NextResponse.json(await getPromotionSettings());
  } catch (error) {
    return apiError("Failed to load the promotion settings", error);
  }
}

/** A whole-number percentage, or null when the field was not submitted. */
function percent(value: unknown): number | null | "invalid" {
  if (value === undefined) return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0 || n > 100) return "invalid";
  return n;
}

/** A whole number of days, or null when the field was not submitted. */
function days(value: unknown): number | null | "invalid" {
  if (value === undefined) return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0 || n > 3650) return "invalid";
  return n;
}

export async function PUT(req: NextRequest) {
  const auth = await requireAuth("interviews.manage");
  if (isDenied(auth)) return auth.error;

  try {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: "Nothing was submitted" }, { status: 400 });

    const data: Record<string, unknown> = {};

    for (const key of [
      "passingScore",
      "minSopScore",
      "minMedicalScore",
      "minSituationScore",
      "minOverallScore",
      "minTrainingPercent",
    ] as const) {
      const value = percent(body[key]);
      if (value === "invalid") return NextResponse.json({ error: `${key} must be between 0 and 100` }, { status: 400 });
      if (value !== null) data[key] = value;
    }

    for (const key of ["minDaysInRank", "minDaysInDepartment", "cooldownDays"] as const) {
      const value = days(body[key]);
      if (value === "invalid") return NextResponse.json({ error: `${key} must be a whole number of days` }, { status: 400 });
      if (value !== null) data[key] = value;
    }

    for (const key of ["requireActive", "requireTrainingCheck", "announceWebhook"] as const) {
      if (typeof body[key] === "boolean") data[key] = body[key];
    }

    if (Array.isArray(body.requiredDepartments)) {
      data.requiredDepartments = body.requiredDepartments
        .filter((d): d is string => typeof d === "string")
        .map((d) => d.trim())
        .filter(Boolean)
        .slice(0, 20);
    }

    if (typeof body.announcementWebhookUrl === "string") {
      const url = body.announcementWebhookUrl.trim();
      if (url && !url.startsWith("https://")) {
        return NextResponse.json({ error: "The webhook URL must start with https://" }, { status: 400 });
      }
      data.announcementWebhookUrl = url || null;
    }

    if (typeof body.announcementTemplate === "string") {
      const template = body.announcementTemplate.trim();
      if (!template) return NextResponse.json({ error: "The announcement cannot be empty" }, { status: 400 });
      data.announcementTemplate = template.slice(0, 3000);
    }

    const actor = actorLabel(auth.access);
    data.updatedBy = actor;

    await prisma.promotionSettings.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", ...data },
      update: data,
    });

    await logAudit({
      action: "update",
      entityType: "PromotionSettings",
      entityId: "singleton",
      entityLabel: "Promotion interview settings",
      details: { fields: Object.keys(data).filter((k) => k !== "updatedBy").join(", ") },
      performedBy: actor,
    });

    return NextResponse.json(await getPromotionSettings());
  } catch (error) {
    return apiError("Failed to save the promotion settings", error);
  }
}
