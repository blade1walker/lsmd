import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied, actorLabel } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import { logAudit } from "@/lib/audit";
import { SECTION_HINTS, getRankWeight } from "@/lib/constants";
import { getNextCallSign } from "@/lib/callsign";
import { getNotificationSettings, postToPromotionWebhook } from "@/lib/discord-webhook";
import { removeFtpDiscordRole } from "@/lib/discord-roles";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth("roster.edit");
  if (isDenied(auth)) return auth.error;

  try {
    const { id } = await params;
    const body = await req.json();

    if (body.dateOfJoining) body.dateOfJoining = new Date(body.dateOfJoining);
    if (body.lastPromotion) body.lastPromotion = new Date(body.lastPromotion);

    const before = await prisma.member.findUnique({
      where: { id },
      select: { rank: true, activity: true, callSign: true, category: true, discordId: true },
    });

    // A promotion is any rank change to a strictly higher weight, whether it
    // came from the dedicated Promote button (which never sends callSign) or
    // an inline edit (which always resends the current one, changed or not).
    const isPromotion =
      !!before && !!body.rank && body.rank !== before.rank && getRankWeight(body.rank) > getRankWeight(before.rank);

    // Reassign the call sign for the new rank on promotion — unless the same
    // request also set a different call sign on purpose, which takes
    // precedence over the automatic one.
    if (isPromotion && (body.callSign === undefined || body.callSign === before.callSign)) {
      const nextCallSign = await getNextCallSign(body.rank);
      if (nextCallSign) body.callSign = nextCallSign;
    }

    const member = await prisma.member.update({
      where: { id },
      data: body,
    });

    if (body.rank) {
      for (const [sectionName, ranks] of Object.entries(SECTION_HINTS)) {
        if (ranks.includes(body.rank)) {
          const section = await prisma.section.findFirst({ where: { name: sectionName } });
          if (section) {
            await prisma.member.update({ where: { id }, data: { sectionId: section.id } });
          }
          break;
        }
      }
    }

    const changedFields = Object.keys(body).filter((k) => k !== "dateOfJoining" && k !== "lastPromotion");
    await logAudit({
      action: "update",
      entityType: "Member",
      entityId: member.id,
      entityLabel: member.name,
      details: {
        fields: changedFields.join(", "),
        rank: before && body.rank && before.rank !== body.rank ? `${before.rank} -> ${body.rank}` : null,
        activity: before && body.activity && before.activity !== body.activity ? `${before.activity} -> ${body.activity}` : null,
        category: before && body.category !== undefined && before.category !== body.category ? `${before.category ?? "none"} -> ${body.category ?? "none"}` : null,
      },
      performedBy: actorLabel(auth.access),
    });

    // The roster is the source of truth for FTP status; Discord follows it.
    // Triggers on any transition off "FTP" — the inline category edit and any
    // future "remove FTP" action alike — not just a dedicated button.
    const leftFtp = before?.category === "FTP" && body.category !== undefined && body.category !== "FTP";
    if (leftFtp && member.discordId) {
      await removeFtpDiscordRole(member.discordId);
    }

    if (isPromotion && before) {
      const performedBy = actorLabel(auth.access);

      // PromotionNotification already existed in the schema and is already
      // read by the dashboard's "Recent Promotions" widget and the in-app
      // notifications page — nothing ever wrote a row, so both were
      // permanently empty until now.
      await prisma.promotionNotification.create({
        data: {
          memberId: member.id,
          memberName: member.name,
          callSign: member.callSign,
          fromRank: before.rank,
          toRank: member.rank,
          promotedBy: performedBy,
        },
      });

      const settings = await getNotificationSettings();
      if (settings.promotionWebhook) {
        // {discordId} is substituted the same way recruit/onboarding do it —
        // the tag itself, <@{discordId}>, lives in the template text. Left
        // blank when the member has no linked Discord account rather than
        // skipped, matching how those routes already handle it.
        const message = settings.promotionWebhookMessage
          .replace(/{name}/g, member.name)
          .replace(/{callSign}/g, member.callSign ?? "N/A")
          .replace(/{fromRank}/g, before.rank)
          .replace(/{toRank}/g, member.rank)
          .replace(/{discordId}/g, member.discordId ?? "");
        await postToPromotionWebhook(message);
      }
    }

    return NextResponse.json(member);
  } catch (error) {
      return apiError("Failed to update member", error);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth("roster.delete");
  if (isDenied(auth)) return auth.error;

  try {
    const { id } = await params;
    const member = await prisma.member.findUnique({ where: { id } });
    if (!member) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const performedBy = actorLabel(auth.access);

    await prisma.deletionLog.create({
      data: {
        entityType: "Member",
        entityId: id,
        entityLabel: member.name,
        data: JSON.parse(JSON.stringify(member)),
        deletedBy: performedBy,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    await prisma.member.delete({ where: { id } });

    if (member.category === "FTP" && member.discordId) {
      await removeFtpDiscordRole(member.discordId);
    }

    await logAudit({
      action: "delete",
      entityType: "Member",
      entityId: id,
      entityLabel: member.name,
      performedBy,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
      return apiError("Failed to delete member", error);
  }
}
