import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import { DEPARTMENT_PERMISSIONS, RANK_LIST } from "@/lib/constants";

/** documentLink renders as a real <a href> on the roster page — reject anything that isn't a plain http(s) URL (e.g. javascript:). */
function validUrl(url: unknown, label: string): string | null | { error: string } {
  if (url === undefined || url === null || url === "") return null;
  if (typeof url !== "string" || !/^https?:\/\//i.test(url.trim())) {
    return { error: `${label} must be a valid http(s) URL` };
  }
  return url.trim();
}

/**
 * Everything an admin may write. Listed explicitly rather than spreading the
 * body, so a caller cannot set `id`, `createdAt`, or a relation by accident.
 */
function readWritableFields(
  body: Record<string, unknown>,
  { partial }: { partial: boolean }
): Record<string, unknown> | { error: string } {
  const data: Record<string, unknown> = {};

  if (body.name !== undefined || !partial) {
    const name = String(body.name ?? "").trim();
    if (!name) return { error: "Name is required" };
    data.name = name;
  }

  if (body.tag !== undefined) {
    const tag = String(body.tag ?? "").trim();
    data.tag = tag || null;
  }

  if (body.description !== undefined) {
    const description = String(body.description ?? "").trim();
    data.description = description || null;
  }

  if (body.color !== undefined) {
    const color = String(body.color ?? "").trim();
    if (color && !/^#[0-9a-f]{6}$/i.test(color)) {
      return { error: "Colour must be a hex value like #dc2626" };
    }
    data.color = color || "#dc2626";
  }

  if (body.documentLink !== undefined) {
    const link = validUrl(body.documentLink, "Document link");
    if (link && typeof link === "object") return link;
    data.documentLink = link;
  }

  if (body.webhookUrl !== undefined) {
    const hook = validUrl(body.webhookUrl, "Webhook URL");
    if (hook && typeof hook === "object") return hook;
    data.webhookUrl = hook;
  }

  if (body.openForApplications !== undefined) {
    data.openForApplications = Boolean(body.openForApplications);
  }

  if (body.minRank !== undefined) {
    const minRank = String(body.minRank ?? "").trim();
    if (minRank && !RANK_LIST.includes(minRank as (typeof RANK_LIST)[number])) {
      return { error: `"${minRank}" is not a rank on this roster` };
    }
    data.minRank = minRank || null;
  }

  if (body.discordRoleId !== undefined) {
    const roleId = String(body.discordRoleId ?? "").trim();
    if (roleId && !/^\d{5,25}$/.test(roleId)) {
      return { error: "Discord role ID must be numeric" };
    }
    data.discordRoleId = roleId || null;
  }

  if (body.order !== undefined) data.order = Number(body.order) || 0;

  return data;
}

/** Fields safe for a caller without the templates permission — no webhook URL, no role ID. */
const PUBLIC_FIELDS = {
  id: true,
  name: true,
  tag: true,
  color: true,
  description: true,
  documentLink: true,
  openForApplications: true,
  minRank: true,
  order: true,
} as const;

/**
 * Stays reachable to any signed-in admin page (the roster's department picker
 * needs the names), but the webhook URL and Discord role ID are only included
 * for a caller who may edit them.
 */
export async function GET() {
  try {
    const auth = await requireAuth(DEPARTMENT_PERMISSIONS.manage);
    const full = !isDenied(auth);

    const departments = full
      ? await prisma.departmentTemplate.findMany({
          orderBy: { order: "asc" },
          include: {
            questions: { orderBy: { order: "asc" } },
            _count: { select: { memberships: true, applications: true } },
          },
        })
      : await prisma.departmentTemplate.findMany({
          orderBy: { order: "asc" },
          select: PUBLIC_FIELDS,
        });

    return NextResponse.json(departments);
  } catch (error) {
    return apiError("Failed to fetch departments", error);
  }
}

export async function POST(request: Request) {
  const auth = await requireAuth(DEPARTMENT_PERMISSIONS.manage);
  if (isDenied(auth)) return auth.error;

  try {
    const body = await request.json();
    const data = readWritableFields(body, { partial: false });
    if ("error" in data) {
      return NextResponse.json({ error: data.error as string }, { status: 400 });
    }

    const existing = await prisma.departmentTemplate.findUnique({
      where: { name: data.name as string },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json({ error: "A department with that name already exists" }, { status: 409 });
    }

    const department = await prisma.departmentTemplate.create({
      data: { order: 0, ...data } as never,
      include: { questions: { orderBy: { order: "asc" } } },
    });

    return NextResponse.json(department, { status: 201 });
  } catch (error) {
    return apiError("Failed to create department", error);
  }
}

export async function PATCH(request: Request) {
  const auth = await requireAuth(DEPARTMENT_PERMISSIONS.manage);
  if (isDenied(auth)) return auth.error;

  try {
    const body = await request.json();
    const { id } = body as { id?: string };
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

    const data = readWritableFields(body as Record<string, unknown>, { partial: true });
    if ("error" in data) {
      return NextResponse.json({ error: data.error as string }, { status: 400 });
    }

    if (data.name) {
      const clash = await prisma.departmentTemplate.findUnique({
        where: { name: data.name as string },
        select: { id: true },
      });
      if (clash && clash.id !== id) {
        return NextResponse.json({ error: "A department with that name already exists" }, { status: 409 });
      }
    }

    const department = await prisma.departmentTemplate.update({
      where: { id },
      data: data as never,
      include: { questions: { orderBy: { order: "asc" } } },
    });

    return NextResponse.json(department);
  } catch (error) {
    return apiError("Failed to update department", error);
  }
}

export async function DELETE(request: Request) {
  const auth = await requireAuth(DEPARTMENT_PERMISSIONS.manage);
  if (isDenied(auth)) return auth.error;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID required" }, { status: 400 });
    }

    // Questions, applications and memberships cascade with the department —
    // roster members keep their Member.dept string, which is not a foreign key.
    await prisma.departmentTemplate.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError("Failed to delete department", error);
  }
}
