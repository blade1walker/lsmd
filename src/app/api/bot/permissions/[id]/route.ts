import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied, actorLabel } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import { logAudit } from "@/lib/audit";
import { BOT_PERMISSION_PERMISSIONS } from "@/lib/constants";
import { commandLabel } from "@/lib/bot-commands";

/** Revokes one grant. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(BOT_PERMISSION_PERMISSIONS.manage);
  if (isDenied(auth)) return auth.error;

  try {
    const { id } = await params;
    const grant = await prisma.botCommandGrant.findUnique({ where: { id } });
    if (!grant) return NextResponse.json({ error: "That permission no longer exists." }, { status: 404 });

    await prisma.botCommandGrant.delete({ where: { id } });
    await logAudit({
      action: "delete",
      entityType: "BotCommandGrant",
      entityId: id,
      entityLabel: `${commandLabel(grant.command)} → ${grant.targetType} ${grant.targetName}`,
      details: { guildId: grant.guildId, targetType: grant.targetType, targetId: grant.targetId, command: grant.command },
      performedBy: actorLabel(auth.access),
    });
    return NextResponse.json(grant);
  } catch (error) {
    return apiError("Failed to revoke bot permission", error);
  }
}
