import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const sections = await prisma.section.findMany({
      include: { members: { orderBy: { order: "asc" } } },
      orderBy: { order: "asc" },
    });
    return NextResponse.json(sections);
  } catch (error: any) {
    return NextResponse.json(
      { error: "Database connection failed", detail: error.message?.slice(0, 200) },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const section = await prisma.section.create({ data: body });
    return NextResponse.json(section, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to create section", detail: error.message?.slice(0, 200) },
      { status: 500 }
    );
  }
}
