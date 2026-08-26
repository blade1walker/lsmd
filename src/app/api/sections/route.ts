import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";

export async function GET() {
  try {
    const sections = await prisma.section.findMany({
      include: { members: { orderBy: { order: "asc" } } },
      orderBy: { order: "asc" },
    });
    return NextResponse.json(sections);
  } catch (error) {
      return apiError("Database connection failed", error);
  }
}

export async function POST(req: Request) {
  const auth = await requireAuth("roster.edit");
  if (isDenied(auth)) return auth.error;

  try {
    const body = await req.json();
    const section = await prisma.section.create({ data: body });
    return NextResponse.json(section, { status: 201 });
  } catch (error) {
      return apiError("Failed to create section", error);
  }
}
