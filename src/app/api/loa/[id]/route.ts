import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    const loa = await prisma.lOA.update({
      where: { id },
      data: { status },
    });

    if (status === "Expired" || status === "Cancelled") {
      await prisma.member.update({
        where: { id: loa.memberId },
        data: { activity: "Active" },
      });
    }

    return NextResponse.json(loa);
  } catch (error) {
    console.error("Error updating LOA:", error);
    return NextResponse.json({ error: "Failed to update LOA" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.lOA.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting LOA:", error);
    return NextResponse.json({ error: "Failed to delete LOA" }, { status: 500 });
  }
}
