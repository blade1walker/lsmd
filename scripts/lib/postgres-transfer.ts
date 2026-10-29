import { createHash, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { rename, rm, writeFile } from "node:fs/promises";
import Database from "better-sqlite3";
import pg from "pg";
import { applyMigrations } from "../../src/lib/db/migrations";
import { checkIntegrity } from "../../src/lib/db/backup";
import { createPrismaClient } from "../../src/lib/db/prisma";

/**
 * Moving the data between the old Postgres database (Neon) and SQLite, in
 * either direction. Never writes to the side it reads from.
 *
 * Import (Postgres → SQLite) builds the new database in a temporary file,
 * checks it — every row counted and its ids compared, every link resolved,
 * every value read back through Prisma, SQLite's integrity check — and only
 * then moves it into place. A failed import leaves nothing behind.
 *
 * Export (SQLite → Postgres) is the way back after the move: it copies the
 * SQLite data into a Postgres database that already has the old schema (the
 * old Neon database does), so a rolled-back release finds everything that
 * was written since.
 */

// Prisma stores DateTime in Postgres as `timestamp` without a time zone,
// holding UTC. Read it as UTC whatever time zone this machine is in.
pg.types.setTypeParser(1114, (v: string) => new Date(`${v.replace(" ", "T")}Z`));
// 64-bit integers arrive as text; nothing here is large enough to need that.
pg.types.setTypeParser(20, (v: string) => Number(v));

type Log = (line: string) => void;

const q = (name: string) => `"${name.replace(/"/g, '""')}"`;

/** Neon's addresses say sslmode=require, which pg treats as verify-full with a warning; say it outright. */
function quietSslMode(url: string): string {
  try {
    const parsed = new URL(url);
    const mode = parsed.searchParams.get("sslmode");
    if (mode && ["prefer", "require", "verify-ca"].includes(mode) && !parsed.searchParams.has("uselibpqcompat")) {
      parsed.searchParams.set("sslmode", "verify-full");
      return parsed.toString();
    }
  } catch {
    // Not a URL the parser understands — leave it to the driver.
  }
  return url;
}

/**
 * The Postgres database this server used before the move, from its settings:
 * the NEON_* variables Vercel's Neon connection added, or DATABASE_URL.
 * Direct (unpooled) addresses first — the copy is one long read.
 */
export function postgresSourceUrl(): string | undefined {
  const first = (names: string[]) => names.map((n) => process.env[n]?.trim()).find(Boolean);
  const url =
    first(["NEON_URL_UNPOOLED", "NEON_DATABASE_URL_UNPOOLED", "NEON_POSTGRES_URL_NON_POOLING"]) ??
    first(["NEON_URL", "NEON_DATABASE_URL", "NEON_POSTGRES_PRISMA_URL", "NEON_POSTGRES_URL"]) ??
    first(["DIRECT_URL", "DATABASE_URL_UNPOOLED", "POSTGRES_URL_NON_POOLING", "DATABASE_URL"]);
  return url && /^postgres(ql)?:\/\//i.test(url) ? quietSslMode(url) : undefined;
}

export function describeUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname}${u.pathname}`;
  } catch {
    return "the Postgres database";
  }
}

async function connect(url: string): Promise<pg.Client> {
  const client = new pg.Client({ connectionString: quietSslMode(url), connectionTimeoutMillis: 20_000 });
  await client.connect();
  return client;
}

async function postgresTables(db: pg.Client): Promise<string[]> {
  const { rows } = await db.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = current_schema() AND table_type = 'BASE TABLE' AND table_name NOT LIKE '\\_prisma%'`
  );
  return rows.map((r) => r.table_name);
}

interface PgColumn {
  name: string;
  /** json/jsonb, or an array (text[]): sent as JSON text / a JS array. */
  kind: "json" | "array" | "other";
}

async function postgresColumns(db: pg.Client, table: string): Promise<PgColumn[]> {
  const { rows } = await db.query<{ column_name: string; data_type: string }>(
    `SELECT column_name, data_type FROM information_schema.columns
     WHERE table_schema = current_schema() AND table_name = $1 ORDER BY ordinal_position`,
    [table]
  );
  return rows.map((r) => ({
    name: r.column_name,
    kind: r.data_type === "json" || r.data_type === "jsonb" ? "json" : r.data_type === "ARRAY" ? "array" : "other",
  }));
}

interface SqliteColumn {
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
}

function sqliteTables(db: Database.Database): string[] {
  return (
    db
      .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite\\_%' ESCAPE '\\' AND name <> '_prisma_migrations'`)
      .all() as { name: string }[]
  ).map((r) => r.name);
}

function sqliteColumns(db: Database.Database, table: string): SqliteColumn[] {
  return db.prepare(`PRAGMA table_info(${q(table)})`).all() as SqliteColumn[];
}

/** A Postgres value as the SQLite column stores it — the same encoding Prisma's SQLite adapter writes. */
export function toSqlite(value: unknown, column: { type: string; notnull: number }): unknown {
  const type = column.type.toUpperCase();
  if (value === null || value === undefined) return type === "JSONB" && column.notnull ? "null" : null;
  switch (type) {
    case "DATETIME": {
      const date = value instanceof Date ? value : new Date(String(value));
      if (Number.isNaN(date.getTime())) throw new Error(`not a date: ${String(value)}`);
      return date.toISOString().replace("Z", "+00:00");
    }
    case "BOOLEAN":
      return value ? 1 : 0;
    case "JSONB":
      return JSON.stringify(value);
    case "INTEGER":
    case "REAL":
      return typeof value === "boolean" ? (value ? 1 : 0) : Number(value);
    default:
      if (typeof value === "string") return value;
      if (value instanceof Date) return value.toISOString();
      return typeof value === "object" ? JSON.stringify(value) : String(value);
  }
}

/** A SQLite value as Postgres takes it. */
export function toPostgres(value: unknown, sqliteType: string, target: PgColumn): unknown {
  if (value === null || value === undefined) return null;
  const type = sqliteType.toUpperCase();
  if (type === "DATETIME") return new Date(String(value));
  if (type === "BOOLEAN") return Number(value) === 1 || value === true;
  if (type === "JSONB") {
    const parsed = JSON.parse(String(value));
    // json columns take JSON text; text[] columns take a JS array.
    return target.kind === "array" ? parsed : JSON.stringify(parsed);
  }
  if (typeof value === "bigint") return Number(value);
  return value;
}

const digest = (ids: unknown[]) =>
  createHash("sha256")
    .update(ids.map(String).sort().join("\n"))
    .digest("hex");

export interface TableCount {
  table: string;
  rows: number;
}

/** Prisma's name for a model's client property: the table name with its first letter lower-cased. */
const delegateName = (table: string) => table.charAt(0).toLowerCase() + table.slice(1);

/**
 * Reads every row back through Prisma, model by model, so a value stored in
 * a shape Prisma cannot read fails here rather than on a page later.
 */
async function readBackThroughPrisma(file: string, tables: string[]): Promise<void> {
  const prisma = createPrismaClient(file);
  try {
    for (const table of tables) {
      const delegate = (prisma as unknown as Record<string, { findMany?: () => Promise<unknown[]> }>)[delegateName(table)];
      if (typeof delegate?.findMany !== "function") continue; // join tables have no model
      await delegate.findMany();
    }
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Copies the Postgres database at `sourceUrl` into a new SQLite database at
 * `target`. Refuses if `target` exists. Returns the rows copied per table.
 */
export async function importFromPostgres(sourceUrl: string, target: string, log: Log = console.log): Promise<TableCount[]> {
  if (existsSync(target)) throw new Error(`${target} already exists — the import never overwrites a database.`);
  const work = `${target}.importing`;
  const removeWork = () => Promise.all([work, `${work}-wal`, `${work}-shm`].map((f) => rm(f, { force: true })));
  await removeWork();

  const source = await connect(sourceUrl);
  let counts: TableCount[] = [];
  try {
    applyMigrations(work);
    const db = new Database(work);
    try {
      // Rows arrive table by table; every link is checked once, at the end.
      db.pragma("foreign_keys = OFF");
      const fromTables = new Set(await postgresTables(source));
      const toTables = sqliteTables(db);
      const notCopied = [...fromTables].filter((t) => !toTables.includes(t));
      if (notCopied.length) log(`Not in the new schema, so not copied: ${notCopied.join(", ")}`);

      // Read everything first, then write it in one transaction.
      const loaded: { table: string; columns: SqliteColumn[]; rows: unknown[][]; ids: string }[] = [];
      for (const table of toTables) {
        if (!fromTables.has(table)) {
          log(`${table}: new in this release, starts empty`);
          continue;
        }
        const available = new Set((await postgresColumns(source, table)).map((c) => c.name));
        const all = sqliteColumns(db, table);
        const unfillable = all.filter((c) => !available.has(c.name) && c.notnull && c.dflt_value === null && !c.pk);
        if (unfillable.length) throw new Error(`${table}: the old database has no ${unfillable.map((c) => c.name).join(", ")}`);
        const columns = all.filter((c) => available.has(c.name));
        const { rows } = await source.query<unknown[]>({
          text: `SELECT ${columns.map((c) => q(c.name)).join(", ")} FROM ${q(table)}`,
          rowMode: "array",
        });
        const idAt = columns.findIndex((c) => c.name === "id");
        loaded.push({ table, columns, rows, ids: idAt >= 0 ? digest(rows.map((r) => r[idAt])) : "" });
      }

      db.transaction(() => {
        for (const { table, columns, rows } of loaded) {
          const insert = db.prepare(
            `INSERT INTO ${q(table)} (${columns.map((c) => q(c.name)).join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`
          );
          for (const row of rows) {
            try {
              insert.run(row.map((v, i) => toSqlite(v, columns[i])));
            } catch (error) {
              throw new Error(`${table}: ${error instanceof Error ? error.message : error}`);
            }
          }
        }
        carryLegacySop(db);
      })();

      // Verify: every row arrived, with the same ids, and every link resolves.
      for (const { table, columns, rows, ids } of loaded) {
        const { n } = db.prepare(`SELECT COUNT(*) AS n FROM ${q(table)}`).get() as { n: number };
        if (n !== rows.length && !(table === "SopDocument" && rows.length === 0)) {
          throw new Error(`${table}: ${rows.length} row(s) read but ${n} stored`);
        }
        if (ids && columns.some((c) => c.name === "id") && rows.length) {
          const stored = (db.prepare(`SELECT id FROM ${q(table)}`).pluck().all() as unknown[]);
          if (digest(stored) !== ids) throw new Error(`${table}: the stored ids differ from the old database's`);
        }
      }
      const broken = db.prepare("PRAGMA foreign_key_check").all() as { table: string }[];
      if (broken.length) throw new Error(`${broken.length} row(s) link to rows that do not exist, first in ${broken[0].table}`);
      counts = loaded.map(({ table }) => ({
        table,
        rows: (db.prepare(`SELECT COUNT(*) AS n FROM ${q(table)}`).get() as { n: number }).n,
      }));
    } finally {
      db.close();
    }

    const problem = checkIntegrity(work);
    if (problem) throw new Error(`integrity check: ${problem}`);
    await readBackThroughPrisma(work, counts.map((c) => c.table));
    await rename(work, target);
    await removeWork();
    return counts;
  } catch (error) {
    await removeWork();
    throw error;
  } finally {
    await source.end().catch(() => {});
  }
}

/**
 * The SOP used to be one row in SopContent. If the old database still only
 * had that (its move to SopDocument never ran), it becomes a document here,
 * as the old fallback used to show it.
 */
function carryLegacySop(db: Database.Database): void {
  const { n } = db.prepare(`SELECT COUNT(*) AS n FROM "SopDocument"`).get() as { n: number };
  if (n > 0) return;
  const legacy = db.prepare(`SELECT content, createdAt, updatedAt FROM "SopContent" WHERE content <> '' LIMIT 1`).get() as
    | { content: string; createdAt: string; updatedAt: string }
    | undefined;
  if (!legacy) return;
  db.prepare(
    `INSERT INTO "SopDocument" (id, title, content, "order", relatedLinks, createdAt, updatedAt) VALUES (?, 'General SOP', ?, 0, '[]', ?, ?)`
  ).run(randomUUID(), legacy.content, legacy.createdAt, legacy.updatedAt);
}

/** Parents before children, so most rows go in on the first try. */
async function inDependencyOrder(db: pg.Client, names: string[]): Promise<string[]> {
  const { rows } = await db.query<{ child: string; parent: string }>(
    `SELECT c.conrelid::regclass::text AS child, c.confrelid::regclass::text AS parent
     FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace
     WHERE c.contype = 'f' AND n.nspname = current_schema()`
  );
  const unquote = (s: string) => s.replace(/^"|"$/g, "").replace(/""/g, '"');
  const parents = new Map(names.map((n) => [n, new Set<string>()]));
  for (const r of rows) {
    const child = unquote(r.child);
    const parent = unquote(r.parent);
    if (child !== parent) parents.get(child)?.add(parent);
  }
  const order: string[] = [];
  const seen = new Set<string>();
  const visit = (n: string, path: Set<string>) => {
    if (seen.has(n) || path.has(n)) return; // a cycle is settled by the retry passes
    path.add(n);
    for (const p of parents.get(n) ?? []) if (parents.has(p)) visit(p, path);
    path.delete(n);
    seen.add(n);
    order.push(n);
  };
  for (const n of [...names].sort()) visit(n, new Set());
  return order;
}

/**
 * Copies the SQLite database at `file` into the Postgres database at
 * `targetUrl`, which must already have the schema (the old database does).
 * Its existing rows are replaced: it ends up an exact copy. Returns the rows
 * copied per table.
 */
export async function exportToPostgres(file: string, targetUrl: string, log: Log = console.log): Promise<TableCount[]> {
  const db = new Database(file, { readonly: true, fileMustExist: true });
  const target = await connect(targetUrl);
  try {
    const toTables = new Set(await postgresTables(target));
    if (toTables.size === 0) throw new Error("The Postgres database has no tables — it needs the old schema first.");
    const fromTables = sqliteTables(db).filter((t) => toTables.has(t));
    const order = await inDependencyOrder(target, fromTables);

    await target.query("BEGIN");
    try {
      await target.query(`TRUNCATE ${[...toTables].map(q).join(", ")} CASCADE`);
      const pending: { table: string; columns: string[]; rows: unknown[][] }[] = [];
      for (const table of order) {
        const targetColumns = new Map((await postgresColumns(target, table)).map((c) => [c.name, c]));
        const columns = sqliteColumns(db, table).filter((c) => targetColumns.has(c.name));
        const raw = db.prepare(`SELECT ${columns.map((c) => q(c.name)).join(", ")} FROM ${q(table)}`).raw().all() as unknown[][];
        const rows = raw.map((r) => r.map((v, i) => toPostgres(v, columns[i].type, targetColumns.get(columns[i].name)!)));
        pending.push({ table, columns: columns.map((c) => c.name), rows });
      }

      // A row whose parent comes later (or is in its own table) waits for a later pass.
      for (let pass = 0; pending.some((p) => p.rows.length) && pass < 10; pass++) {
        let progress = 0;
        for (const p of pending) {
          const failed: unknown[][] = [];
          for (const row of p.rows) {
            await target.query("SAVEPOINT r");
            try {
              await target.query(
                `INSERT INTO ${q(p.table)} (${p.columns.map(q).join(", ")}) VALUES (${p.columns.map((_, i) => `$${i + 1}`).join(", ")})`,
                row
              );
              await target.query("RELEASE SAVEPOINT r");
              progress++;
            } catch {
              await target.query("ROLLBACK TO SAVEPOINT r");
              failed.push(row);
            }
          }
          p.rows = failed;
        }
        if (!progress) break;
      }
      const stuck = pending.filter((p) => p.rows.length);
      if (stuck.length) throw new Error(`Could not copy: ${stuck.map((p) => `${p.table} (${p.rows.length})`).join(", ")}`);

      // Auto-numbered columns continue after the copied numbers.
      const { rows: serials } = await target.query<{ table_name: string; column_name: string }>(
        `SELECT table_name, column_name FROM information_schema.columns
         WHERE table_schema = current_schema() AND column_default LIKE 'nextval(%'`
      );
      for (const s of serials) {
        await target.query(
          `SELECT setval(pg_get_serial_sequence($1, $2), COALESCE((SELECT MAX(${q(s.column_name)}) FROM ${q(s.table_name)}), 0) + 1, false)`,
          [q(s.table_name), s.column_name]
        );
      }

      const counts: TableCount[] = [];
      for (const table of order) {
        const { rows } = await target.query<{ n: number }>(`SELECT COUNT(*)::int AS n FROM ${q(table)}`);
        const expected = (db.prepare(`SELECT COUNT(*) AS n FROM ${q(table)}`).get() as { n: number }).n;
        if (rows[0].n !== expected) throw new Error(`${table}: ${expected} row(s) in SQLite but ${rows[0].n} copied`);
        counts.push({ table, rows: expected });
      }
      await target.query("COMMIT");
      log(`Copied ${counts.reduce((s, c) => s + c.rows, 0)} row(s) into ${describeUrl(targetUrl)}.`);
      return counts;
    } catch (error) {
      await target.query("ROLLBACK").catch(() => {});
      throw error;
    }
  } finally {
    db.close();
    await target.end().catch(() => {});
  }
}

/** Written next to the database once this server's data lives in SQLite. */
export async function writeMovedMarker(markerFile: string, details: Record<string, unknown>): Promise<void> {
  await writeFile(markerFile, `${JSON.stringify({ movedAt: new Date().toISOString(), ...details }, null, 2)}\n`);
}
