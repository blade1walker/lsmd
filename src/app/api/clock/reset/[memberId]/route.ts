import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    const { memberId } = await params;

    await prisma.clockEntry.deleteMany({
      where: { memberId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error resetting clock data:", error);
    return NextResponse.json({ error: "Failed to reset" }, { status: 500 });
  }
}
