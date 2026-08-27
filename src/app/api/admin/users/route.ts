import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied, actorLabel } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import { logAudit } from "@/lib/audit";

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
      include: { role: true },
    });

    await logAudit({
      action: "create",
      entityType: "AdminUser",
      entityId: user.id,
      entityLabel: user.discordName,
      details: { role: user.role?.name ?? null },
      performedBy: actorLabel(auth.access),
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

    const before = await prisma.adminUser.findUnique({ where: { id }, include: { role: true } });
    const user = await prisma.adminUser.update({
      where: { id },
      data,
      include: { role: true },
    });

    if (before?.roleId !== user.roleId) {
      await logAudit({
        action: "update",
        entityType: "AdminUser",
        entityId: user.id,
        entityLabel: user.discordName,
        details: {
          role: `${before?.role?.name ?? "EMS Member (default)"} -> ${user.role?.name ?? "EMS Member (default)"}`,
        },
        performedBy: actorLabel(auth.access),
      });
    }

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

    const user = await prisma.adminUser.delete({ where: { id } });

    await logAudit({
      action: "delete",
      entityType: "AdminUser",
      entityId: user.id,
      entityLabel: user.discordName,
      performedBy: actorLabel(auth.access),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError("Failed to delete user", error);
  }
}
