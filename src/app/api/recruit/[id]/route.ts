import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied, actorLabel } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import { logAudit } from "@/lib/audit";
import { postToAcceptWebhook, sendDiscordDM, getNotificationSettings } from "@/lib/discord-webhook";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("onboarding.approve");
  if (isDenied(auth)) return auth.error;

  try {
    const { id } = await params;
    const body = await req.json();
    const { status, reviewNote, customMessage, discordId, discordUsername, steamId, characterName, user } = body;
    const performedBy = actorLabel(auth.access);

    // The admin edit modal resends the request's current status alongside
    // field corrections (discordId, steamId, ...), not just a fresh approval —
    // so "status is present" is not the same as "status is changing". Without
    // this, saving an unrelated edit on an already-approved request would
    // re-send the approval DM/webhook and re-log a duplicate approval.
    const before = await prisma.recruitRequest.findUnique({ where: { id }, select: { status: true } });
    const statusChanged = !!status && status !== before?.status;

    // reviewedBy is always the authenticated caller, not whatever the client
    // sends — the previous code took reviewedBy straight from the request body.
    const request = await prisma.recruitRequest.update({
      where: { id },
      data: {
        ...(discordId && { discordId }),
        ...(discordUsername !== undefined && { discordUsername: discordUsername || null }),
        ...(steamId && { steamId }),
        ...(characterName !== undefined && { characterName: characterName || null }),
        ...(user !== undefined && { user: user || null }),
        ...(status && { status }),
        ...(statusChanged && { reviewedBy: performedBy }),
        ...(reviewNote !== undefined && { reviewNote }),
      },
    });

    if (statusChanged && status !== "Pending") {
      const settings = await getNotificationSettings();
      const inviteLink = settings.botSettings?.stateInvite || settings.webhookUrls?.recruit || process.env.DISCORD_STATE_INVITE || "https://discord.gg/YOUR_INVITE";

      if (status === "Approved") {
        if (settings.recruitWebhook) {
          const msg = settings.recruitWebhookApprove
            .replace(/{discordId}/g, request.discordId)
            .replace(/{name}/g, request.characterName || "Recruit")
            .replace(/{inviteLink}/g, inviteLink);
          await postToAcceptWebhook(msg, "https://r2.fivemanage.com/kgAGMLox973pn5aee2Vbl/ems_approved.png");
        }

        if (settings.recruitDM) {
          const msg = (customMessage || settings.recruitDMApprove)
            .replace(/{name}/g, request.characterName || "Recruit")
            .replace(/{inviteLink}/g, inviteLink);
          await sendDiscordDM(request.discordId, msg);
        }
      } else if (status === "Declined") {
        if (settings.recruitWebhook) {
          const msg = settings.recruitWebhookDecline
            .replace(/{name}/g, request.characterName || "Recruit")
            .replace(/{discordId}/g, request.discordId);
          await postToAcceptWebhook(msg, "https://r2.fivemanage.com/kgAGMLox973pn5aee2Vbl/ems_rejected.png");
        }

        if (settings.recruitDM) {
          const msg = settings.recruitDMDecline
            .replace(/{name}/g, request.characterName || "Recruit")
            .replace(/{inviteLink}/g, inviteLink);
          await sendDiscordDM(request.discordId, msg);
        }
      }
    }

    if (statusChanged && (status === "Approved" || status === "Declined")) {
      await logAudit({
        action: status === "Approved" ? "approve" : "decline",
        entityType: "RecruitRequest",
        entityId: request.id,
        entityLabel: request.characterName || request.discordId,
        performedBy,
      });
    }

    return NextResponse.json(request);
  } catch (error) {
      return apiError("Failed to update recruit", error);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("onboarding.approve");
  if (isDenied(auth)) return auth.error;

  try {
    const { id } = await params;
    await prisma.recruitRequest.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
      return apiError("Failed to delete recruit", error);
  }
}
