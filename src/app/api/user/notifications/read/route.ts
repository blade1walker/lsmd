import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST() {
  try {
    await prisma.promotionNotification.updateMany({
      where: { isRead: false },
      data: { isRead: true },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error marking all read:", error);
    return NextResponse.json({ error: "Failed to mark all read" }, { status: 500 });
  }
}
