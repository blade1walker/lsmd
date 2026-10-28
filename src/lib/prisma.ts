import { PrismaClient } from "@/generated/prisma/client";
import { bumpDataGeneration } from "./data-cache";
import { databaseFile } from "./paths";
import { SqliteAdapter } from "./sqlite";

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

/** A client for the SQLite database at `file` (the site's own by default). Scripts use this too. */
export function createPrismaClient(file = databaseFile()): PrismaClient {
  const client = new PrismaClient({ adapter: new SqliteAdapter(file) }).$extends({
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
// `next build`, which has no database, so opening it eagerly here would fail
// the build.
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getClient();
    const value = Reflect.get(client as object, prop);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
