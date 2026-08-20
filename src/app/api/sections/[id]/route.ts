import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const section = await prisma.section.update({
      where: { id },
      data: body,
    });
    return NextResponse.json(section);
  } catch (error: any) {
    console.error("Error updating section:", error);
    return NextResponse.json({ error: "Failed to update section", detail: error.message?.slice(0, 200) }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.section.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Error deleting section:", error);
    return NextResponse.json({ error: "Failed to delete section", detail: error.message?.slice(0, 200) }, { status: 500 });
  }
}
