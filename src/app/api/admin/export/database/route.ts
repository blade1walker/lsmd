import { NextRequest, NextResponse } from "next/server";
import pg from "pg";
import { requireAuth, isDenied, actorLabel } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import { logAudit } from "@/lib/audit";
import { EXPORT_PERMISSIONS } from "@/lib/constants";
import { databaseUrl, oldDatabaseUrl, quietSslMode } from "@/lib/database-url";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * A raw backup: every table, every row, exactly as stored, as one JSON file.
 * `?source=old` reads the database the site moved away from (see
 * database-url.ts) — its address lives only in the deployment's environment,
 * so this is the one way to take a copy of it. `?source=current` reads the
 * live one. `?check=1` says whether an old database is configured, for the
 * Export page.
 *
 * Guarded by export.data, the "take the whole database out of the building"
 * permission, and refused to the Discord bot: a backup is a file a person
 * downloads. Streamed table by table, so a large database is not held to the
 * size limit of a single serverless response.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(EXPORT_PERMISSIONS.data);
  if (isDenied(auth)) return auth.error;
  if (auth.access.roleName === "Nexus EMS Bot") {
    return NextResponse.json({ error: "Forbidden", detail: "Backups are downloaded on the site, not through the bot." }, { status: 403 });
  }

  const params = req.nextUrl.searchParams;
  if (params.get("check") === "1") {
    return NextResponse.json({ old: !!oldDatabaseUrl() });
  }

  const source = params.get("source") === "current" ? "current" : "old";
  const url = source === "old" ? oldDatabaseUrl() : databaseUrl();
  if (!url) {
    return NextResponse.json({ error: "There is no old database configured — the site has not moved databases." }, { status: 404 });
  }

  const client = new pg.Client({ connectionString: quietSslMode(url) });
  let tables: string[];
  try {
    await client.connect();
    const { rows } = await client.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name NOT LIKE '\\_prisma%'
       ORDER BY table_name`
    );
    tables = rows.map((r) => r.table_name);
  } catch (error) {
    await client.end().catch(() => {});
    return apiError(`Could not read the ${source} database`, error);
  }

  await logAudit({
    action: "export",
    entityType: "Export",
    entityId: `database-${source}`,
    entityLabel: `Full backup of the ${source} database`,
    details: { tables: tables.length },
    performedBy: actorLabel(auth.access),
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        controller.enqueue(
          encoder.encode(`{"source":${JSON.stringify(source)},"exportedAt":${JSON.stringify(new Date().toISOString())},"tables":{`)
        );
        for (const [i, table] of tables.entries()) {
          const { rows } = await client.query(`SELECT * FROM "${table.replace(/"/g, '""')}"`);
          controller.enqueue(encoder.encode(`${i ? "," : ""}${JSON.stringify(table)}:${JSON.stringify(rows)}`));
        }
        controller.enqueue(encoder.encode("}}"));
        controller.close();
      } catch (error) {
        console.error(`Backup of the ${source} database failed part-way:`, error);
        controller.error(error);
      } finally {
        await client.end().catch(() => {});
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="lsmd-${source}-database-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
