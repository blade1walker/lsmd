import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied, actorLabel } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import { logAudit } from "@/lib/audit";
import { LOA_PERMISSIONS } from "@/lib/constants";
import { ensureLoaSettings } from "@/lib/loa-role";

/**
 * The EMS LOA role's settings: on or off, its name, and the Discord server
 * when DISCORD_GUILD_ID is not set. Changing the name or the server forgets
 * the saved role, so the next change finds (or creates) it again.
 */
export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(LOA_PERMISSIONS.manage);
  if (isDenied(auth)) return auth.error;

  try {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: "Nothing was submitted" }, { status: 400 });

    const current = await ensureLoaSettings();
    const data: { autoRole?: boolean; roleName?: string; guildId?: string | null; discordRoleId?: null } = {};

    if (typeof body.autoRole === "boolean") data.autoRole = body.autoRole;
    if (typeof body.roleName === "string") {
      const name = body.roleName.trim().slice(0, 100);
      if (!name) return NextResponse.json({ error: "The role needs a name" }, { status: 400 });
      data.roleName = name;
      if (name !== current.roleName) data.discordRoleId = null;
    }
    if (body.guildId !== undefined) {
      const guildId = typeof body.guildId === "string" ? body.guildId.trim() : "";
      if (guildId && !/^\d{15,22}$/.test(guildId)) {
        return NextResponse.json({ error: "A Discord server ID is a long number — right-click the server icon → Copy Server ID" }, { status: 400 });
      }
      data.guildId = guildId || null;
      if ((guildId || null) !== current.guildId) data.discordRoleId = null;
    }

    const actor = actorLabel(auth.access);
    const saved = await prisma.loaSettings.update({ where: { id: "singleton" }, data: { ...data, updatedBy: actor } });

    await logAudit({
      action: "update",
      entityType: "LoaSettings",
      entityId: saved.id,
      entityLabel: "EMS LOA role",
      details: { autoRole: saved.autoRole, roleName: saved.roleName, guildId: saved.guildId },
      performedBy: actor,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError("Failed to save the LOA settings", error);
  }
}
