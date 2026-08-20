import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const codes = await prisma.radioCode.findMany({
      orderBy: { order: "asc" },
    });

    return NextResponse.json(codes);
  } catch (error) {
    console.error("Error fetching radio codes:", error);
    return NextResponse.json({ error: "Failed to fetch codes" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { code, description, section, order, highlighted } = body;

    const radioCode = await prisma.radioCode.create({
      data: {
        code,
        description,
        section,
        order: order ?? 0,
        highlighted: highlighted ?? false,
      },
    });

    return NextResponse.json(radioCode, { status: 201 });
  } catch (error) {
    console.error("Error creating radio code:", error);
    return NextResponse.json({ error: "Failed to create code" }, { status: 500 });
  }
}
