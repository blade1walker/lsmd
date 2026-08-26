import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api-error";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const shift = await prisma.shift.update({
      where: { id },
      data: body,
    });

    return NextResponse.json(shift);
  } catch (error) {
    return apiError("Failed to update shift", error);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.shift.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError("Failed to delete shift", error);
  }
}
