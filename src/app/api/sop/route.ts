import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied, actorLabel } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import { logAudit } from "@/lib/audit";

/**
 * Every SOP document, for the switcher. Requires sop.view rather than being
 * public: the SOP tab is for EMS members and above, and sop.view is on the
 * default EMS Member role, so any roster member passes.
 */
export async function GET() {
  const auth = await requireAuth("sop.view");
  if (isDenied(auth)) return auth.error;

  try {
    const docs = await prisma.sopDocument.findMany({
      orderBy: { order: "asc" },
    });
    return NextResponse.json(docs);
  } catch (error) {
    return apiError("Failed to fetch SOP documents", error);
  }
}

export async function POST(req: Request) {
  const auth = await requireAuth("sop.edit");
  if (isDenied(auth)) return auth.error;

  try {
    const { title, content } = await req.json();
    if (!title || !String(title).trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const maxOrder = await prisma.sopDocument.aggregate({ _max: { order: true } });

    const doc = await prisma.sopDocument.create({
      data: {
        title: String(title).trim(),
        content: content ?? "",
        order: (maxOrder._max.order ?? -1) + 1,
      },
    });

    await logAudit({
      action: "create",
      entityType: "SopDocument",
      entityId: doc.id,
      entityLabel: doc.title,
      performedBy: actorLabel(auth.access),
    });

    return NextResponse.json(doc, { status: 201 });
  } catch (error) {
    return apiError("Failed to create SOP document", error);
  }
}
