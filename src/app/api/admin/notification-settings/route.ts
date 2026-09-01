import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied, actorLabel } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import { logAudit } from "@/lib/audit";

/**
 * Only these columns may be written. PATCH used to spread the request body
 * straight into the update, so any field a caller invented was written as-is.
 */
const BOOLEAN_FIELDS = [
  "recruitWebhook",
  "recruitDM",
  "onboardingWebhook",
  "onboardingDM",
  "ftpWebhook",
  "ftpDM",
  "departmentWebhook",
  "departmentDM",
  "loaWebhook",
  "loaDM",
  "loaReminderDM",
  "loaExpiredDM",
  "promotionWebhook",
  "demotionWebhook",
  "callsignWebhook",
  "testWebhook",
  "testDM",
] as const;

const STRING_FIELDS = [
  "recruitWebhookApprove",
  "recruitWebhookDecline",
  "recruitDMApprove",
  "recruitDMDecline",
  "onboardingWebhookMessage",
  "onboardingDMApprove",
  "onboardingDMDecline",
  "ftpWebhookApprove",
  "ftpDMApprove",
  "ftpDMDecline",
  "departmentWebhookSubmitted",
  "departmentWebhookApprove",
  "departmentWebhookDecline",
  "departmentDMApprove",
  "departmentDMDecline",
  "loaWebhookApprove",
  "loaWebhookDecline",
  "loaDMApprove",
  "loaDMDecline",
  "loaReminderMessage",
  "loaExpiredMessage",
  "promotionWebhookMessage",
  "demotionWebhookMessage",
  "callsignWebhookMessage",
] as const;

const JSON_FIELDS = ["webhookUrls", "botSettings"] as const;

/** A message longer than Discord accepts would fail at send time, not at save time. */
const MAX_MESSAGE_LENGTH = 1800;

function sanitize(body: Record<string, unknown>) {
  const data: Record<string, unknown> = {};

  for (const key of BOOLEAN_FIELDS) {
    if (typeof body[key] === "boolean") data[key] = body[key];
  }
  for (const key of STRING_FIELDS) {
    if (typeof body[key] === "string") data[key] = (body[key] as string).slice(0, MAX_MESSAGE_LENGTH);
  }
  for (const key of JSON_FIELDS) {
    const value = body[key];
    if (value === null || (typeof value === "object" && !Array.isArray(value))) data[key] = value;
  }

  return data;
}

/**
 * Requires the same permission as PATCH. The row carries the bot token and every
 * webhook URL, which are credentials — this route used to return them to any
 * caller, authenticated or not.
 */
export async function GET() {
  const auth = await requireAuth("notifications");
  if (isDenied(auth)) return auth.error;

  try {
    let settings = await prisma.notificationSettings.findUnique({
      where: { id: "singleton" },
    });

    if (!settings) {
      settings = await prisma.notificationSettings.create({
        data: { id: "singleton" },
      });
    }

    return NextResponse.json(settings);
  } catch (error) {
      return apiError("Failed to fetch settings", error);
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAuth("notifications");
  if (isDenied(auth)) return auth.error;

  try {
    const body = await req.json();
    const data = sanitize(body);

    let settings = await prisma.notificationSettings.findUnique({
      where: { id: "singleton" },
    });

    if (!settings) {
      settings = await prisma.notificationSettings.create({
        data: { id: "singleton", ...data },
      });
    } else {
      settings = await prisma.notificationSettings.update({
        where: { id: "singleton" },
        data,
      });
    }

    await logAudit({
      action: "update",
      entityType: "NotificationSettings",
      entityId: "singleton",
      entityLabel: "Notification settings",
      details: { fields: Object.keys(data).join(", ") },
      performedBy: actorLabel(auth.access),
    });

    return NextResponse.json(settings);
  } catch (error) {
      return apiError("Failed to update settings", error);
  }
}
