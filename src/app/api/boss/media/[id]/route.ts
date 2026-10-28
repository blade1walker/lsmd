import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied, actorLabel } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import { logAudit } from "@/lib/audit";
import { CONTENT_PERMISSIONS } from "@/lib/constants";
import { deleteImage, mediaUrl } from "@/lib/media-storage";

/**
 * Deletes an image. Refused while the website uses it — live or in a draft —
 * so a delete can never leave a broken picture on the site.
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(CONTENT_PERMISSIONS.publish);
  if (isDenied(auth)) return auth.error;

  try {
    const { id } = await params;
    const asset = await prisma.mediaAsset.findUnique({ where: { id } });
    if (!asset) return NextResponse.json({ error: "Image not found" }, { status: 404 });

    const url = JSON.stringify(mediaUrl(asset.fileName));
    const inUse = await prisma.siteContent.findMany({
      where: { OR: [{ published: url }, { draft: url }] },
      select: { key: true },
    });
    if (inUse.length) {
      return NextResponse.json(
        { error: "This image is in use", detail: `Pick another image for ${inUse.map((r) => r.key).join(", ")} first.` },
        { status: 409 }
      );
    }

    await prisma.mediaAsset.delete({ where: { id } });
    await deleteImage(asset.fileName);
    await logAudit({
      action: "delete",
      entityType: "MediaAsset",
      entityId: id,
      entityLabel: asset.originalName,
      performedBy: actorLabel(auth.access),
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError("Failed to delete the image", error);
  }
}
