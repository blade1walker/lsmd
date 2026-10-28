import "dotenv/config";
import { createPrismaClient } from "../src/lib/prisma";
import { RADIO_CODES } from "../src/lib/radio-codes";

/**
 * Replaces the RadioCode table with the list in src/lib/radio-codes.ts.
 *
 * This is a full replace, not a merge: codes not in that list are removed, so
 * anything added through /admin/radio-codes and not reflected there will go.
 * The removals are printed before they happen. Re-running is safe and is how
 * edits to the list get applied.
 */

const prisma = createPrismaClient();

const label = (c: { code: string; description: string }) => `${c.code} — ${c.description}`;

async function main() {
  const existing = await prisma.radioCode.findMany({ orderBy: { order: "asc" } });

  const incoming = new Set(RADIO_CODES.map((c) => `${c.code}|${c.description}`));
  const dropped = existing.filter((c) => !incoming.has(`${c.code}|${c.description}`));

  if (dropped.length > 0) {
    console.log(`Removing ${dropped.length} code(s) not in the new list:`);
    for (const c of dropped) console.log(`  - ${label(c)}`);
    console.log("");
  }

  await prisma.$transaction([
    prisma.radioCode.deleteMany({}),
    prisma.radioCode.createMany({
      data: RADIO_CODES.map((c, i) => ({
        code: c.code,
        description: c.description,
        section: c.section,
        order: i,
        highlighted: c.highlighted ?? false,
      })),
    }),
  ]);

  console.log(`Wrote ${RADIO_CODES.length} radio codes:`);
  for (const [i, c] of RADIO_CODES.entries()) {
    console.log(`  ${String(i).padStart(2)}  ${label(c)}${c.highlighted ? "   [highlighted]" : ""}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
