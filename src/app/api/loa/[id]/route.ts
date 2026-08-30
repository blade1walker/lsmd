import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied, actorLabel } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import { logAudit } from "@/lib/audit";
import { postToLOAWebhook, sendDiscordDM, getNotificationSettings } from "@/lib/discord-webhook";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("hr.loa");
  if (isDenied(auth)) return auth.error;

  try {
    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    // Atomically claims the transition: only the request that actually
    // moves status away from its current value runs the webhook/DM below.
    // A double-click, a retry, or two requests racing land on the same
    // final status, but at most one of them posts about it.
    let wonTransition = true;
    if (status !== undefined) {
      const claim = await prisma.lOA.updateMany({
        where: { id, status: { not: status } },
        data: { status },
      });
      wonTransition = claim.count === 1;
    }

    const loa = await prisma.lOA.findUnique({ where: { id }, include: { member: true } });
    if (!loa) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const settings = await getNotificationSettings();

    // The channel post and the DM both render the templates configured in
    // admin > notification settings. They used to be hardcoded here, so
    // editing those fields changed nothing. {discordId} is substituted the
    // same way the recruit and promotion routes do it — the tag itself,
    // <@{discordId}>, lives in the template text and is left blank when the
    // member has no linked Discord account.
    const fillTemplate = (template: string) =>
      template
        .replace(/{name}/g, loa.member.name)
        .replace(/{rank}/g, loa.member.rank)
        .replace(/{callSign}/g, loa.member.callSign || "N/A")
        .replace(/{startDate}/g, loa.startDate.toLocaleDateString())
        .replace(/{endDate}/g, loa.endDate.toLocaleDateString())
        .replace(/{reason}/g, loa.reason || "Not specified")
        .replace(/{discordId}/g, loa.member.discordId ?? "");

    if (status === "Approved") {
      await prisma.member.update({
        where: { id: loa.memberId },
        data: { activity: "LOA" },
      });

      if (wonTransition) {
        if (settings.loaWebhook) {
          await postToLOAWebhook({
            title: "LOA Approved",
            description: fillTemplate(settings.loaWebhookApprove),
            color: 0x22c55e,
            fields: [
              { name: "Member", value: loa.member.name, inline: true },
              { name: "Rank", value: loa.member.rank, inline: true },
              { name: "Call Sign", value: loa.member.callSign || "N/A", inline: true },
              { name: "Start Date", value: loa.startDate.toLocaleDateString(), inline: true },
              { name: "End Date", value: loa.endDate.toLocaleDateString(), inline: true },
              { name: "Reason", value: loa.reason || "Not specified", inline: false },
            ],
          });
        }

        if (settings.loaDM && loa.member.discordId) {
          await sendDiscordDM(loa.member.discordId, fillTemplate(settings.loaDMApprove));
        }
      }
    } else if (status === "Declined") {
      if (wonTransition) {
        if (settings.loaWebhook) {
          await postToLOAWebhook({
            title: "LOA Declined",
            description: fillTemplate(settings.loaWebhookDecline),
            color: 0xef4444,
            fields: [
              { name: "Member", value: loa.member.name, inline: true },
              { name: "Rank", value: loa.member.rank, inline: true },
              { name: "Call Sign", value: loa.member.callSign || "N/A", inline: true },
              { name: "Start Date", value: loa.startDate.toLocaleDateString(), inline: true },
              { name: "End Date", value: loa.endDate.toLocaleDateString(), inline: true },
              { name: "Reason", value: loa.reason || "Not specified", inline: false },
            ],
          });
        }

        if (settings.loaDM && loa.member.discordId) {
          await sendDiscordDM(loa.member.discordId, fillTemplate(settings.loaDMDecline));
        }
      }
    } else if (status === "Expired" || status === "Cancelled") {
      await prisma.member.update({
        where: { id: loa.memberId },
        data: { activity: "Active" },
      });
    }

    if (wonTransition && (status === "Approved" || status === "Declined")) {
      await logAudit({
        action: status === "Approved" ? "approve" : "decline",
        entityType: "LOA",
        entityId: loa.id,
        entityLabel: loa.member.name,
        details: { reason: loa.reason || null },
        performedBy: actorLabel(auth.access),
      });
    }

    return NextResponse.json(loa);
  } catch (error) {
      return apiError("Failed to update LOA", error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("hr.loa");
  if (isDenied(auth)) return auth.error;

  try {
    const { id } = await params;
    await prisma.lOA.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
      return apiError("Failed to delete LOA", error);
  }
}
