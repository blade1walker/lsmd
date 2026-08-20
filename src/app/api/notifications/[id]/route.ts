import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const notification = await prisma.promotionNotification.update({
      where: { id },
      data: { isRead: true },
    });

    return NextResponse.json(notification);
  } catch (error) {
    console.error("Error marking notification read:", error);
    return NextResponse.json({ error: "Failed to mark read" }, { status: 500 });
  }
}
