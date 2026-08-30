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
    // so "status is present" is not the same as "status is changing". The
    // conditional where clause makes the check and the write atomic: only a
    // request that actually moves status away from its current value can
    // match it and win, so a double-click or two requests racing can't both
    // pass a separate "did it change" read before either has written —
    // reading it first and writing second, as a sequential statusChanged
    // check would, leaves exactly that gap open.
    const commonData = {
      ...(discordId && { discordId }),
      ...(discordUsername !== undefined && { discordUsername: discordUsername || null }),
      ...(steamId && { steamId }),
      ...(characterName !== undefined && { characterName: characterName || null }),
      ...(user !== undefined && { user: user || null }),
      ...(reviewNote !== undefined && { reviewNote }),
    };

    let statusChanged = true;
    if (status) {
      const claim = await prisma.recruitRequest.updateMany({
        where: { id, status: { not: status } },
        data: { ...commonData, status, reviewedBy: performedBy },
      });
      statusChanged = claim.count === 1;
      if (!statusChanged) {
        // Status didn't move (already there), but other field edits from the
        // same submit should still apply.
        await prisma.recruitRequest.updateMany({ where: { id }, data: commonData });
      }
    } else {
      await prisma.recruitRequest.updateMany({ where: { id }, data: commonData });
    }

    const request = await prisma.recruitRequest.findUnique({ where: { id } });
    if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (statusChanged && status !== "Pending") {
      const settings = await getNotificationSettings();
      // Never falls back to webhookUrls.recruit: that is a webhook URL, which
      // is a credential, and this string is DM'd to the applicant as their
      // "join the server" link.
      const inviteLink = settings.botSettings?.stateInvite || process.env.DISCORD_STATE_INVITE || "https://discord.gg/YOUR_INVITE";

      if (status === "Approved") {
        if (settings.recruitWebhook) {
          const msg = settings.recruitWebhookApprove
            .replace(/{discordId}/g, request.discordId)
            .replace(/{name}/g, request.characterName || "Recruit")
            .replace(/{inviteLink}/g, inviteLink);
          await postToAcceptWebhook(msg, "https://r2.fivemanage.com/kgAGMLox973pn5aee2Vbl/ems_approved.png", "recruit.approved");
        }

        if (settings.recruitDM) {
          const msg = (customMessage || settings.recruitDMApprove)
            .replace(/{name}/g, request.characterName || "Recruit")
            .replace(/{inviteLink}/g, inviteLink);
          await sendDiscordDM(request.discordId, msg, "recruit.approved");
        }
      } else if (status === "Declined") {
        if (settings.recruitWebhook) {
          const msg = settings.recruitWebhookDecline
            .replace(/{name}/g, request.characterName || "Recruit")
            .replace(/{discordId}/g, request.discordId);
          await postToAcceptWebhook(msg, "https://r2.fivemanage.com/kgAGMLox973pn5aee2Vbl/ems_rejected.png", "recruit.declined");
        }

        if (settings.recruitDM) {
          const msg = settings.recruitDMDecline
            .replace(/{name}/g, request.characterName || "Recruit")
            .replace(/{inviteLink}/g, inviteLink);
          await sendDiscordDM(request.discordId, msg, "recruit.declined");
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
