import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";

/**
 * What the public join page needs: every department, its blurb, and the
 * questions its form asks. Deliberately never includes webhookUrl or
 * discordRoleId — those are admin configuration, and this is an open endpoint.
 *
 * When the caller has a session, each department also carries whether they are
 * already in it or already have an application pending, so the form can say so
 * up front instead of failing on submit.
 */
export async function GET() {
  try {
    const departments = await prisma.departmentTemplate.findMany({
      orderBy: { order: "asc" },
      select: {
        id: true,
        name: true,
        tag: true,
        color: true,
        description: true,
        documentLink: true,
        openForApplications: true,
        minRank: true,
        order: true,
        questions: {
          orderBy: { order: "asc" },
          select: {
            id: true,
            label: true,
            type: true,
            options: true,
            placeholder: true,
            required: true,
            order: true,
          },
        },
      },
    });

    const auth = await requireAuth();
    if (isDenied(auth)) {
      return NextResponse.json(departments.map((d) => ({ ...d, joined: false, pending: false })));
    }

    const { memberId, discordId } = auth.access;

    const [memberships, pending] = await Promise.all([
      memberId
        ? prisma.departmentMembership.findMany({
            where: { memberId },
            select: { departmentId: true, role: true },
          })
        : Promise.resolve([]),
      prisma.departmentApplication.findMany({
        where: { discordId, status: "Pending" },
        select: { departmentId: true },
      }),
    ]);

    const joined = new Map(memberships.map((m) => [m.departmentId, m.role]));
    const pendingIds = new Set(pending.map((p) => p.departmentId));

    return NextResponse.json(
      departments.map((d) => ({
        ...d,
        joined: joined.has(d.id),
        joinedRole: joined.get(d.id) ?? null,
        pending: pendingIds.has(d.id),
      }))
    );
  } catch (error) {
    return apiError("Failed to fetch departments", error);
  }
}
