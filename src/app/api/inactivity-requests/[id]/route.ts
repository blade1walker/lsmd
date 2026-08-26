import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied } from "@/lib/api-auth";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("hr.inactivity.approve");
  if (isDenied(auth)) return auth.error;

  try {
    const { id } = await params;
    const body = await request.json();

    const inactivityRequest = await prisma.inactivityRequest.update({
      where: { id },
      data: body,
    });

    return NextResponse.json(inactivityRequest);
  } catch (error) {
    console.error("Error updating inactivity request:", error);
    return NextResponse.json({ error: "Failed to update request" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.inactivityRequest.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting inactivity request:", error);
    return NextResponse.json({ error: "Failed to delete request" }, { status: 500 });
  }
}
