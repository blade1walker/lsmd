import { prisma } from "../db/prisma";
import { logAudit } from "../audit";
import { MAX_UPLOAD_BYTES, mediaUrl, saveImage, type ImageExt } from "./storage";

/**
 * Every image upload on the site — the Boss Menu, SOP documents and the
 * medical letterhead — lands in the one media library on the server's disk,
 * so it is listed, backed up and protected from deletion in one place.
 */

export interface UploadRules {
  /** Image types this upload accepts; all four when left out. */
  types?: ImageExt[];
  maxBytes?: number;
}

export type StoredUpload = { id: string; url: string; originalName: string };

const TYPE_NAMES: Record<ImageExt, string> = { png: "PNG", jpg: "JPEG", webp: "WebP", gif: "GIF" };

/** The largest request body worth reading for these rules: the file plus the form's own overhead. */
export function maxRequestBytes(rules: UploadRules = {}): number {
  return (rules.maxBytes ?? MAX_UPLOAD_BYTES) + 64 * 1024;
}

/**
 * Checks and stores one uploaded file and records it in the library.
 * Returns an error the person uploading can act on, or the stored image.
 */
export async function storeUpload(
  file: unknown,
  actor: string,
  rules: UploadRules = {}
): Promise<StoredUpload | { error: string }> {
  if (!(file instanceof File)) return { error: "Choose an image to upload" };
  const maxBytes = Math.min(rules.maxBytes ?? MAX_UPLOAD_BYTES, MAX_UPLOAD_BYTES);
  if (file.size > maxBytes) return { error: `Images can be at most ${+(maxBytes / 1024 / 1024).toFixed(1)} MB` };

  const saved = await saveImage(new Uint8Array(await file.arrayBuffer()));
  if ("error" in saved) return saved;
  if (rules.types && !rules.types.includes(saved.ext)) {
    return { error: `Use ${rules.types.map((t) => TYPE_NAMES[t]).join(", ")} here` };
  }

  const asset = await prisma.mediaAsset.upsert({
    where: { fileName: saved.fileName },
    create: {
      fileName: saved.fileName,
      originalName: file.name.slice(0, 200) || saved.fileName,
      mimeType: saved.mimeType,
      size: saved.size,
      uploadedBy: actor,
    },
    update: {},
  });
  await logAudit({
    action: "create",
    entityType: "MediaAsset",
    entityId: asset.id,
    entityLabel: asset.originalName,
    details: { size: asset.size },
    performedBy: actor,
  });
  return { id: asset.id, url: mediaUrl(asset.fileName), originalName: asset.originalName };
}

/** Where the site uses an image: website content, SOP documents, the medical letterhead. Empty when unused. */
export async function findMediaUses(url: string): Promise<string[]> {
  const stored = JSON.stringify(url);
  const [content, sops, medical] = await Promise.all([
    prisma.siteContent.findMany({ where: { OR: [{ published: stored }, { draft: stored }] }, select: { key: true } }),
    prisma.sopDocument.findMany({ where: { content: { contains: url } }, select: { title: true } }),
    prisma.medicalSettings.findFirst({
      where: { OR: [{ logoUrl: url }, { secondaryLogoUrl: url }] },
      select: { id: true },
    }),
  ]);
  return [
    ...content.map((c) => `website: ${c.key}`),
    ...sops.map((s) => `SOP: ${s.title}`),
    ...(medical ? ["the medical letterhead"] : []),
  ];
}
