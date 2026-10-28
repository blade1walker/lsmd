import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, isDenied } from "@/lib/auth/api";

/** Sign-off definitions with every FTO's completion records and notes — training staff only. */
export async function GET() {
  const auth = await requireAuth(["training.signoff.manage", "training.view"]);
  if (isDenied(auth)) return auth.error;

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
