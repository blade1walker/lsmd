import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, isDenied } from "@/lib/auth/api";
import { log } from "@/lib/log";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ remarkId: string }> }
) {
  const auth = await requireAuth("training.manage");
  if (isDenied(auth)) return auth.error;

  try {
    const { remarkId } = await params;
    await prisma.remark.delete({ where: { id: remarkId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    log.error("Error deleting remark", error);
    return NextResponse.json({ error: "Failed to delete remark" }, { status: 500 });
  }
}
