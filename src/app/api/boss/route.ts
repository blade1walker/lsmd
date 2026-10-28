import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied, hasPermission } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import { CONTENT_PERMISSIONS } from "@/lib/constants";
import { getEditorState, toNoticeView } from "@/lib/site-content-server";
import { mediaUrl } from "@/lib/media-storage";

/** Everything the Boss Menu edits: content fields, notices and the media library. */
export async function GET() {
  const auth = await requireAuth(CONTENT_PERMISSIONS.edit);
  if (isDenied(auth)) return auth.error;

  try {
    const [fields, notices, media] = await Promise.all([
      getEditorState(),
      prisma.siteNotice.findMany({ orderBy: [{ order: "asc" }, { createdAt: "desc" }] }),
      prisma.mediaAsset.findMany({ orderBy: { createdAt: "desc" } }),
    ]);
    return NextResponse.json({
      fields,
      notices: notices.map(toNoticeView),
      media: media.map((m) => ({
        id: m.id,
        url: mediaUrl(m.fileName),
        originalName: m.originalName,
        alt: m.alt,
        size: m.size,
        mimeType: m.mimeType,
        uploadedBy: m.uploadedBy,
        createdAt: m.createdAt.toISOString(),
      })),
      canPublish: CONTENT_PERMISSIONS.publish.some((p) => hasPermission(auth.access, p)),
    });
  } catch (error) {
    return apiError("Failed to load the Boss Menu", error);
  }
}
