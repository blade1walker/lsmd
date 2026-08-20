import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: NextRequest,
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

    if (status === "Approved") {
      await prisma.member.update({
        where: { id: loa.memberId },
        data: { activity: "LOA" },
      });
    } else if (status === "Declined" || status === "Expired" || status === "Cancelled") {
      await prisma.member.update({
        where: { id: loa.memberId },
        data: { activity: "Active" },
      });
    }

    return NextResponse.json(loa);
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to update LOA", detail: error.message?.slice(0, 200) },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.lOA.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to delete LOA", detail: error.message?.slice(0, 200) },
      { status: 500 }
    );
  }
}
