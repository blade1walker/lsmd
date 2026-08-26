import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";

export async function GET() {
  const auth = await requireAuth("roles.manage");
  if (isDenied(auth)) return auth.error;

  try {
    const users = await prisma.adminUser.findMany({
      include: { role: true },
    });

    return NextResponse.json(users);
  } catch (error) {
    return apiError("Failed to fetch users", error);
  }
}

export async function POST(request: Request) {
  const auth = await requireAuth("roles.manage");
  if (isDenied(auth)) return auth.error;

  try {
    const body = await request.json();
    const { discordId, discordName, roleId } = body;

    const user = await prisma.adminUser.create({
      data: {
        discordId,
        discordName,
        roleId,
      },
    });

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    return apiError("Failed to create user", error);
  }
}

export async function PATCH(request: Request) {
  const auth = await requireAuth("roles.manage");
  if (isDenied(auth)) return auth.error;

  try {
    const body = await request.json();
    const { id, ...data } = body;

    const user = await prisma.adminUser.update({
      where: { id },
      data,
    });

    return NextResponse.json(user);
  } catch (error) {
    return apiError("Failed to update user", error);
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

    await prisma.adminUser.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError("Failed to delete user", error);
  }
}
