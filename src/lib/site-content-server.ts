import { cache } from "react";
import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { prisma } from "./prisma";
import { cached } from "./data-cache";
import { authOptions } from "./auth";
import { resolveAccess, hasPermission } from "./access";
import { CONTENT_PERMISSIONS } from "./constants";
import {
  CONTENT_FIELD_MAP,
  SITE_CONTENT,
  decodeValue,
  encodeValue,
  isNoticeTone,
  resolveContent,
  validateValue,
  type ContentFieldState,
  type ContentRow,
  type SiteContentState,
  type SiteNoticeView,
} from "./site-content";

/**
 * Server half of the Boss Menu: what the public site shows (published, or the
 * drafts in preview), and saving, publishing and discarding changes.
 *
 * Published content is cached in memory like the roster; every write goes
 * through Prisma, which drops the cache, so a publish shows on the next page
 * load with no restart or redeploy.
 */

export const PREVIEW_COOKIE = "lsmd_preview";

type NoticeRow = {
  id: string;
  title: string;
  body: string;
  tone: string;
  linkUrl: string | null;
  linkLabel: string | null;
  status: string;
  order: number;
  publishedAt: Date | null;
  updatedBy: string | null;
  updatedAt: Date;
};

export function toNoticeView(n: NoticeRow): SiteNoticeView {
  return {
    id: n.id,
    title: n.title,
    body: n.body,
    tone: isNoticeTone(n.tone) ? n.tone : "info",
    linkUrl: n.linkUrl,
    linkLabel: n.linkLabel,
    status: n.status === "Published" ? "Published" : "Draft",
    order: n.order,
    publishedAt: n.publishedAt?.toISOString() ?? null,
    updatedBy: n.updatedBy,
    updatedAt: n.updatedAt.toISOString(),
  };
}

async function readRows(): Promise<ContentRow[]> {
  return prisma.siteContent.findMany({ select: { key: true, draft: true, published: true } });
}

async function readNotices(includeDrafts: boolean): Promise<SiteNoticeView[]> {
  const rows = await prisma.siteNotice.findMany({
    where: includeDrafts ? {} : { status: "Published" },
    orderBy: [{ order: "asc" }, { createdAt: "desc" }],
  });
  return rows.map(toNoticeView);
}

/**
 * Whether the signed-in person may see drafts. Asked only when the preview
 * cookie is set (only /api/boss/preview sets it), so a stale cookie on anyone
 * else's browser shows the live site.
 */
async function canPreview(): Promise<boolean> {
  const session = await getServerSession(authOptions).catch(() => null);
  if (!session?.user?.discordId) return false;
  const access = await resolveAccess(session.user.discordId);
  return access.allowed && CONTENT_PERMISSIONS.edit.some((p) => hasPermission(access, p));
}

/**
 * The content every public page renders. Never throws: if the tables cannot
 * be read (a deploy whose schema push failed), the site shows its defaults.
 * Read once per request, however many components ask.
 */
export const getSiteContentState = cache(async (): Promise<SiteContentState> => {
  // Outside the try: reading the cookie is how a build learns these pages are
  // rendered per request, and catching that signal would bake in the defaults.
  const previewRequested = (await cookies()).get(PREVIEW_COOKIE)?.value === "1";
  try {
    if (previewRequested && (await canPreview())) {
      const [rows, notices] = await Promise.all([readRows(), readNotices(true)]);
      return { values: resolveContent(rows, "preview"), notices, preview: true };
    }
    return await cached("site-content:published", 5 * 60_000, async () => {
      const [rows, notices] = await Promise.all([readRows(), readNotices(false)]);
      return { values: resolveContent(rows, "published"), notices, preview: false };
    });
  } catch (error) {
    console.error("Site content could not be read; showing defaults:", error);
    return { values: resolveContent([], "published"), notices: [], preview: false };
  }
});

export async function getEditorState(): Promise<ContentFieldState[]> {
  const rows = await prisma.siteContent.findMany();
  const byKey = new Map(rows.map((r) => [r.key, r]));
  return SITE_CONTENT.map((field) => {
    const row = byKey.get(field.key);
    const published = decodeValue(field, row?.published) ?? field.default;
    const draft = decodeValue(field, row?.draft);
    const value = draft ?? published;
    return {
      key: field.key,
      published,
      value,
      pending: draft !== undefined && draft !== published,
      isDefault: value === field.default,
      updatedBy: row?.updatedBy ?? null,
      updatedAt: row?.updatedAt.toISOString() ?? null,
    };
  });
}

/**
 * Saves edits as drafts. A value equal to what is live clears that key's
 * draft rather than leaving an empty "change" waiting to be published.
 * Validates everything before writing anything.
 */
export async function saveDrafts(
  values: Record<string, unknown>,
  actor: string
): Promise<{ saved: string[] } | { error: string }> {
  const checked: { key: string; encoded: string; published: string }[] = [];
  const rows = await prisma.siteContent.findMany({ where: { key: { in: Object.keys(values) } } });
  const byKey = new Map(rows.map((r) => [r.key, r]));

  for (const [key, raw] of Object.entries(values)) {
    const field = CONTENT_FIELD_MAP.get(key);
    if (!field) return { error: `Unknown content: ${key}` };
    const result = validateValue(field, raw);
    if ("error" in result) return { error: result.error };
    const live = decodeValue(field, byKey.get(key)?.published) ?? field.default;
    checked.push({ key, encoded: encodeValue(result.value), published: encodeValue(live) });
  }

  await prisma.$transaction(
    checked.map(({ key, encoded, published }) =>
      prisma.siteContent.upsert({
        where: { key },
        create: { key, draft: encoded === published ? null : encoded, updatedBy: actor },
        update: { draft: encoded === published ? null : encoded, updatedBy: actor },
      })
    )
  );
  return { saved: checked.map((c) => c.key) };
}

/** Every key with a draft waiting, optionally limited to `keys`. */
async function pendingRows(keys?: string[]) {
  return prisma.siteContent.findMany({
    where: { draft: { not: null }, ...(keys?.length ? { key: { in: keys } } : {}) },
  });
}

/** Makes drafts live. Returns the keys published. */
export async function publishDrafts(actor: string, keys?: string[]): Promise<string[]> {
  const rows = await pendingRows(keys);
  const now = new Date();
  await prisma.$transaction(
    rows.map((row) =>
      prisma.siteContent.update({
        where: { key: row.key },
        data: { published: row.draft, draft: null, publishedBy: actor, publishedAt: now },
      })
    )
  );
  return rows.map((r) => r.key);
}

/** Throws drafts away, back to what is live. Returns the keys discarded. */
export async function discardDrafts(keys?: string[]): Promise<string[]> {
  const rows = await pendingRows(keys);
  await prisma.siteContent.updateMany({ where: { key: { in: rows.map((r) => r.key) } }, data: { draft: null } });
  return rows.map((r) => r.key);
}
