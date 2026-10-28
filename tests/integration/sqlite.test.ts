import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { createPrismaClient } from "@/lib/prisma";
import { applyMigrations, migrationNames } from "@/lib/migrations";
import type { PrismaClient } from "@/generated/prisma/client";

/**
 * The database layer against a real SQLite file built from the migrations:
 * connection settings, how values are stored, and that requests sharing the
 * one connection never see or undo each other's transactions.
 */

let dir: string;
let file: string;
let prisma: PrismaClient;

before(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "lsmd-sqlite-"));
  file = path.join(dir, "test.db");
  applyMigrations(file);
  prisma = createPrismaClient(file);
});

after(async () => {
  await prisma?.$disconnect();
  await rm(dir, { recursive: true, force: true });
});

const num = (v: unknown) => (typeof v === "bigint" ? Number(v) : v);

test("migrations apply once and are recorded", () => {
  assert.deepEqual(applyMigrations(file), [], "a second run has nothing left to do");
  const raw = new Database(file, { readonly: true });
  const names = (raw.prepare(`SELECT migration_name FROM "_prisma_migrations" ORDER BY migration_name`).all() as { migration_name: string }[]).map((r) => r.migration_name);
  raw.close();
  assert.deepEqual(names, migrationNames());
});

test("every connection runs in WAL mode with the agreed settings", async () => {
  const [row] = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    "SELECT * FROM pragma_journal_mode, pragma_synchronous, pragma_foreign_keys, pragma_busy_timeout"
  );
  assert.equal(row.journal_mode, "wal");
  assert.equal(num(row.synchronous), 1, "synchronous = NORMAL");
  assert.equal(num(row.foreign_keys), 1);
  assert.equal(num(row.timeout), 5000);
});

test("dates are stored in one sortable format, so date filters compare correctly", async () => {
  const section = await prisma.section.create({ data: { name: "Dates" } });
  const raw = new Database(file, { readonly: true });
  const stored = raw.prepare("SELECT createdAt, updatedAt FROM Section WHERE id = ?").get(section.id) as Record<string, string>;
  raw.close();
  const iso = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}\+00:00$/;
  assert.match(stored.createdAt, iso, "a now() default is filled by Prisma, not CURRENT_TIMESTAMP");
  assert.match(stored.updatedAt, iso);
  const recent = await prisma.section.findMany({ where: { createdAt: { gte: new Date(Date.now() - 60_000) } } });
  assert.ok(recent.some((s) => s.id === section.id));
  const future = await prisma.section.findMany({ where: { createdAt: { gt: new Date(Date.now() + 60_000) } } });
  assert.equal(future.length, 0);
});

test("lists stored as JSON come back as lists", async () => {
  const role = await prisma.adminRole.create({ data: { name: "JSON role", permissions: ["roster.view", "sop.view"], order: 900 } });
  const back = await prisma.adminRole.findUniqueOrThrow({ where: { id: role.id } });
  assert.deepEqual(back.permissions, ["roster.view", "sop.view"]);
  const defaulted = await prisma.adminRole.create({ data: { name: "Empty role", order: 901 } });
  assert.deepEqual(defaulted.permissions, []);
});

test("deleting a member deletes what hangs off it (foreign keys are enforced)", async () => {
  const member = await prisma.member.create({ data: { name: "Cascade Test", rank: "EMT" } });
  await prisma.trainingRecord.create({ data: { memberId: member.id } });
  await prisma.member.delete({ where: { id: member.id } });
  assert.equal(await prisma.trainingRecord.count({ where: { memberId: member.id } }), 0);
  await assert.rejects(prisma.trainingRecord.create({ data: { memberId: "no-such-member" } }));
});

test("text search ignores letter case", async () => {
  await prisma.member.create({ data: { name: "Casey Jones", rank: "EMT" } });
  const found = await prisma.member.findMany({ where: { name: { contains: "casey" } } });
  assert.equal(found.length, 1);
});

test("a query from another request never runs inside an open transaction", async () => {
  const section = await prisma.section.create({ data: { name: "Isolation" } });
  let seenInside: string | undefined;

  const failing = prisma
    .$transaction(async (tx) => {
      await tx.section.update({ where: { id: section.id }, data: { name: "Uncommitted" } });
      await new Promise((r) => setTimeout(r, 100));
      throw new Error("roll back");
    })
    .catch(() => "rolled back");

  // Issued while the transaction above is open and waiting.
  await new Promise((r) => setTimeout(r, 20));
  const other = (async () => {
    seenInside = (await prisma.section.findUniqueOrThrow({ where: { id: section.id } })).name;
    return prisma.section.create({ data: { name: "Written beside the transaction" } });
  })();

  assert.equal(await failing, "rolled back");
  const created = await other;
  assert.equal(seenInside, "Isolation", "another request never reads uncommitted rows");
  assert.equal((await prisma.section.findUniqueOrThrow({ where: { id: section.id } })).name, "Isolation");
  assert.ok(await prisma.section.findUnique({ where: { id: created.id } }), "its write survives the rollback");
});

test("concurrent read-modify-write transactions lose no updates", async () => {
  const member = await prisma.member.create({ data: { name: "Counter", rank: "EMT" } });
  const record = await prisma.trainingRecord.create({ data: { memberId: member.id } });
  await Promise.all(
    Array.from({ length: 40 }, (_, i) =>
      prisma.$transaction(async (tx) => {
        const current = await tx.trainingRecord.findUniqueOrThrow({ where: { id: record.id } });
        const progress = (current.emsProgress ?? {}) as { ticks?: number[] };
        await new Promise((r) => setTimeout(r, i % 3));
        await tx.trainingRecord.update({
          where: { id: record.id },
          data: { emsProgress: { ticks: [...(progress.ticks ?? []), i] } },
        });
      })
    )
  );
  const final = await prisma.trainingRecord.findUniqueOrThrow({ where: { id: record.id } });
  assert.equal(((final.emsProgress as { ticks: number[] }).ticks ?? []).length, 40);
});
