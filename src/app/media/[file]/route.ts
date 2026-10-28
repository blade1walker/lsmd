import { NextRequest, NextResponse } from "next/server";
import { readImage } from "@/lib/media/storage";

/**
 * Serves an image from the media library. Names are content hashes, so a
 * file never changes and browsers may keep it for a year.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const image = await readImage(file);
  if (!image) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(new Uint8Array(image.bytes), {
    headers: {
      "Content-Type": image.mimeType,
      "Content-Length": String(image.bytes.length),
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
