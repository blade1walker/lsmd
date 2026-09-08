import { prisma } from "./prisma";

export interface AuditAction {
  action:
    | "create"
    | "update"
    | "delete"
    | "approve"
    | "decline"
    | "export"
    // Medical documentation. A finalized document is a legal-ish record, so
    // every transition that changes what it says, or who may still change it,
    // gets its own verb rather than collapsing into "update".
    | "finalize"
    | "reopen"
    | "publish"
    | "archive";
  entityType: string;
  entityId: string;
  entityLabel: string;
  details?: Record<string, string | number | boolean | null>;
  performedBy: string;
}

/**
 * Records who did what. Failures are swallowed rather than propagated — the
 * mutation that triggered the log entry (a role change, an approval) has
 * already succeeded by the time this runs, and a logging failure should not
 * turn that into a 500 for the caller.
 */
export async function logAudit(action: AuditAction) {
  try {
    await prisma.auditLog.create({
      data: {
        action: action.action,
        entityType: action.entityType,
        entityId: action.entityId,
        entityLabel: action.entityLabel,
        details: (action.details ?? {}) as never,
        performedBy: action.performedBy,
      },
    });
  } catch (error) {
    console.error("Audit log failed:", error);
  }
}
