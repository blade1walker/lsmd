import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, isDenied } from "@/lib/auth/api";
import { log } from "@/lib/log";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ memberId: string }> }
) {
  const auth = await requireAuth("clock.view");
  if (isDenied(auth)) return auth.error;

  try {
    const { memberId } = await params;

    await prisma.clockEntry.deleteMany({
      where: { memberId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error("Error resetting clock data", error);
    return NextResponse.json({ error: "Failed to reset" }, { status: 500 });
  }
}
