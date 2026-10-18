import "dotenv/config";
import pg from "pg";

/**
 * Copies every row from one database to another — for moving the site to a
 * new database host.
 *
 *   FROM_DATABASE_URL=<old> TO_DATABASE_URL=<new> npm run db:copy -- [--wipe | --merge]
 *
 * The new database needs the schema first (`prisma db push` against it — a
 * deploy with the new DATABASE_URL does that). Only tables and columns both
 * databases have are copied; ids are kept, so every link between rows still
 * points the right way.
 *
 * By default it refuses to write into a database that already has rows.
 *   --wipe   empties the new database first, then copies: it ends up an exact
 *            copy of the old one, and anything made on the new one is lost.
 *   --merge  keeps what the new database has and adds the old rows beside it;
 *            an old row whose id (or another unique field) is already taken
 *            is skipped.
 *
 * Never writes to the old database.
 */

const FROM = process.env.FROM_DATABASE_URL;
const TO = process.env.TO_DATABASE_URL;
const wipe = process.argv.includes("--wipe");
const merge = process.argv.includes("--merge");

if (!FROM || !TO) {
  console.error("Set FROM_DATABASE_URL (the old database) and TO_DATABASE_URL (the new one), then re-run.");
  process.exit(1);
}
if (FROM === TO) {
  console.error("FROM_DATABASE_URL and TO_DATABASE_URL are the same database.");
  process.exit(1);
}
if (wipe && merge) {
  console.error("Pick one of --wipe or --merge.");
  process.exit(1);
}

const q = (name: string) => `"${name.replace(/"/g, '""')}"`;

interface Column {
  name: string;
  json: boolean;
}

async function tables(db: pg.Client): Promise<string[]> {
  const { rows } = await db.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name NOT LIKE '\\_prisma%'`
  );
  return rows.map((r) => r.table_name);
}

async function columns(db: pg.Client, table: string): Promise<Column[]> {
  const { rows } = await db.query<{ column_name: string; data_type: string }>(
    `SELECT column_name, data_type FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`,
    [table]
  );
  return rows.map((r) => ({ name: r.column_name, json: r.data_type === "json" || r.data_type === "jsonb" }));
}

/** Parents before children, so most rows go in on the first try. */
async function inDependencyOrder(db: pg.Client, names: string[]): Promise<string[]> {
  const { rows } = await db.query<{ child: string; parent: string }>(
    `SELECT c.conrelid::regclass::text AS child, c.confrelid::regclass::text AS parent
     FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace
     WHERE c.contype = 'f' AND n.nspname = 'public'`
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
    if (seen.has(n) || path.has(n)) return; // a cycle is resolved by the retry passes
    path.add(n);
    for (const p of parents.get(n) ?? []) if (parents.has(p)) visit(p, path);
    path.delete(n);
    seen.add(n);
    order.push(n);
  };
  for (const n of [...names].sort()) visit(n, new Set());
  return order;
}

type Row = Record<string, unknown>;

async function insert(db: pg.Client, table: string, cols: Column[], rows: Row[]): Promise<number> {
  const values: unknown[] = [];
  const tuples = rows.map((row) => {
    const slots = cols.map((c) => {
      const v = row[c.name];
      // pg sends JS arrays as Postgres arrays; a json column needs the JSON text.
      values.push(c.json && v !== null && v !== undefined ? JSON.stringify(v) : v);
      return `$${values.length}`;
    });
    return `(${slots.join(", ")})`;
  });
  const res = await db.query(
    `INSERT INTO ${q(table)} (${cols.map((c) => q(c.name)).join(", ")}) VALUES ${tuples.join(", ")} ON CONFLICT DO NOTHING`,
    values
  );
  return res.rowCount ?? 0;
}

/**
 * Inserts what it can. A batch that hits a missing parent row (a link to a
 * row in a table not copied yet, or to its own table) is retried row by row;
 * rows that still fail are returned for a later pass.
 */
async function copyRows(db: pg.Client, table: string, cols: Column[], rows: Row[]) {
  const batch = Math.max(1, Math.floor(30_000 / Math.max(cols.length, 1)));
  let inserted = 0;
  const failed: Row[] = [];
  let lastError = "";
  for (let i = 0; i < rows.length; i += batch) {
    const chunk = rows.slice(i, i + batch);
    await db.query("SAVEPOINT chunk");
    try {
      inserted += await insert(db, table, cols, chunk);
      await db.query("RELEASE SAVEPOINT chunk");
    } catch {
      await db.query("ROLLBACK TO SAVEPOINT chunk");
      for (const row of chunk) {
        await db.query("SAVEPOINT one");
        try {
          inserted += await insert(db, table, cols, [row]);
          await db.query("RELEASE SAVEPOINT one");
        } catch (err) {
          await db.query("ROLLBACK TO SAVEPOINT one");
          lastError = err instanceof Error ? err.message : String(err);
          failed.push(row);
        }
      }
    }
  }
  return { inserted, failed, lastError };
}

async function main() {
  const from = new pg.Client({ connectionString: FROM });
  const to = new pg.Client({ connectionString: TO });
  await from.connect();
  await to.connect();

  const source = await tables(from);
  const target = new Set(await tables(to));
  if (target.size === 0) {
    throw new Error("The new database has no tables. Apply the schema to it first (prisma db push, or deploy with it as DATABASE_URL).");
  }
  const missing = source.filter((t) => !target.has(t));
  if (missing.length) console.warn(`Not in the new database, skipped: ${missing.join(", ")}`);
  const shared = await inDependencyOrder(from, source.filter((t) => target.has(t)));

  if (!wipe && !merge) {
    const filled: string[] = [];
    for (const t of shared) {
      const { rows } = await to.query(`SELECT 1 FROM ${q(t)} LIMIT 1`);
      if (rows.length) filled.push(t);
    }
    if (filled.length) {
      throw new Error(
        `The new database already has rows in: ${filled.join(", ")}.\n` +
          "Re-run with --wipe to replace them with the old database's, or --merge to keep them and add the old rows."
      );
    }
  }

  await to.query("BEGIN");
  try {
    if (wipe) {
      await to.query(`TRUNCATE ${[...target].map(q).join(", ")} RESTART IDENTITY CASCADE`);
      console.log("Emptied the new database.");
    }

    const pending = new Map<string, { cols: Column[]; rows: Row[]; error: string }>();
    let total = 0;
    for (const t of shared) {
      const targetCols = new Set((await columns(to, t)).map((c) => c.name));
      const cols = (await columns(from, t)).filter((c) => targetCols.has(c.name));
      const { rows } = await from.query<Row>(`SELECT ${cols.map((c) => q(c.name)).join(", ")} FROM ${q(t)}`);
      const { inserted, failed, lastError } = await copyRows(to, t, cols, rows);
      total += inserted;
      console.log(`${t}: ${inserted} of ${rows.length}${failed.length ? ` (${failed.length} waiting on linked rows)` : ""}`);
      if (failed.length) pending.set(t, { cols, rows: failed, error: lastError });
    }

    // Rows linked to rows copied later (or in their own table) go in now.
    for (let pass = 0; pending.size && pass < 10; pass++) {
      let progress = 0;
      for (const [t, p] of pending) {
        const { inserted, failed, lastError } = await copyRows(to, t, p.cols, p.rows);
        progress += inserted;
        total += inserted;
        if (failed.length) pending.set(t, { ...p, rows: failed, error: lastError });
        else pending.delete(t);
      }
      if (!progress) break;
    }
    for (const [t, p] of pending) console.warn(`${t}: ${p.rows.length} row(s) could not be copied — ${p.error}`);

    // Auto-numbered columns continue after the copied numbers.
    const { rows: serials } = await to.query<{ table_name: string; column_name: string }>(
      `SELECT table_name, column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND column_default LIKE 'nextval(%'`
    );
    for (const s of serials) {
      await to.query(
        `SELECT setval(pg_get_serial_sequence($1, $2), COALESCE((SELECT MAX(${q(s.column_name)}) FROM ${q(s.table_name)}), 0) + 1, false)`,
        [q(s.table_name), s.column_name]
      );
    }

    await to.query("COMMIT");
    console.log(`\nDone: ${total} row(s) copied into the new database.`);
  } catch (err) {
    await to.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    await from.end();
    await to.end();
  }
}

main().catch((err) => {
  console.error(`\nCopy failed — nothing was changed in the new database.\n${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
