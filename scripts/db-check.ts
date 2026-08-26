import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Read-only comparison of prisma/schema.prisma against what the database
 * actually has. Nothing in this project applies schema automatically — there
 * are no migrations, only `prisma db push` — so a model can exist in the
 * schema and typecheck fine while every query against it fails at runtime.
 */

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Add it to .env or export it, then re-run.");
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

function modelsInSchema(): string[] {
  const schema = readFileSync(join(process.cwd(), "prisma", "schema.prisma"), "utf8");
  return [...schema.matchAll(/^model\s+(\w+)\s*\{/gm)].map((m) => m[1]);
}

async function main() {
  const expected = modelsInSchema();

  const rows = await prisma.$queryRaw<{ table_name: string }[]>`
    SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'
  `;
  const present = new Set(rows.map((r) => r.table_name));

  const missing = expected.filter((m) => !present.has(m));

  console.log(`Schema defines ${expected.length} models; database has ${present.size} tables.\n`);

  for (const model of expected) {
    console.log(`  ${present.has(model) ? "ok     " : "MISSING"}  ${model}`);
  }

  if (missing.length === 0) {
    console.log("\nAll tables present.");
    return;
  }

  console.log(`\n${missing.length} table(s) missing: ${missing.join(", ")}`);
  console.log("Run `npm run db:push` against this database to create them.");
  process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
