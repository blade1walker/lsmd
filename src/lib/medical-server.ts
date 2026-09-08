import { prisma } from "./prisma";
import { formatDocumentNumber, DOCUMENT_CATEGORIES } from "./medical";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Hands a typed object to a Json column.
 *
 * Prisma's InputJsonValue only accepts types with a string index signature, so
 * a declared interface like FormField never satisfies it however JSON-safe its
 * contents are. The alternative is typing the field sets as bare records and
 * losing every guarantee the builder relies on, so the cast is confined to
 * this one helper instead.
 */
export function asJson<T>(value: T): Prisma.InputJsonValue {
  return value as unknown as Prisma.InputJsonValue;
}

/**
 * The half of the medical module that talks to the database.
 *
 * Split from ./medical so the form builder and the document renderer — both
 * client components — can import the field vocabulary and the conditional
 * logic without dragging Prisma into the browser bundle.
 */

/**
 * Claims the next document number for a prefix.
 *
 * The upsert compiles to a single INSERT … ON CONFLICT DO UPDATE, so the
 * increment is atomic: two doctors finalizing at the same moment get
 * consecutive numbers rather than the same one. Numbers are only handed out on
 * finalize, which is why a draft has none.
 */
export async function claimDocumentNumber(prefix: string, now = new Date()): Promise<string> {
  const year = now.getUTCFullYear();
  const cleanPrefix = prefix.trim() || "EMS-MED";
  const sequence = await prisma.medicalNumberSequence.upsert({
    where: { prefix_year: { prefix: cleanPrefix, year } },
    create: { prefix: cleanPrefix, year, lastNumber: 1 },
    update: { lastNumber: { increment: 1 } },
    select: { lastNumber: true },
  });
  return formatDocumentNumber(cleanPrefix, year, sequence.lastNumber);
}

/** The department letterhead, creating the singleton row on first read. */
export async function getMedicalSettings() {
  return prisma.medicalSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton" },
    update: {},
  });
}

/**
 * The version of a form a doctor may actually fill in: the most recently
 * published one. An unpublished draft version is Command's work in progress
 * and must never be offered.
 */
export async function latestPublishedVersion(formId: string) {
  return prisma.medicalFormVersion.findFirst({
    where: { formId, published: true },
    orderBy: { createdAt: "desc" },
  });
}

/** Falls back to "Report" rather than rejecting an unrecognised category. */
export function normalizeCategory(raw: unknown): string {
  const value = String(raw ?? "").trim();
  return (DOCUMENT_CATEGORIES as readonly string[]).includes(value) ? value : "Report";
}
