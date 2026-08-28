import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied, actorLabel } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import { logAudit } from "@/lib/audit";

const include = { role: true, roles: true } as const;

function roleNames(user: { role: { name: string } | null; roles: { name: string }[] }): string {
  const names = [...new Set([user.role?.name, ...user.roles.map((r) => r.name)].filter((n): n is string => !!n))];
  return names.length ? names.join(", ") : "EMS Member (default)";
}

export async function GET() {
  const auth = await requireAuth("roles.manage");
  if (isDenied(auth)) return auth.error;

  try {
    const users = await prisma.adminUser.findMany({ include });
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
    const { discordId, discordName, roleIds } = body;
    const ids: string[] = Array.isArray(roleIds) ? roleIds : [];

    const user = await prisma.adminUser.create({
      data: {
        discordId,
        discordName,
        roles: { connect: ids.map((id) => ({ id })) },
      },
      include,
    });

    await logAudit({
      action: "create",
      entityType: "AdminUser",
      entityId: user.id,
      entityLabel: user.discordName,
      details: { roles: roleNames(user) },
      performedBy: actorLabel(auth.access),
    });

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    return apiError("Failed to create user", error);
  }
}

/**
 * Full replace on roleIds/extraPermissions — the caller sends the complete
 * desired set each time (the UI always does), not a delta.
 */
export async function PATCH(request: Request) {
  const auth = await requireAuth("roles.manage");
  if (isDenied(auth)) return auth.error;

  try {
    const body = await request.json();
    const { id, roleIds, extraPermissions, ...data } = body;

    const before = await prisma.adminUser.findUnique({ where: { id }, include });
    if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const user = await prisma.adminUser.update({
      where: { id },
      data: {
        ...data,
        ...(Array.isArray(roleIds) ? { roles: { set: roleIds.map((rid: string) => ({ id: rid })) } } : {}),
        ...(Array.isArray(extraPermissions) ? { extraPermissions } : {}),
      },
      include,
    });

    const beforeRoles = roleNames(before);
    const afterRoles = roleNames(user);
    const beforeExtra = [...before.extraPermissions].sort().join(",");
    const afterExtra = [...user.extraPermissions].sort().join(",");

    if (beforeRoles !== afterRoles || beforeExtra !== afterExtra) {
      await logAudit({
        action: "update",
        entityType: "AdminUser",
        entityId: user.id,
        entityLabel: user.discordName,
        details: {
          roles: beforeRoles !== afterRoles ? `${beforeRoles} -> ${afterRoles}` : null,
          extraPermissions: beforeExtra !== afterExtra ? `${beforeExtra || "none"} -> ${afterExtra || "none"}` : null,
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
