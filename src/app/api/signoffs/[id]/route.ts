import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, isDenied } from "@/lib/auth/api";
import { log } from "@/lib/log";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("training.signoff.manage");
  if (isDenied(auth)) return auth.error;

  try {
    const { id } = await params;
    const body = await request.json();

    const definition = await prisma.signOffDefinition.update({
      where: { id },
      data: body,
    });

    return NextResponse.json(definition);
  } catch (error) {
    log.error("Error updating signoff", error);
    return NextResponse.json({ error: "Failed to update signoff" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("training.signoff.manage");
  if (isDenied(auth)) return auth.error;

  try {
    const { id } = await params;
    await prisma.signOffDefinition.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    log.error("Error deleting signoff", error);
    return NextResponse.json({ error: "Failed to delete signoff" }, { status: 500 });
  }
}
