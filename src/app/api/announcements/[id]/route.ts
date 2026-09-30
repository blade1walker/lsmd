import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied, actorLabel } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import { logAudit } from "@/lib/audit";
import { ANNOUNCEMENT_PERMISSIONS } from "@/lib/constants";
import { parseAnnouncement } from "@/lib/announcements";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const auth = await requireAuth(ANNOUNCEMENT_PERMISSIONS.view);
  if (isDenied(auth)) return auth.error;

  try {
    const { id } = await params;
    const announcement = await prisma.announcement.findUnique({ where: { id } });
    if (!announcement) return NextResponse.json({ error: "Announcement not found" }, { status: 404 });
    return NextResponse.json(announcement);
  } catch (error) {
    return apiError("Failed to fetch announcement", error);
  }
}

/** Edits a post that has not gone out yet. */
export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(ANNOUNCEMENT_PERMISSIONS.manage);
  if (isDenied(auth)) return auth.error;

  try {
    const { id } = await params;
    const parsed = parseAnnouncement((await req.json()) as Record<string, unknown>, true);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

    if (parsed.data.scheduledFor && parsed.data.scheduledFor.getTime() < Date.now() - 60_000) {
      return NextResponse.json({ error: "That time has already passed." }, { status: 400 });
    }

    // Conditional on still being Scheduled: an edit racing the bot's claim
    // must not change a post that is already on its way out.
    const updated = await prisma.announcement.updateMany({
      where: { id, status: "Scheduled" },
      data: parsed.data,
    });
    if (updated.count === 0) {
      return NextResponse.json(
        { error: "Only an announcement that is still scheduled can be edited." },
        { status: 409 }
      );
    }

    const announcement = await prisma.announcement.findUnique({ where: { id } });
    await logAudit({
      action: "update",
      entityType: "Announcement",
      entityId: id,
      entityLabel: announcement?.title ?? id,
      details: { fields: Object.keys(parsed.data).join(", ") },
      performedBy: actorLabel(auth.access),
    });
    return NextResponse.json(announcement);
  } catch (error) {
    return apiError("Failed to update announcement", error);
  }
}

/** Cancels a scheduled post. Kept, not deleted, so the history shows it. */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const auth = await requireAuth(ANNOUNCEMENT_PERMISSIONS.manage);
  if (isDenied(auth)) return auth.error;

  try {
    const { id } = await params;
    const cancelled = await prisma.announcement.updateMany({
      where: { id, status: "Scheduled" },
      data: { status: "Cancelled", cancelledByName: actorLabel(auth.access) },
    });
    if (cancelled.count === 0) {
      return NextResponse.json(
        { error: "Only an announcement that is still scheduled can be cancelled." },
        { status: 409 }
      );
    }

    const announcement = await prisma.announcement.findUnique({ where: { id } });
    await logAudit({
      action: "delete",
      entityType: "Announcement",
      entityId: id,
      entityLabel: announcement?.title ?? id,
      details: { cancelled: true },
      performedBy: actorLabel(auth.access),
    });
    return NextResponse.json(announcement);
  } catch (error) {
    return apiError("Failed to cancel announcement", error);
  }
}
