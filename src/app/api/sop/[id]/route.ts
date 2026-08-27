import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied, actorLabel } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import { logAudit } from "@/lib/audit";
import { LEGACY_DOC_ID } from "@/lib/sop";

/** The legacy fallback document is synthetic, so writes to it cannot succeed. */
const legacyReadOnly = () =>
  NextResponse.json(
    {
      error: "This SOP is read-only",
      detail:
        "The SopDocument table does not exist yet, so the previous SOP is being shown read-only. " +
        "Run `npm run db:push`, then `npm run db:migrate-sop`, to enable editing.",
    },
    { status: 409 }
  );

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth("sop.edit");
  if (isDenied(auth)) return auth.error;

  try {
    const { id } = await params;
    if (id === LEGACY_DOC_ID) return legacyReadOnly();

    const { title, content, order } = await req.json();

    if (title !== undefined && !String(title).trim()) {
      return NextResponse.json({ error: "Title cannot be empty" }, { status: 400 });
    }

    const changed = Object.entries({ title, content, order })
      .filter(([, v]) => v !== undefined)
      .map(([k]) => k);

    const doc = await prisma.sopDocument.update({
      where: { id },
      data: {
        ...(title !== undefined && { title: String(title).trim() }),
        ...(content !== undefined && { content }),
        ...(order !== undefined && { order }),
      },
    });

    await logAudit({
      action: "update",
      entityType: "SopDocument",
      entityId: doc.id,
      entityLabel: doc.title,
      details: { fields: changed.join(", ") },
      performedBy: actorLabel(auth.access),
    });

    return NextResponse.json(doc);
  } catch (error) {
    return apiError("Failed to update SOP document", error);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth("sop.edit");
  if (isDenied(auth)) return auth.error;

  try {
    const { id } = await params;
    if (id === LEGACY_DOC_ID) return legacyReadOnly();

    const doc = await prisma.sopDocument.delete({ where: { id } });

    await logAudit({
      action: "delete",
      entityType: "SopDocument",
      entityId: doc.id,
      entityLabel: doc.title,
      performedBy: actorLabel(auth.access),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError("Failed to delete SOP document", error);
  }
}
