import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied, actorLabel } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import { logAudit } from "@/lib/audit";
import { LEGACY_DOC_ID } from "@/lib/sop";

/** Prisma: the table does not exist in the current database. */
const TABLE_MISSING = "P2021";

/**
 * Every SOP document, for the switcher. Requires sop.view rather than being
 * public: the SOP tab is for EMS members and above, and sop.view is on the
 * default EMS Member role, so any roster member passes.
 *
 * Falls back to the legacy single-row SopContent when SopDocument has not been
 * created yet. Without this the page is simply broken on any database the
 * schema has not been pushed to, which is a worse outcome than serving the
 * previous single SOP read-only until it has.
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
    if ((error as { code?: string }).code !== TABLE_MISSING) {
      return apiError("Failed to fetch SOP documents", error);
    }

    console.warn(
      "SopDocument table is missing — serving legacy SopContent read-only. " +
        "Run `npm run db:push` to apply the schema, then `npm run db:migrate-sop`."
    );

    try {
      const legacy = await prisma.sopContent.findFirst();
      return NextResponse.json(
        legacy?.content
          ? [{ id: LEGACY_DOC_ID, title: "General SOP", content: legacy.content, order: 0 }]
          : []
      );
    } catch (legacyError) {
      return apiError("Failed to fetch SOP documents", legacyError);
    }
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
