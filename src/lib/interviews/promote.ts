import { prisma } from "../db/prisma";
import { logAudit } from "../audit";
import { SECTION_HINTS } from "../constants";
import {
  describeResult,
  postToPromotionWebhook,
  postToWebhookContent,
  renderTemplate,
} from "../discord/webhook";
import { isScoringRole } from "./";
import { INTERVIEW_INCLUDE, getPromotionSettings, toPanelistRecord } from "./server";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Carrying out a passed examination: the roster rank, the permanent records
 * and the announcement. Shared by the two places a pass can come from — the
 * panel finalizing, and management settling a result the panel held for
 * review — so a promotion reads the same in the records whichever way it came.
 */

type Interview = Prisma.PromotionInterviewGetPayload<{ include: typeof INTERVIEW_INCLUDE }>;

/**
 * The promotion itself: the roster rank, the permanent records and the
 * announcement.
 *
 * The rank change is claimed conditionally on the candidate still holding the
 * rank the panel examined them on. If the roster moved underneath the session
 * — a hand edit while the panel sat — nothing is written and the examination
 * is left recorded as Passed with rosterUpdated false, which the session page
 * reports. Promoting them from whatever rank they happen to be on now would be
 * a rank change nobody authorised.
 */
export async function promote(
  interview: Interview,
  panel: ReturnType<typeof toPanelistRecord>[],
  finalScore: number,
  actor: string,
  now: Date,
  settings: Awaited<ReturnType<typeof getPromotionSettings>>
) {
  if (!interview.memberId) {
    await note(interview.id, "Not applicable", "This candidate has no roster entry to update.");
    return;
  }

  const claim = await prisma.member.updateMany({
    where: { id: interview.memberId, rank: interview.currentRank },
    // lastPromotion is what the time-in-rank counter reads, so setting it here
    // is what resets it — the next interview measures from today.
    data: { rank: interview.targetRank, lastPromotion: now },
  });

  if (claim.count !== 1) {
    await note(
      interview.id,
      "Not applicable",
      `${interview.memberName} is no longer ranked ${interview.currentRank} on the roster, so their rank was left unchanged. Apply the promotion by hand.`
    );
    await logAudit({
      action: "update",
      entityType: "PromotionInterview",
      entityId: interview.id,
      entityLabel: `${interview.sessionId} — ${interview.memberName}`,
      details: { rosterUpdate: "skipped — the candidate's rank had already changed" },
      performedBy: actor,
    });
    return;
  }

  const member = await prisma.member.findUnique({ where: { id: interview.memberId } });

  // Keep the roster section in step with the new rank, the same rule the
  // member PATCH route applies to a hand-made promotion.
  for (const [sectionName, ranks] of Object.entries(SECTION_HINTS)) {
    if (ranks.includes(interview.targetRank)) {
      const section = await prisma.section.findFirst({ where: { name: sectionName } });
      if (section) await prisma.member.update({ where: { id: interview.memberId }, data: { sectionId: section.id } });
      break;
    }
  }

  // Promotion History. Carries the session and the score, so the record says
  // not just that the rank changed but what earned it.
  const record = await prisma.promotionRecord.create({
    data: {
      memberId: interview.memberId,
      memberName: interview.memberName,
      callSign: member?.callSign ?? interview.callSign,
      fromRank: interview.currentRank,
      toRank: interview.targetRank,
      direction: "Promotion",
      promotedBy: actor,
      promotedAt: now,
      interviewId: interview.id,
      interviewSessionId: interview.sessionId,
      finalScore,
    },
  });

  // The in-app notification the dashboard and the bell already read.
  await prisma.promotionNotification.create({
    data: {
      memberId: interview.memberId,
      memberName: interview.memberName,
      callSign: member?.callSign ?? interview.callSign,
      fromRank: interview.currentRank,
      toRank: interview.targetRank,
      promotedBy: actor,
    },
  });

  await prisma.promotionInterview.update({
    where: { id: interview.id },
    data: { rosterUpdated: true, promotionRecordId: record.id },
  });

  await logAudit({
    action: "update",
    entityType: "Member",
    entityId: interview.memberId,
    entityLabel: interview.memberName,
    details: {
      rank: `${interview.currentRank} -> ${interview.targetRank}`,
      interview: interview.sessionId,
      finalScore,
    },
    performedBy: actor,
  });

  await announce(
    interview,
    panel,
    finalScore,
    member?.discordId ?? interview.discordId,
    member?.callSign ?? interview.callSign,
    settings,
    actor
  );
}

/** Records how the announcement went, so the session page can say rather than leave it a mystery. */
async function note(interviewId: string, status: string, detail: string) {
  await prisma.promotionInterview.update({
    where: { id: interviewId },
    data: { announcementStatus: status, announcementDetail: detail.slice(0, 500) },
  });
}

/**
 * Posts the promotion announcement — only ever from here, which is only ever
 * reached once the result is finalized and the roster has actually changed.
 *
 * Goes to the dedicated channel when one is configured, otherwise the shared
 * promotion webhook, so an existing deployment announces with nothing filled in.
 */
export async function announce(
  interview: Interview,
  panel: ReturnType<typeof toPanelistRecord>[],
  finalScore: number,
  discordId: string | null,
  callSign: string | null,
  settings: Awaited<ReturnType<typeof getPromotionSettings>>,
  actor: string
) {
  if (!settings.announceWebhook) {
    await note(interview.id, "Disabled", "Promotion announcements are turned off in the interview settings.");
    await logAnnouncement(interview, "Disabled", "Announcements are turned off", actor);
    return;
  }

  const panelLines = panel
    .filter((p) => isScoringRole(p.role))
    .map((p) => `• ${p.name}${p.rank ? ` — ${p.rank}` : ""}`)
    .join("\n");

  const content = renderTemplate(settings.announcementTemplate, {
    name: interview.memberName,
    callSign: callSign ?? "N/A",
    discordId,
    fromRank: interview.currentRank,
    toRank: interview.targetRank,
    finalScore: String(finalScore),
    sessionId: interview.sessionId,
    panel: panelLines || "• Panel not recorded",
  });

  const url = settings.announcementWebhookUrl?.trim();
  const result = url
    ? await postToWebhookContent(url, content, "interview.promoted", "promotion")
    : await postToPromotionWebhook(content, "interview.promoted");

  const status = result.ok ? "Sent" : "Failed";
  await note(interview.id, status, describeResult(result));
  await logAnnouncement(interview, status, describeResult(result), actor);
}

/**
 * The announcement's outcome in the audit log, alongside the rank change it
 * announced — so a review of a promotion sees whether the department was told,
 * not only that the roster moved.
 */
async function logAnnouncement(interview: Interview, status: string, detail: string, actor: string) {
  await logAudit({
    action: "publish",
    entityType: "PromotionInterview",
    entityId: interview.id,
    entityLabel: `${interview.sessionId} — ${interview.memberName}`,
    details: { announcement: status, detail: detail.slice(0, 200) },
    performedBy: actor,
  });
}
