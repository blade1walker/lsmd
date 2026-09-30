import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import { ANNOUNCEMENT_PERMISSIONS } from "@/lib/constants";
import { nextOccurrence, type Repeat } from "@/lib/announcements";

/**
 * The bot reporting how a claimed post went. A repeating post schedules its
 * next occurrence as a new row, so each send keeps its own history entry and
 * message link.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(ANNOUNCEMENT_PERMISSIONS.manage);
  if (isDenied(auth)) return auth.error;

  try {
    const { id } = await params;
    const body = (await req.json()) as { ok?: boolean; messageUrl?: string; error?: string };
    const ok = body.ok === true;

    const settled = await prisma.announcement.updateMany({
      where: { id, status: "Sending" },
      data: ok
        ? { status: "Sent", sentAt: new Date(), messageUrl: body.messageUrl?.slice(0, 300) ?? null, error: null }
        : { status: "Failed", error: (body.error || "Unknown error").slice(0, 500) },
    });
    if (settled.count === 0) {
      return NextResponse.json({ error: "This announcement is not being sent." }, { status: 409 });
    }

    const announcement = await prisma.announcement.findUniqueOrThrow({ where: { id } });

    // Repeats re-arm after a failure too — one refused post (a deleted
    // channel, a brief outage) should not silently end a weekly reminder.
    let next = null;
    const when = nextOccurrence(announcement.scheduledFor, announcement.repeat as Repeat);
    if (when) {
      next = await prisma.announcement.create({
        data: {
          title: announcement.title,
          message: announcement.message,
          channelId: announcement.channelId,
          mention: announcement.mention,
          color: announcement.color,
          imageUrl: announcement.imageUrl,
          footer: announcement.footer,
          repeat: announcement.repeat,
          scheduledFor: when,
          createdByDiscordId: announcement.createdByDiscordId,
          createdByName: announcement.createdByName,
        },
      });
    }

    return NextResponse.json({ announcement, next });
  } catch (error) {
    return apiError("Failed to record announcement result", error);
  }
}
