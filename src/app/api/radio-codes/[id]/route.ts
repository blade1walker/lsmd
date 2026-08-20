import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const code = await prisma.radioCode.update({
      where: { id },
      data: body,
    });

    return NextResponse.json(code);
  } catch (error) {
    console.error("Error updating radio code:", error);
    return NextResponse.json({ error: "Failed to update code" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.radioCode.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting radio code:", error);
    return NextResponse.json({ error: "Failed to delete code" }, { status: 500 });
  }
}
