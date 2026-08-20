import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const sop = await prisma.sopContent.findFirst();
    return NextResponse.json(sop ?? { content: "" });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Database connection failed", detail: error.message?.slice(0, 200) },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
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
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to save SOP", detail: error.message?.slice(0, 200) },
      { status: 500 }
    );
  }
}
