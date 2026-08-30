import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";

/** Recent notification attempts, newest first — the answer to "did that DM go out?". */
export async function GET(req: NextRequest) {
  const auth = await requireAuth("notifications");
  if (isDenied(auth)) return auth.error;

  try {
    const failedOnly = req.nextUrl.searchParams.get("failed") === "1";
    const deliveries = await prisma.notificationLog.findMany({
      where: failedOnly ? { ok: false } : undefined,
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return NextResponse.json(deliveries);
  } catch (error) {
    return apiError("Failed to load delivery log", error);
  }
}
