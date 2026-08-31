import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied, actorLabel } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import { logAudit } from "@/lib/audit";
import { DEPARTMENT_PERMISSIONS } from "@/lib/constants";
import { DEPARTMENT_ROLES, isDepartmentRole } from "@/lib/departments";
import { addDepartmentDiscordRole, removeDepartmentDiscordRole } from "@/lib/discord-roles";

/**
 * Who is in which department, and at what standing. This is what the roster's
 * tick columns read from — a member can sit in several departments at once, so
 * it is a table of its own rather than a field on Member.
 */

/** Readable list for an error message, e.g. `"High Command", "Command", …`. */
const ROLE_LIST = DEPARTMENT_ROLES.map((r) => `"${r}"`).join(", ");

export async function GET(req: NextRequest) {
  const auth = await requireAuth(DEPARTMENT_PERMISSIONS.view);
  if (isDenied(auth)) return auth.error;

  try {
    const departmentId = req.nextUrl.searchParams.get("departmentId");

    const memberships = await prisma.departmentMembership.findMany({
      where: departmentId ? { departmentId } : undefined,
      include: {
        member: { select: { id: true, name: true, callSign: true, rank: true, activity: true } },
        department: { select: { id: true, name: true, tag: true, color: true } },
      },
    });

    return NextResponse.json(memberships);
  } catch (error) {
    return apiError("Failed to fetch department memberships", error);
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(DEPARTMENT_PERMISSIONS.members);
  if (isDenied(auth)) return auth.error;

  try {
    const body = (await req.json()) as { departmentId?: string; memberId?: string; role?: string };
    const departmentId = String(body.departmentId ?? "");
    const memberId = String(body.memberId ?? "");
    const role = body.role ?? "Member";

    if (!departmentId || !memberId) {
      return NextResponse.json({ error: "departmentId and memberId are required" }, { status: 400 });
    }
    if (!isDepartmentRole(role)) {
      return NextResponse.json({ error: `Standing must be one of ${ROLE_LIST}` }, { status: 400 });
    }

    const [department, member] = await Promise.all([
      prisma.departmentTemplate.findUnique({ where: { id: departmentId } }),
      prisma.member.findUnique({ where: { id: memberId }, select: { id: true, name: true, discordId: true } }),
    ]);
    if (!department) return NextResponse.json({ error: "Department not found" }, { status: 404 });
    if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });

    const membership = await prisma.departmentMembership.upsert({
      where: { departmentId_memberId: { departmentId, memberId } },
      create: { departmentId, memberId, role },
      update: { role },
      include: {
        member: { select: { id: true, name: true, callSign: true, rank: true, activity: true } },
      },
    });

    if (member.discordId) {
      await addDepartmentDiscordRole(member.discordId, department.discordRoleId);
    }

    await logAudit({
      action: "update",
      entityType: "DepartmentMembership",
      entityId: membership.id,
      entityLabel: `${member.name} → ${department.name}`,
      details: { role },
      performedBy: actorLabel(auth.access),
    });

    return NextResponse.json(membership, { status: 201 });
  } catch (error) {
    return apiError("Failed to add department member", error);
  }
}

/** Changes standing only — moving someone between departments is a remove plus an add. */
export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(DEPARTMENT_PERMISSIONS.members);
  if (isDenied(auth)) return auth.error;

  try {
    const body = (await req.json()) as { id?: string; role?: string };
    const id = String(body.id ?? "");
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
    if (!isDepartmentRole(body.role)) {
      return NextResponse.json({ error: `Standing must be one of ${ROLE_LIST}` }, { status: 400 });
    }

    const membership = await prisma.departmentMembership.update({
      where: { id },
      data: { role: body.role },
      include: {
        member: { select: { id: true, name: true, callSign: true, rank: true, activity: true } },
        department: { select: { name: true } },
      },
    });

    await logAudit({
      action: "update",
      entityType: "DepartmentMembership",
      entityId: membership.id,
      entityLabel: `${membership.member.name} → ${membership.department.name}`,
      details: { role: body.role },
      performedBy: actorLabel(auth.access),
    });

    return NextResponse.json(membership);
  } catch (error) {
    return apiError("Failed to update department member", error);
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(DEPARTMENT_PERMISSIONS.members);
  if (isDenied(auth)) return auth.error;

  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

    const membership = await prisma.departmentMembership.findUnique({
      where: { id },
      include: {
        member: { select: { name: true, discordId: true } },
        department: { select: { name: true, discordRoleId: true } },
      },
    });
    if (!membership) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.departmentMembership.delete({ where: { id } });

    if (membership.member.discordId) {
      await removeDepartmentDiscordRole(membership.member.discordId, membership.department.discordRoleId);
    }

    await logAudit({
      action: "delete",
      entityType: "DepartmentMembership",
      entityId: id,
      entityLabel: `${membership.member.name} → ${membership.department.name}`,
      performedBy: actorLabel(auth.access),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError("Failed to remove department member", error);
  }
}
