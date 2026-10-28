import { prisma } from "../db/prisma";
import { cached } from "../db/cache";

/** Every radio code in display order. Cached; an edit to the codes drops it (src/lib/db/cache.ts). */
export function getRadioCodes() {
  return cached("radio-codes", 5 * 60_000, () => prisma.radioCode.findMany({ orderBy: { order: "asc" } }));
}
