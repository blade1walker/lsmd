import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied, actorLabel } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import { logAudit } from "@/lib/audit";
import { postToEnrollWebhook, sendDiscordDM, getNotificationSettings } from "@/lib/discord-webhook";
import { SECTION_HINTS } from "@/lib/constants";
import { getNextCallSign } from "@/lib/callsign";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("onboarding.approve");
  if (isDenied(auth)) return auth.error;

  try {
    const { id } = await params;
    const body = await req.json();
    const { status, assignedRank, reviewNote } = body;
    const performedBy = actorLabel(auth.access);

    // Atomically claims the status transition: the conditional where clause
    // means only the request that actually moves status away from its
    // current value updates anything and wins the side effects below. A
    // double-click, a retry, or two requests racing all land on the same
    // final row, but at most one of them creates the roster member below —
    // duplicating that on a race would be a second ghost member, not just a
    // second message.
    let wonTransition = true;
    if (status !== undefined) {
      const claim = await prisma.onboardingRequest.updateMany({
        where: { id, status: { not: status } },
        data: { status, assignedRank, reviewedBy: performedBy, reviewNote },
      });
      wonTransition = claim.count === 1;
    } else {
      await prisma.onboardingRequest.update({
        where: { id },
        data: { assignedRank, reviewedBy: performedBy, reviewNote },
      });
    }

    const request = await prisma.onboardingRequest.findUnique({ where: { id } });
    if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (wonTransition && status === "Approved" && assignedRank) {
      let sectionId: string | null = null;
      for (const [sectionName, ranks] of Object.entries(SECTION_HINTS)) {
        if (ranks.includes(assignedRank)) {
          const section = await prisma.section.findFirst({ where: { name: sectionName } });
          if (section) sectionId = section.id;
          break;
        }
      }

      const callSign = await getNextCallSign(assignedRank);
      const memberCount = await prisma.member.count();

      const member = await prisma.member.create({
        data: {
          name: request.name,
          rank: assignedRank,
          dept: "EMS",
          activity: "Active",
          discordId: request.discordId,
          stateId: request.stateId,
          callSign,
          sectionId,
          dateOfJoining: new Date(),
          order: memberCount,
        },
      });

      const settings = await getNotificationSettings();

      if (settings.onboardingWebhook) {
        await postToEnrollWebhook({
          title: "New Member Enrolled",
          description: `<@${request.discordId}> **${request.name}** has been enrolled in the EMS roster.`,
          color: 0x22c55e,
          fields: [
            { name: "Name", value: request.name, inline: true },
            { name: "Rank", value: assignedRank, inline: true },
            { name: "Call Sign", value: callSign || "N/A", inline: true },
            { name: "State ID", value: request.stateId || "N/A", inline: true },
          ],
        });
      }

      if (settings.onboardingDM) {
        const inviteLink = settings.botSettings?.stateInvite || process.env.DISCORD_STATE_INVITE || "https://discord.gg/YOUR_INVITE";
        const welcomeMessage = settings.onboardingDMApprove
          .replace(/{name}/g, request.name)
          .replace(/{rank}/g, assignedRank)
          .replace(/{callSign}/g, callSign || "N/A")
          .replace(/{stateId}/g, request.stateId || "N/A")
          .replace(/{inviteLink}/g, inviteLink);

        await sendDiscordDM(request.discordId, welcomeMessage);
      }
    }

    if (wonTransition && status === "Declined") {
      const settings = await getNotificationSettings();
      if (settings.onboardingDM) {
        const msg = settings.onboardingDMDecline
          .replace(/{name}/g, request.name);
        await sendDiscordDM(request.discordId, msg);
      }
    }

    if (wonTransition && (status === "Approved" || status === "Declined")) {
      await logAudit({
        action: status === "Approved" ? "approve" : "decline",
        entityType: "OnboardingRequest",
        entityId: request.id,
        entityLabel: request.name,
        details: { assignedRank: assignedRank || null },
        performedBy,
      });
    }

    return NextResponse.json(request);
  } catch (error) {
      return apiError("Failed to update onboarding request", error);
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
    await prisma.onboardingRequest.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
      return apiError("Failed to delete onboarding request", error);
  }
}
