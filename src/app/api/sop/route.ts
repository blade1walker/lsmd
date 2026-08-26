import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";

export async function GET() {
  try {
    const sop = await prisma.sopContent.findFirst();
    return NextResponse.json(sop ?? { content: "" });
  } catch (error) {
      return apiError("Database connection failed", error);
  }
}

export async function PUT(req: Request) {
  const auth = await requireAuth("sop.edit");
  if (isDenied(auth)) return auth.error;

  try {
    const { content } = await req.json();
    const existing = await prisma.sopContent.findFirst();

    if (existing) {
      await prisma.sopContent.update({
        where: { id: existing.id },
        data: { content },
      });
    } else {
      await prisma.sopContent.create({
        data: { id: "sop-main", content },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
      return apiError("Failed to save SOP", error);
  }
}
