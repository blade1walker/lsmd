import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied, actorLabel } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import { logAudit } from "@/lib/audit";
import { CONTENT_PERMISSIONS } from "@/lib/constants";
import { parseNoticeInput } from "@/lib/site-content";
import { toNoticeView } from "@/lib/site-content-server";

/** Creates a notice as a draft — it shows in preview until someone publishes it. */
export async function POST(req: NextRequest) {
  const auth = await requireAuth(CONTENT_PERMISSIONS.edit);
  if (isDenied(auth)) return auth.error;

  try {
    const parsed = parseNoticeInput(await req.json().catch(() => null));
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const actor = actorLabel(auth.access);
    const last = await prisma.siteNotice.aggregate({ _max: { order: true } });
    const notice = await prisma.siteNotice.create({
      data: { ...parsed.data, order: (last._max.order ?? -1) + 1, createdBy: actor, updatedBy: actor },
    });
    await logAudit({
      action: "create",
      entityType: "SiteNotice",
      entityId: notice.id,
      entityLabel: notice.title,
      performedBy: actor,
    });
    return NextResponse.json(toNoticeView(notice), { status: 201 });
  } catch (error) {
    return apiError("Failed to create the notice", error);
  }
}
