import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api-error";

export async function GET() {
  try {
    const categories = await prisma.categoryTemplate.findMany({
      orderBy: { order: "asc" },
    });

    return NextResponse.json(categories);
  } catch (error) {
    return apiError("Failed to fetch categories", error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, color, order } = body;

    const category = await prisma.categoryTemplate.create({
      data: {
        name,
        color: color ?? "#eab308",
        order: order ?? 0,
      },
    });

    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    return apiError("Failed to create category", error);
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, ...data } = body;

    const category = await prisma.categoryTemplate.update({
      where: { id },
      data,
    });

    return NextResponse.json(category);
  } catch (error) {
    return apiError("Failed to update category", error);
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID required" }, { status: 400 });
    }

    await prisma.categoryTemplate.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError("Failed to delete category", error);
  }
}
