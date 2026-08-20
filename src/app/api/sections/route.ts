import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const sections = await prisma.section.findMany({
      include: {
        members: {
          orderBy: { order: "asc" },
        },
      },
      orderBy: { order: "asc" },
    });

    return NextResponse.json(sections);
  } catch (error) {
    console.error("Error fetching sections:", error);
    return NextResponse.json({ error: "Failed to fetch sections" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, order } = body;

    const section = await prisma.section.create({
      data: {
        name,
        order: order ?? 0,
      },
    });

    return NextResponse.json(section, { status: 201 });
  } catch (error) {
    console.error("Error creating section:", error);
    return NextResponse.json({ error: "Failed to create section" }, { status: 500 });
  }
}
