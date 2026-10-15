import { prisma } from "./prisma";
import type { LOA, Member } from "@/generated/prisma/client";
import { getNotificationSettings, postToLOAWebhook, sendDiscordDM } from "./discord-webhook";
import { setLoaRole, type RoleChange } from "./loa-role";

/**
 * Leave of Absence lifecycle, shared by every way a member goes on or comes
 * off leave — an approved request, a manual placement from the LOA section,
 * ending early, the nightly expiry and a roster status edit — so the roster
 * status, the EMS LOA Discord role and the record always move together.
 */

/** Statuses that mean the leave is running. */
export const RUNNING_LOA = ["Approved", "Active"] as const;

/** How a leave stopped: early by HR, by its end date, or called off. */
export type LoaEnding = "Ended" | "Expired" | "Cancelled";

export function isLoaEnding(value: unknown): value is LoaEnding {
  return value === "Ended" || value === "Expired" || value === "Cancelled";
}

type LoaWithMember = LOA & { member: Member };

export function fillLoaTemplate(template: string, loa: LoaWithMember): string {
  return template
    .replace(/{name}/g, loa.member.name)
    .replace(/{rank}/g, loa.member.rank)
    .replace(/{callSign}/g, loa.member.callSign || "N/A")
    .replace(/{startDate}/g, loa.startDate.toLocaleDateString())
    .replace(/{endDate}/g, loa.endDate.toLocaleDateString())
    .replace(/{reason}/g, loa.reason || "Not specified")
    .replace(/{discordId}/g, loa.member.discordId ?? "");
}

/**
 * The approval post and DM, rendered from the templates in Notification
 * settings. `title` tells an approved request from a placement by HR.
 */
export async function announceLoaApproved(loa: LoaWithMember, title = "LOA Approved") {
  const settings = await getNotificationSettings();
  if (settings.loaWebhook) {
    await postToLOAWebhook(
      {
        title,
        description: fillLoaTemplate(settings.loaWebhookApprove, loa),
        color: 0x22c55e,
        fields: [
          { name: "Member", value: loa.member.name, inline: true },
          { name: "Rank", value: loa.member.rank, inline: true },
          { name: "Call Sign", value: loa.member.callSign || "N/A", inline: true },
          { name: "Start Date", value: loa.startDate.toLocaleDateString(), inline: true },
          { name: "End Date", value: loa.endDate.toLocaleDateString(), inline: true },
          { name: "Reason", value: loa.reason || "Not specified", inline: false },
        ],
      },
      "loa.approved"
    );
  }
  if (settings.loaDM && loa.member.discordId) {
    await sendDiscordDM(loa.member.discordId, fillLoaTemplate(settings.loaDMApprove, loa), "loa.approved");
  }
}

/** Puts the member on leave on the roster and gives them the EMS LOA role. */
export async function beginLeave(memberId: string): Promise<RoleChange> {
  const member = await prisma.member.update({
    where: { id: memberId },
    data: { activity: "LOA" },
    select: { discordId: true },
  });
  return setLoaRole(member.discordId, true);
}

/**
 * Closes a leave record and, unless another leave is still running for the
 * member, brings them back: roster status Active again and the role removed.
 * A member moved to Reserve by hand in the meantime keeps Reserve.
 */
export async function endLeave(loaId: string, ending: LoaEnding, endedBy: string, at = new Date()): Promise<RoleChange> {
  const loa = await prisma.lOA.update({
    where: { id: loaId },
    data: { status: ending, endedAt: at, endedBy },
    select: { memberId: true },
  });
  return returnFromLeave(loa.memberId);
}

/** Back from leave, if no other leave is still running for them. */
export async function returnFromLeave(memberId: string): Promise<RoleChange> {
  const stillRunning = await prisma.lOA.count({ where: { memberId, status: { in: [...RUNNING_LOA] } } });
  if (stillRunning > 0) return { ok: true };

  const member = await prisma.member.findUnique({ where: { id: memberId }, select: { activity: true, discordId: true } });
  if (!member) return { ok: true };
  if (member.activity === "LOA") {
    await prisma.member.update({ where: { id: memberId }, data: { activity: "Active" } });
  }
  return setLoaRole(member.discordId, false);
}

/** A role change worth telling the person who made the change about. */
export function roleNotice(change: RoleChange): string | null {
  if (change.error) return `Discord role not updated: ${change.error}`;
  if (change.skipped === "not-in-server") return "Not in the Discord server, so their EMS LOA role could not be changed.";
  return null;
}
