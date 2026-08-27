import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";

export async function GET(request: Request) {
  const auth = await requireAuth("audit.view");
  if (isDenied(auth)) return auth.error;

  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") ?? "50");
    const offset = parseInt(searchParams.get("offset") ?? "0");
    const entityType = searchParams.get("entityType");
    const performedBy = searchParams.get("performedBy");

    const where: Record<string, string> = {};
    if (entityType) where.entityType = entityType;
    if (performedBy) where.performedBy = performedBy;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: Math.min(limit, 100),
        skip: offset,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return NextResponse.json({ logs, total });
  } catch (error) {
    return apiError("Failed to fetch audit logs", error);
  }
}
