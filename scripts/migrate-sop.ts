import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * One-time copy of the old single SopContent row into SopDocument, which
 * supports more than one SOP. Safe to re-run: it only acts when SopDocument
 * is empty, so it never overwrites documents created after the switch.
 */

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Add it to .env or export it, then re-run.");
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const docCount = await prisma.sopDocument.count();
  if (docCount > 0) {
    console.log(`SopDocument already has ${docCount} document(s). Nothing to migrate.`);
    return;
  }

  const legacy = await prisma.sopContent.findFirst();

  if (!legacy || !legacy.content.trim()) {
    console.log("No existing SOP content found. Nothing to migrate.");
    return;
  }

  const doc = await prisma.sopDocument.create({
    data: { title: "General SOP", content: legacy.content, order: 0 },
  });

  console.log(`Migrated legacy SOP content into SopDocument "${doc.title}" (${doc.id}).`);
  console.log("The old SopContent row is left untouched as a backup.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
