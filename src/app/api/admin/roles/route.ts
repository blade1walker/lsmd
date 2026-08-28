import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied, actorLabel } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import { logAudit } from "@/lib/audit";

export async function GET() {
  const auth = await requireAuth("roles.manage");
  if (isDenied(auth)) return auth.error;

  try {
    const roles = await prisma.adminRole.findMany({
      orderBy: { order: "asc" },
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

    await logAudit({
      action: "create",
      entityType: "AdminRole",
      entityId: role.id,
      entityLabel: role.name,
      details: { permissionCount: role.permissions.length },
      performedBy: actorLabel(auth.access),
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

    const before = await prisma.adminRole.findUnique({ where: { id } });
    const role = await prisma.adminRole.update({
      where: { id },
      data,
    });

    const added = role.permissions.filter((p) => !before?.permissions.includes(p));
    const removed = (before?.permissions ?? []).filter((p) => !role.permissions.includes(p));

    await logAudit({
      action: "update",
      entityType: "AdminRole",
      entityId: role.id,
      entityLabel: role.name,
      details: {
        renamed: before && before.name !== role.name ? `${before.name} -> ${role.name}` : null,
        permissionsAdded: added.length ? added.join(", ") : null,
        permissionsRemoved: removed.length ? removed.join(", ") : null,
      },
      performedBy: actorLabel(auth.access),
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

    const role = await prisma.adminRole.delete({ where: { id } });

    await logAudit({
      action: "delete",
      entityType: "AdminRole",
      entityId: role.id,
      entityLabel: role.name,
      performedBy: actorLabel(auth.access),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError("Failed to delete role", error);
  }
}
