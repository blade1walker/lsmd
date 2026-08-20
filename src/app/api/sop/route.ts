import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const sop = await prisma.sopContent.findFirst();
    return NextResponse.json(sop);
  } catch (error) {
    console.error("Error fetching SOP:", error);
    return NextResponse.json({ error: "Failed to fetch SOP" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { content } = body;

    const sop = await prisma.sopContent.upsert({
      where: { id: "default" },
      update: { content },
      create: { id: "default", content },
    });

    return NextResponse.json(sop);
  } catch (error) {
    console.error("Error updating SOP:", error);
    return NextResponse.json({ error: "Failed to update SOP" }, { status: 500 });
  }
}
