import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, isDenied } from "@/lib/auth/api";
import { log } from "@/lib/log";

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
    log.error("Error reordering", error);
    return NextResponse.json({ error: "Failed to reorder" }, { status: 500 });
  }
}
