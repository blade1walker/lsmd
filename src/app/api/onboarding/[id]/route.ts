import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api-error";
import { postToEnrollWebhook, sendDiscordDM, getNotificationSettings } from "@/lib/discord-webhook";
import { SECTION_HINTS } from "@/lib/constants";
import { getNextCallSign } from "@/lib/callsign";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { status, assignedRank, reviewedBy, reviewNote } = body;

    const request = await prisma.onboardingRequest.update({
      where: { id },
      data: { status, assignedRank, reviewedBy, reviewNote },
    });

    if (status === "Approved" && assignedRank) {
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

    if (status === "Declined") {
      const settings = await getNotificationSettings();
      if (settings.onboardingDM) {
        const msg = settings.onboardingDMDecline
          .replace(/{name}/g, request.name);
        await sendDiscordDM(request.discordId, msg);
      }
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
  try {
    const { id } = await params;
    await prisma.onboardingRequest.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
      return apiError("Failed to delete onboarding request", error);
  }
}
