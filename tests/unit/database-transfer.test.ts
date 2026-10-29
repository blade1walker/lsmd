import { test } from "node:test";
import assert from "node:assert/strict";
import { toPostgres, toSqlite } from "../../scripts/lib/postgres-transfer";
import { quoteJsonDefaults } from "../../scripts/db-migration.mjs";

const col = (type: string, notnull = 0) => ({ type, notnull });

test("Postgres values are stored the way Prisma's SQLite adapter writes them", () => {
  assert.equal(toSqlite(new Date("2026-10-28T14:00:00.123Z"), col("DATETIME")), "2026-10-28T14:00:00.123+00:00");
  assert.equal(toSqlite(true, col("BOOLEAN")), 1);
  assert.equal(toSqlite(false, col("BOOLEAN")), 0);
  assert.equal(toSqlite(["roster.view", "sop.view"], col("JSONB")), '["roster.view","sop.view"]');
  assert.equal(toSqlite({ a: 1 }, col("JSONB")), '{"a":1}');
  assert.equal(toSqlite("text", col("JSONB")), '"text"', "a JSON string stays a JSON string");
  assert.equal(toSqlite(null, col("JSONB", 1)), "null", "JSON null in a required column");
  assert.equal(toSqlite(null, col("TEXT")), null);
  assert.equal(toSqlite("42", col("INTEGER")), 42);
  assert.throws(() => toSqlite("not a date", col("DATETIME")));
});

test("SQLite values go back to Postgres in the column's own shape", () => {
  const json = { name: "x", kind: "json" as const };
  const array = { name: "x", kind: "array" as const };
  const other = { name: "x", kind: "other" as const };
  const date = toPostgres("2026-10-28T14:00:00.123+00:00", "DATETIME", other);
  assert.ok(date instanceof Date && date.toISOString() === "2026-10-28T14:00:00.123Z");
  assert.equal(toPostgres(1, "BOOLEAN", other), true);
  assert.equal(toPostgres(0, "BOOLEAN", other), false);
  assert.deepEqual(toPostgres('["a","b"]', "JSONB", array), ["a", "b"], "text[] columns take an array");
  assert.equal(toPostgres('{"a":1}', "JSONB", json), '{"a":1}', "json columns take JSON text");
  assert.equal(toPostgres(null, "TEXT", other), null);
});

test("Prisma's unquoted JSON defaults are quoted so SQLite accepts them", () => {
  const sql = [
    '    "permissions" JSONB NOT NULL DEFAULT [],',
    '    "details" JSONB NOT NULL DEFAULT {}',
    '    "settings" JSONB DEFAULT {"a":"it\'s"},',
    '    "name" TEXT NOT NULL DEFAULT \'x\',',
  ].join("\n");
  assert.equal(
    quoteJsonDefaults(sql),
    [
      "    \"permissions\" JSONB NOT NULL DEFAULT '[]',",
      "    \"details\" JSONB NOT NULL DEFAULT '{}'",
      "    \"settings\" JSONB DEFAULT '{\"a\":\"it''s\"}',",
      '    "name" TEXT NOT NULL DEFAULT \'x\',',
    ].join("\n")
  );
});
