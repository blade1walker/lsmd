import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const templates = await prisma.tempRankTemplate.findMany({
      orderBy: { order: "asc" },
    });

    return NextResponse.json(templates);
  } catch (error) {
    console.error("Error fetching temp rank templates:", error);
    return NextResponse.json({ error: "Failed to fetch templates" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, order } = body;

    const template = await prisma.tempRankTemplate.create({
      data: {
        name,
        order: order ?? 0,
      },
    });

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    console.error("Error creating temp rank template:", error);
    return NextResponse.json({ error: "Failed to create template" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, ...data } = body;

    const template = await prisma.tempRankTemplate.update({
      where: { id },
      data,
    });

    return NextResponse.json(template);
  } catch (error) {
    console.error("Error updating temp rank template:", error);
    return NextResponse.json({ error: "Failed to update template" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID required" }, { status: 400 });
    }

    await prisma.tempRankTemplate.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting temp rank template:", error);
    return NextResponse.json({ error: "Failed to delete template" }, { status: 500 });
  }
}
