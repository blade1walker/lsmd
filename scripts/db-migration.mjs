import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

/**
 * Writes a new migration for the changes made to prisma/schema.prisma:
 *
 *   npm run db:migrate             # bring the local database up to date first
 *   npm run db:migration -- add_widget_table
 *
 * It compares the local database with the schema and saves the SQL as
 * prisma/migrations/<timestamp>_<name>/migration.sql. Review it, then
 * `npm run db:migrate` applies it locally; deploys apply it on the server.
 *
 * Prisma writes Json defaults for SQLite unquoted (DEFAULT {}), which SQLite
 * rejects, so they are quoted here. Use this rather than `prisma migrate dev`.
 */

/** DEFAULT [] / DEFAULT {} → DEFAULT '[]' / DEFAULT '{}' on JSON columns. */
export function quoteJsonDefaults(sql) {
  return sql.replace(/(JSONB(?: NOT NULL)? DEFAULT )(\[[^\n]*?\]|\{[^\n]*?\})(,?)$/gm, (_m, head, value, comma) => {
    return `${head}'${value.replace(/'/g, "''")}'${comma}`;
  });
}

if (process.argv[1] && import.meta.url === `file://${path.resolve(process.argv[1])}`) {
  const name = (process.argv[2] ?? "").trim().replace(/[^a-z0-9_]+/gi, "_");
  if (!name) {
    console.error("Name the migration: npm run db:migration -- add_widget_table");
    process.exit(1);
  }
  const sql = execFileSync(
    "npx",
    ["prisma", "migrate", "diff", "--from-config-datasource", "--to-schema", "prisma/schema.prisma", "--script"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] }
  );
  if (!sql.replace(/--.*$/gm, "").trim()) {
    console.log("The database already matches the schema — nothing to write.");
    process.exit(0);
  }
  const stamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
  const dir = path.join("prisma", "migrations", `${stamp}_${name}`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "migration.sql"), quoteJsonDefaults(sql));
  console.log(`Wrote ${dir}/migration.sql — review it, then run npm run db:migrate.`);
}
