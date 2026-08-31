import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 300;

/**
 * Recent notification attempts, newest first — the answer to "did that DM go
 * out?", and, read as a list, everything the bot has sent and to whom.
 *
 * `failed=1` narrows to failures, `channel=dm|webhook` to one transport, and
 * `q=` matches the event, target and message preview.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth("notifications");
  if (isDenied(auth)) return auth.error;

  try {
    const params = req.nextUrl.searchParams;
    const failedOnly = params.get("failed") === "1";
    const channel = params.get("channel");
    const query = (params.get("q") ?? "").trim();
    const limit = Math.min(Number(params.get("limit")) || DEFAULT_LIMIT, MAX_LIMIT);

    const deliveries = await prisma.notificationLog.findMany({
      where: {
        ...(failedOnly ? { ok: false } : {}),
        ...(channel === "dm" || channel === "webhook" ? { channel } : {}),
        ...(query
          ? {
              OR: [
                { event: { contains: query, mode: "insensitive" as const } },
                { target: { contains: query, mode: "insensitive" as const } },
                { preview: { contains: query, mode: "insensitive" as const } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json(deliveries);
  } catch (error) {
    return apiError("Failed to load delivery log", error);
  }
}
