import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied } from "@/lib/api-auth";

export async function GET() {
  const auth = await requireAuth("notifications");
  if (isDenied(auth)) return auth.error;

  try {
    const notifications = await prisma.promotionNotification.findMany({
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(notifications);
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { memberId, memberName, callSign, fromRank, toRank, promotedBy } = body;

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
    console.error("Error creating notification:", error);
    return NextResponse.json({ error: "Failed to create notification" }, { status: 500 });
  }
}
