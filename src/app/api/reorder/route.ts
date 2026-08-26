import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied } from "@/lib/api-auth";

export async function POST(request: Request) {
  const auth = await requireAuth("roster.edit");
  if (isDenied(auth)) return auth.error;

  try {
    const body = await request.json();
    const { items, type } = body;

    if (type === "sections") {
      for (const item of items) {
        await prisma.section.update({
          where: { id: item.id },
          data: { order: item.order },
        });
      }
    } else if (type === "members") {
      for (const item of items) {
        await prisma.member.update({
          where: { id: item.id },
          data: { order: item.order, sectionId: item.sectionId },
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error reordering:", error);
    return NextResponse.json({ error: "Failed to reorder" }, { status: 500 });
  }
}
