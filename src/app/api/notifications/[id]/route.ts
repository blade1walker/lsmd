import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, isDenied } from "@/lib/auth/api";
import { log } from "@/lib/log";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("notifications");
  if (isDenied(auth)) return auth.error;

  try {
    const { id } = await params;

    const notification = await prisma.promotionNotification.update({
      where: { id },
      data: { isRead: true },
    });

    return NextResponse.json(notification);
  } catch (error) {
    log.error("Error marking notification read", error);
    return NextResponse.json({ error: "Failed to mark read" }, { status: 500 });
  }
}
