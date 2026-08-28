import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";

/** documentLink renders as a real <a href> on the roster page — reject anything that isn't a plain http(s) URL (e.g. javascript:). */
function validDocumentLink(url: unknown): string | null | { error: string } {
  if (url === undefined || url === null || url === "") return null;
  if (typeof url !== "string" || !/^https?:\/\//i.test(url.trim())) {
    return { error: "Document link must be a valid http(s) URL" };
  }
  return url.trim();
}

export async function GET() {
  try {
    const departments = await prisma.departmentTemplate.findMany({
      orderBy: { order: "asc" },
    });

    return NextResponse.json(departments);
  } catch (error) {
    return apiError("Failed to fetch departments", error);
  }
}

export async function POST(request: Request) {
  const auth = await requireAuth("templates");
  if (isDenied(auth)) return auth.error;

  try {
    const body = await request.json();
    const { name, documentLink, order } = body;

    if (!name || !String(name).trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const link = validDocumentLink(documentLink);
    if (link && typeof link === "object") {
      return NextResponse.json({ error: link.error }, { status: 400 });
    }

    const department = await prisma.departmentTemplate.create({
      data: {
        name: String(name).trim(),
        documentLink: link,
        order: order ?? 0,
      },
    });

    return NextResponse.json(department, { status: 201 });
  } catch (error) {
    return apiError("Failed to create department", error);
  }
}

export async function PATCH(request: Request) {
  const auth = await requireAuth("templates");
  if (isDenied(auth)) return auth.error;

  try {
    const body = await request.json();
    const { id, ...data } = body;

    if (data.name !== undefined && !String(data.name).trim()) {
      return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
    }
    if (data.name !== undefined) data.name = String(data.name).trim();

    if (data.documentLink !== undefined) {
      const link = validDocumentLink(data.documentLink);
      if (link && typeof link === "object") {
        return NextResponse.json({ error: link.error }, { status: 400 });
      }
      data.documentLink = link;
    }

    const department = await prisma.departmentTemplate.update({
      where: { id },
      data,
    });

    return NextResponse.json(department);
  } catch (error) {
    return apiError("Failed to update department", error);
  }
}

export async function DELETE(request: Request) {
  const auth = await requireAuth("templates");
  if (isDenied(auth)) return auth.error;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID required" }, { status: 400 });
    }

    await prisma.departmentTemplate.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError("Failed to delete department", error);
  }
}
