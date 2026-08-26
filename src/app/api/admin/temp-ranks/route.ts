import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";

export async function GET() {
  try {
    const templates = await prisma.tempRankTemplate.findMany({
      orderBy: { order: "asc" },
    });

    return NextResponse.json(templates);
  } catch (error) {
    return apiError("Failed to fetch templates", error);
  }
}

export async function POST(request: Request) {
  const auth = await requireAuth("templates");
  if (isDenied(auth)) return auth.error;

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
    return apiError("Failed to create template", error);
  }
}

export async function PATCH(request: Request) {
  const auth = await requireAuth("templates");
  if (isDenied(auth)) return auth.error;

  try {
    const body = await request.json();
    const { id, ...data } = body;

    const template = await prisma.tempRankTemplate.update({
      where: { id },
      data,
    });

    return NextResponse.json(template);
  } catch (error) {
    return apiError("Failed to update template", error);
  }
}

export async function DELETE(request: Request) {
  const auth = await requireAuth("templates");
  if (isDenied(auth)) return auth.error;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID required" }, { status: 400 });
    }

    await prisma.tempRankTemplate.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError("Failed to delete template", error);
  }
}
