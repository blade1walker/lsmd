import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, isDenied, actorLabel } from "@/lib/auth/api";
import { apiError } from "@/lib/api-error";
import { logAudit } from "@/lib/audit";
import { CONTENT_PERMISSIONS } from "@/lib/constants";
import { deleteImage, mediaUrl } from "@/lib/media/storage";
import { findMediaUses } from "@/lib/media/server";

/**
 * Deletes an image. Refused while anything shows it — website content live
 * or in a draft, an SOP document, the medical letterhead — so a delete can
 * never leave a broken picture behind.
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(CONTENT_PERMISSIONS.publish);
  if (isDenied(auth)) return auth.error;

  try {
    const { id } = await params;
    const asset = await prisma.mediaAsset.findUnique({ where: { id } });
    if (!asset) return NextResponse.json({ error: "Image not found" }, { status: 404 });

    const uses = await findMediaUses(mediaUrl(asset.fileName));
    if (uses.length) {
      return NextResponse.json(
        { error: "This image is in use", detail: `Replace it in ${uses.join(", ")} first.` },
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
