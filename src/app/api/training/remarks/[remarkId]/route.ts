import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ remarkId: string }> }
) {
  try {
    const { remarkId } = await params;
    await prisma.remark.delete({ where: { id: remarkId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting remark:", error);
    return NextResponse.json({ error: "Failed to delete remark" }, { status: 500 });
  }
}
