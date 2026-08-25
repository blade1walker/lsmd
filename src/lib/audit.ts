import { prisma } from "./prisma";

export interface AuditAction {
  action: "create" | "update" | "delete" | "promote" | "demote" | "approve" | "decline";
  entityType: string;
  entityId: string;
  entityLabel: string;
  details?: Record<string, string | number | boolean | null>;
  performedBy: string;
}

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
