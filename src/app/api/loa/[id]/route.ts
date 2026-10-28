import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied, actorLabel } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import { logAudit } from "@/lib/audit";
import { LOA_PERMISSIONS } from "@/lib/constants";
import { postToLOAWebhook, sendDiscordDM, getNotificationSettings } from "@/lib/discord-webhook";
import { announceLoaApproved, beginLeave, endLeave, fillLoaTemplate, isLoaEnding, returnFromLeave, roleNotice, RUNNING_LOA } from "@/lib/loa-server";
import type { RoleChange } from "@/lib/loa-role";

/**
 * Moves a leave through its life — Approved or Declined, then Ended early,
 * Expired or Cancelled — or changes its end date. Every status that starts or
 * stops a leave goes through beginLeave/endLeave, so the roster status and
 * the EMS LOA Discord role follow it.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(LOA_PERMISSIONS.manage);
  if (isDenied(auth)) return auth.error;

  try {
    const { id } = await params;
    const body = await request.json();
    const { status } = body;
    const actor = actorLabel(auth.access);

    // A new end date: extending a leave, or bringing the return forward.
    if (body.endDate !== undefined) {
      const endDate = new Date(body.endDate);
      const current = await prisma.lOA.findUnique({ where: { id }, include: { member: true } });
      if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });
      if (Number.isNaN(endDate.getTime())) return NextResponse.json({ error: "Enter a valid end date" }, { status: 400 });
      if (endDate <= current.startDate) return NextResponse.json({ error: "The end date must be after the start date" }, { status: 400 });
      if (endDate.getTime() < Date.now()) {
        return NextResponse.json({ error: "That date has passed — use End leave to bring them back now" }, { status: 400 });
      }
      if (!(RUNNING_LOA as readonly string[]).includes(current.status) && current.status !== "Pending") {
        return NextResponse.json({ error: `This leave is ${current.status.toLowerCase()} and can no longer be changed` }, { status: 409 });
      }
      const updated = await prisma.lOA.update({ where: { id }, data: { endDate }, include: { member: true } });
      await logAudit({
        action: "update",
        entityType: "LOA",
        entityId: id,
        entityLabel: current.member.name,
        details: { endDate: `${current.endDate.toISOString().slice(0, 10)} -> ${endDate.toISOString().slice(0, 10)}` },
        performedBy: actor,
      });
      return NextResponse.json(updated);
    }

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

    let loa = await prisma.lOA.findUnique({ where: { id }, include: { member: true } });
    if (!loa) return NextResponse.json({ error: "Not found" }, { status: 404 });

    let role: RoleChange | null = null;

    if (status === "Approved") {
      if (wonTransition) {
        loa = await prisma.lOA.update({
          where: { id },
          data: { approvedBy: actor, approvedAt: new Date() },
          include: { member: true },
        });
      }
      role = await beginLeave(loa.memberId);
      if (wonTransition) await announceLoaApproved(loa);
    } else if (status === "Declined") {
      if (wonTransition) {
        const settings = await getNotificationSettings();
        if (settings.loaWebhook) {
          await postToLOAWebhook({
            title: "LOA Declined",
            description: fillLoaTemplate(settings.loaWebhookDecline, loa),
            color: 0xef4444,
            fields: [
              { name: "Member", value: loa.member.name, inline: true },
              { name: "Rank", value: loa.member.rank, inline: true },
              { name: "Call Sign", value: loa.member.callSign || "N/A", inline: true },
              { name: "Start Date", value: loa.startDate.toLocaleDateString(), inline: true },
              { name: "End Date", value: loa.endDate.toLocaleDateString(), inline: true },
              { name: "Reason", value: loa.reason || "Not specified", inline: false },
            ],
          }, "loa.declined");
        }

        if (settings.loaDM && loa.member.discordId) {
          await sendDiscordDM(loa.member.discordId, fillLoaTemplate(settings.loaDMDecline, loa), "loa.declined");
        }
      }
    } else if (isLoaEnding(status)) {
      // A repeat of the same ending keeps who ended it first, but still makes
      // sure the member is back.
      role = wonTransition ? await endLeave(loa.id, status, actor) : await returnFromLeave(loa.memberId);
      loa = (await prisma.lOA.findUnique({ where: { id }, include: { member: true } }))!;
    }

    if (wonTransition && status !== undefined) {
      await logAudit({
        action: status === "Approved" ? "approve" : status === "Declined" ? "decline" : "update",
        entityType: "LOA",
        entityId: loa.id,
        entityLabel: loa.member.name,
        details: status === "Approved" || status === "Declined" ? { reason: loa.reason || null } : { status },
        performedBy: actor,
      });
    }

    return NextResponse.json({ ...loa, discordRole: role ? roleNotice(role) : null });
  } catch (error) {
      return apiError("Failed to update LOA", error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(LOA_PERMISSIONS.manage);
  if (isDenied(auth)) return auth.error;

  try {
    const { id } = await params;
    const loa = await prisma.lOA.findUnique({ where: { id }, select: { memberId: true, status: true } });
    await prisma.lOA.delete({ where: { id } });
    // Deleting a running leave brings the member back the same way ending it would.
    if (loa && (RUNNING_LOA as readonly string[]).includes(loa.status)) await returnFromLeave(loa.memberId);
    return NextResponse.json({ success: true });
  } catch (error) {
      return apiError("Failed to delete LOA", error);
  }
}
