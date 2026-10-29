import { NextResponse } from "next/server";
import { createReadStream } from "node:fs";
import { rm, stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { requireAuth, isDenied, actorLabel } from "@/lib/auth/api";
import { apiError } from "@/lib/api-error";
import { logAudit } from "@/lib/audit";
import { copyDatabase } from "@/lib/db/backup";
import { EXPORT_PERMISSIONS } from "@/lib/constants";
import { backupsDir } from "@/lib/paths";

export const dynamic = "force-dynamic";

/**
 * A complete backup of the site's database to download: a consistent copy of
 * the SQLite file, taken while the site runs and integrity-checked, which
 * `npm run db:restore -- <file>` can put back.
 *
 * Guarded by export.data, the "take the whole database out of the building"
 * permission, and refused to the Discord bot: a backup is a file a person
 * downloads.
 */
export async function GET() {
  const auth = await requireAuth(EXPORT_PERMISSIONS.data);
  if (isDenied(auth)) return auth.error;
  if (auth.access.roleName === "Nexus EMS Bot") {
    return NextResponse.json({ error: "Forbidden", detail: "Backups are downloaded on the site, not through the bot." }, { status: 403 });
  }

  const name = `lsmd-database-${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}Z.db`;
  const file = path.join(backupsDir(), `download-${process.pid}-${Date.now()}.db`);
  try {
    await copyDatabase(file);
  } catch (error) {
    await rm(file, { force: true });
    return apiError("Could not copy the database", error);
  }

  const { size } = await stat(file);
  await logAudit({
    action: "export",
    entityType: "Export",
    entityId: "database",
    entityLabel: "Full database backup",
    details: { bytes: size },
    performedBy: actorLabel(auth.access),
  });

  const stream = createReadStream(file);
  // The copy is only for this download.
  stream.on("close", () => void rm(file, { force: true }));
  return new Response(Readable.toWeb(stream) as ReadableStream<Uint8Array>, {
    headers: {
      "Content-Type": "application/vnd.sqlite3",
      "Content-Length": String(size),
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
