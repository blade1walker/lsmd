import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api-error";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const section = await prisma.section.update({
      where: { id },
      data: body,
    });
    return NextResponse.json(section);
  } catch (error) {
    console.error("Error updating section:", error);
    return apiError("Failed to update section", error);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.section.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting section:", error);
    return apiError("Failed to delete section", error);
  }
}
