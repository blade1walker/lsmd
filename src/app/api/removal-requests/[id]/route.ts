import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const removalRequest = await prisma.removalRequest.update({
      where: { id },
      data: body,
    });

    return NextResponse.json(removalRequest);
  } catch (error) {
    console.error("Error updating removal request:", error);
    return NextResponse.json({ error: "Failed to update request" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.removalRequest.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting removal request:", error);
    return NextResponse.json({ error: "Failed to delete request" }, { status: 500 });
  }
}
