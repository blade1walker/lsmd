import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, isDenied, actorLabel, hasPermission } from "@/lib/auth/api";
import { apiError } from "@/lib/api-error";
import { logAudit } from "@/lib/audit";
import { CONTENT_PERMISSIONS } from "@/lib/constants";
import { parseNoticeInput } from "@/lib/site-content";
import { toNoticeView } from "@/lib/site-content/server";

/**
 * Edits a notice, moves it, or publishes / unpublishes it. Editing a
 * published notice changes it on the site straight away, so it needs the
 * publish permission too; drafts only need edit.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(CONTENT_PERMISSIONS.edit);
  if (isDenied(auth)) return auth.error;

  try {
    const { id } = await params;
    const current = await prisma.siteNotice.findUnique({ where: { id } });
    if (!current) return NextResponse.json({ error: "Notice not found" }, { status: 404 });

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: "Nothing was submitted" }, { status: 400 });
    const canPublish = CONTENT_PERMISSIONS.publish.some((p) => hasPermission(auth.access, p));
    const actor = actorLabel(auth.access);
    const data: Record<string, unknown> = { updatedBy: actor };

    if (body.status !== undefined) {
      if (body.status !== "Published" && body.status !== "Draft") {
        return NextResponse.json({ error: "Status must be Published or Draft" }, { status: 400 });
      }
      if (!canPublish) return NextResponse.json({ error: "Publishing needs the content.publish permission" }, { status: 403 });
      data.status = body.status;
      if (body.status === "Published" && current.status !== "Published") data.publishedAt = new Date();
    }
    if (["title", "body", "tone", "linkUrl", "linkLabel"].some((k) => body[k] !== undefined)) {
      if (current.status === "Published" && !canPublish) {
        return NextResponse.json({ error: "This notice is live — editing it needs the content.publish permission" }, { status: 403 });
      }
      const parsed = parseNoticeInput({ ...current, ...body });
      if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
      Object.assign(data, parsed.data);
    }
    if (typeof body.order === "number" && Number.isInteger(body.order)) data.order = body.order;

    const notice = await prisma.siteNotice.update({ where: { id }, data });
    await logAudit({
      action: data.status === "Published" ? "publish" : "update",
      entityType: "SiteNotice",
      entityId: notice.id,
      entityLabel: notice.title,
      details: { status: notice.status },
      performedBy: actor,
    });
    return NextResponse.json(toNoticeView(notice));
  } catch (error) {
    return apiError("Failed to update the notice", error);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(CONTENT_PERMISSIONS.publish);
  if (isDenied(auth)) return auth.error;

  try {
    const { id } = await params;
    const notice = await prisma.siteNotice.findUnique({ where: { id } });
    if (!notice) return NextResponse.json({ error: "Notice not found" }, { status: 404 });
    await prisma.siteNotice.delete({ where: { id } });
    await logAudit({
      action: "delete",
      entityType: "SiteNotice",
      entityId: id,
      entityLabel: notice.title,
      performedBy: actorLabel(auth.access),
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError("Failed to delete the notice", error);
  }
}
