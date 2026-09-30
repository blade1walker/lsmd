import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied, actorLabel } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import { logAudit } from "@/lib/audit";
import { ANNOUNCEMENT_PERMISSIONS } from "@/lib/constants";
import { parseAnnouncement, type AnnouncementInput } from "@/lib/announcements";

/**
 * ?view=scheduled (default) lists what is still to go out, soonest first;
 * ?view=history lists everything else, newest first.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(ANNOUNCEMENT_PERMISSIONS.view);
  if (isDenied(auth)) return auth.error;

  try {
    const view = req.nextUrl.searchParams.get("view") === "history" ? "history" : "scheduled";
    const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get("limit")) || 25, 1), 100);

    const announcements = await prisma.announcement.findMany({
      where:
        view === "scheduled"
          ? { status: { in: ["Scheduled", "Sending"] } }
          : { status: { in: ["Sent", "Failed", "Cancelled"] } },
      orderBy: view === "scheduled" ? { scheduledFor: "asc" } : { updatedAt: "desc" },
      take: limit,
    });
    return NextResponse.json(announcements);
  } catch (error) {
    return apiError("Failed to fetch announcements", error);
  }
}

/**
 * Creates a post. With sendNow the row starts out claimed ("Sending") and the
 * caller — the bot — delivers it immediately and reports the result, so a
 * post made "now" is in the history like any scheduled one.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAuth(ANNOUNCEMENT_PERMISSIONS.manage);
  if (isDenied(auth)) return auth.error;

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const sendNow = body.sendNow === true;
    const parsed = parseAnnouncement({ ...body, ...(sendNow ? { scheduledFor: null } : {}) }, false);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const data = parsed.data as AnnouncementInput;

    if (!sendNow && data.scheduledFor.getTime() < Date.now() - 60_000) {
      return NextResponse.json({ error: "That time has already passed." }, { status: 400 });
    }

    const announcement = await prisma.announcement.create({
      data: {
        ...data,
        status: sendNow ? "Sending" : "Scheduled",
        claimedAt: sendNow ? new Date() : null,
        createdByDiscordId: auth.access.discordId,
        createdByName: actorLabel(auth.access),
      },
    });

    await logAudit({
      action: "create",
      entityType: "Announcement",
      entityId: announcement.id,
      entityLabel: announcement.title,
      details: {
        channelId: announcement.channelId,
        scheduledFor: sendNow ? "now" : announcement.scheduledFor.toISOString(),
        repeat: announcement.repeat,
      },
      performedBy: actorLabel(auth.access),
    });

    return NextResponse.json(announcement, { status: 201 });
  } catch (error) {
    return apiError("Failed to create announcement", error);
  }
}
