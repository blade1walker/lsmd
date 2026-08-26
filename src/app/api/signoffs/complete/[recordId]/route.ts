import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied } from "@/lib/api-auth";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ recordId: string }> }
) {
  const auth = await requireAuth("training.signoff.manage");
  if (isDenied(auth)) return auth.error;

  try {
    const { recordId } = await params;
    await prisma.fTOSignOffRecord.delete({ where: { id: recordId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting signoff record:", error);
    return NextResponse.json({ error: "Failed to delete record" }, { status: 500 });
  }
}
