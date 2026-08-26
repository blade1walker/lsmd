import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied } from "@/lib/api-auth";

export async function POST() {
  const auth = await requireAuth();
  if (isDenied(auth)) return auth.error;

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
