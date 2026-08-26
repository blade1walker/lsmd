import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";

export async function GET() {
  const auth = await requireAuth("roles.manage");
  if (isDenied(auth)) return auth.error;

  try {
    const roles = await prisma.adminRole.findMany({
      orderBy: { name: "asc" },
    });

    return NextResponse.json(roles);
  } catch (error) {
    return apiError("Failed to fetch roles", error);
  }
}

export async function POST(request: Request) {
  const auth = await requireAuth("roles.manage");
  if (isDenied(auth)) return auth.error;

  try {
    const body = await request.json();
    const { name, permissions } = body;

    const role = await prisma.adminRole.create({
      data: {
        name,
        permissions,
      },
    });

    return NextResponse.json(role, { status: 201 });
  } catch (error) {
    return apiError("Failed to create role", error);
  }
}

export async function PATCH(request: Request) {
  const auth = await requireAuth("roles.manage");
  if (isDenied(auth)) return auth.error;

  try {
    const body = await request.json();
    const { id, ...data } = body;

    const role = await prisma.adminRole.update({
      where: { id },
      data,
    });

    return NextResponse.json(role);
  } catch (error) {
    return apiError("Failed to update role", error);
  }
}

export async function DELETE(request: Request) {
  const auth = await requireAuth("roles.manage");
  if (isDenied(auth)) return auth.error;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID required" }, { status: 400 });
    }

    await prisma.adminRole.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError("Failed to delete role", error);
  }
}
