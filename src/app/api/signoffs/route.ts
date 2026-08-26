import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied } from "@/lib/api-auth";

export async function GET() {
  try {
    const definitions = await prisma.signOffDefinition.findMany({
      include: {
        records: true,
      },
      orderBy: { order: "asc" },
    });

    return NextResponse.json(definitions);
  } catch (error) {
    console.error("Error fetching signoffs:", error);
    return NextResponse.json({ error: "Failed to fetch signoffs" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAuth("training.signoff.manage");
  if (isDenied(auth)) return auth.error;

  try {
    const body = await request.json();
    const { name, order, createdBy } = body;

    const definition = await prisma.signOffDefinition.create({
      data: {
        name,
        order: order ?? 0,
        createdBy,
      },
    });

    return NextResponse.json(definition, { status: 201 });
  } catch (error) {
    console.error("Error creating signoff:", error);
    return NextResponse.json({ error: "Failed to create signoff" }, { status: 500 });
  }
}
