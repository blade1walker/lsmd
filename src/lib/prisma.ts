import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { databaseUrl } from "./database-url";
import { bumpDataGeneration } from "./data-cache";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

/** Operations that change data, so cached reads (src/lib/data-cache.ts) must be dropped. */
const WRITES = new Set([
  "create",
  "createMany",
  "createManyAndReturn",
  "update",
  "updateMany",
  "updateManyAndReturn",
  "upsert",
  "delete",
  "deleteMany",
  "executeRaw",
  "executeRawUnsafe",
  "$executeRaw",
  "$executeRawUnsafe",
]);

function createPrismaClient() {
  const url = databaseUrl();
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Go to Vercel → Settings → Environment Variables and add it."
    );
  }
  const adapter = new PrismaPg({
    connectionString: url,
    // Opening a connection to the database costs ~1.7 s from the Oracle VM
    // (TLS to another continent), so keep idle ones for 10 minutes instead of
    // pg's default 10 seconds — otherwise the first visitor after a quiet
    // spell waits for a fresh one.
    idleTimeoutMillis: 10 * 60_000,
    keepAlive: true,
    connectionTimeoutMillis: 15_000,
  });
  const client = new PrismaClient({ adapter }).$extends({
    query: {
      async $allOperations({ operation, args, query }) {
        try {
          return await query(args);
        } finally {
          if (WRITES.has(operation)) bumpDataGeneration();
        }
      },
    },
  });
  // A query-only extension keeps every model method's signature.
  return client as unknown as PrismaClient;
}

function getClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }
  return globalForPrisma.prisma;
}

// The client is built on first property access rather than at import time.
// Next.js imports every route module while collecting page data during
// `next build`, and that step runs without the runtime environment, so
// constructing eagerly here fails the whole build when DATABASE_URL is only
// present at runtime.
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getClient();
    const value = Reflect.get(client as object, prop);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
