import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, isDenied, actorLabel } from "@/lib/auth/api";
import { log } from "@/lib/log";

export async function GET() {
  const auth = await requireAuth("notifications");
  if (isDenied(auth)) return auth.error;

  try {
    const notifications = await prisma.promotionNotification.findMany({
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(notifications);
  } catch (error) {
    log.error("Error fetching notifications", error);
    return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 });
  }
}

/** Promotion notices feed Promotion History, so writing one needs roster.promote; it used to be open. */
export async function POST(request: Request) {
  const auth = await requireAuth("roster.promote");
  if (isDenied(auth)) return auth.error;

  try {
    const body = await request.json();
    const { memberId, memberName, callSign, fromRank, toRank } = body;
    const promotedBy = actorLabel(auth.access);

    const notification = await prisma.promotionNotification.create({
      data: {
        memberId,
        memberName,
        callSign,
        fromRank,
        toRank,
        promotedBy,
      },
    });

    return NextResponse.json(notification, { status: 201 });
  } catch (error) {
    log.error("Error creating notification", error);
    return NextResponse.json({ error: "Failed to create notification" }, { status: 500 });
  }
}
