import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Images uploaded through the Boss Menu, kept on the server's own disk.
 *
 * DATA_DIR (default ./data) is the folder for everything the site writes at
 * runtime. On the Oracle VM each release folder links ./data to
 * /opt/lsmd/data, so uploads survive deploys; with Docker it is a volume.
 *
 * Only PNG, JPEG, WebP and GIF are accepted, recognised by their first bytes
 * rather than by the name or type the browser claims — and never SVG, which
 * can carry script and would run on this site's own origin.
 */

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const TYPES = {
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
} as const;

export type ImageExt = keyof typeof TYPES;

function dataDir(): string {
  // Runtime data, not part of the build: kept out of Turbopack's file tracing.
  return path.resolve(/* turbopackIgnore: true */ process.env.DATA_DIR?.trim() || path.join(process.cwd(), "data"));
}

function uploadsDir(): string {
  return path.join(dataDir(), "uploads");
}

/** The image type from the file's first bytes, or null when it is not one we accept. */
export function sniffImage(bytes: Uint8Array): ImageExt | null {
  const at = (i: number) => bytes[i];
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
  if (bytes.length >= 8 && at(0) === 0x89 && ascii(1, 4) === "PNG" && at(4) === 0x0d && at(5) === 0x0a) return "png";
  if (bytes.length >= 3 && at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) return "jpg";
  if (bytes.length >= 6 && (ascii(0, 6) === "GIF87a" || ascii(0, 6) === "GIF89a")) return "gif";
  if (bytes.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "webp";
  return null;
}

/** Stored names are a content hash and an extension — nothing a request can use to leave the folder. */
const FILE_NAME = /^[a-f0-9]{24}\.(png|jpg|webp|gif)$/;

export function isStoredFileName(name: string): boolean {
  return FILE_NAME.test(name);
}

export type SavedImage = { fileName: string; ext: ImageExt; mimeType: string; size: number };

/**
 * Saves an image under a name taken from its content, so the same picture
 * uploaded twice is one file. Returns an error the person uploading can act on.
 */
export async function saveImage(bytes: Uint8Array): Promise<SavedImage | { error: string }> {
  if (bytes.length === 0) return { error: "The file is empty" };
  if (bytes.length > MAX_UPLOAD_BYTES) return { error: `Images can be at most ${MAX_UPLOAD_BYTES / 1024 / 1024} MB` };
  const ext = sniffImage(bytes);
  if (!ext) return { error: "Only PNG, JPEG, WebP and GIF images can be uploaded" };

  const fileName = `${createHash("sha256").update(bytes).digest("hex").slice(0, 24)}.${ext}`;
  await mkdir(uploadsDir(), { recursive: true });
  await writeFile(path.join(uploadsDir(), fileName), bytes);
  return { fileName, ext, mimeType: TYPES[ext], size: bytes.length };
}

export async function readImage(fileName: string): Promise<{ bytes: Buffer; mimeType: string } | null> {
  if (!isStoredFileName(fileName)) return null;
  try {
    const bytes = await readFile(path.join(uploadsDir(), fileName));
    const ext = fileName.split(".").pop() as ImageExt;
    return { bytes, mimeType: TYPES[ext] };
  } catch {
    return null;
  }
}

export async function deleteImage(fileName: string): Promise<void> {
  if (!isStoredFileName(fileName)) return;
  await rm(path.join(uploadsDir(), fileName), { force: true });
}

export function mediaUrl(fileName: string): string {
  return `/media/${fileName}`;
}
