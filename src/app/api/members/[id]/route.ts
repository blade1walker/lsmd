import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied, actorLabel } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import { logAudit } from "@/lib/audit";
import { SECTION_HINTS, getRankWeight } from "@/lib/constants";
import { getNotificationSettings, postToPromotionWebhook, postToCallsignWebhook } from "@/lib/discord-webhook";
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

    // A promotion candidate: any rank change to a strictly higher weight,
    // whether from the dedicated Promote button (which never sends callSign)
    // or an inline edit (resends the current one, changed or not). Based on
    // a snapshot that can go stale before the write below, which is fine —
    // it only decides whether to attempt the atomic path, not whether the
    // promotion notification actually fires.
    const isPromotionCandidate =
      !!before && !!body.rank && body.rank !== before.rank && getRankWeight(body.rank) > getRankWeight(before.rank);

    // A standalone call sign reassignment — the dedicated Call Signs section,
    // or any other edit that sets callSign without also promoting. Excluded
    // whenever isPromotionCandidate: if a promotion request happens to bundle
    // a call sign change too, the promotion announcement below already
    // reports the new call sign, so firing this notification as well would
    // post twice about the same underlying change.
    const isCallsignChange =
      !isPromotionCandidate && !!before && body.callSign !== undefined && body.callSign !== before.callSign;

    // Atomically claims the promotion or the call sign change: the
    // conditional where clause means only the request that actually moves
    // the guarded field away from its current value writes anything and
    // wins the notification below. A double-click, a slow retry, or two
    // requests racing all resolve to the same final state, but at most one
    // of them posts about it — and, for a promotion, a losing request's
    // speculative call sign, chosen from the same stale snapshot as a
    // winner's, is discarded rather than written, so two concurrent
    // promotions can't collide on one call sign.
    let isPromotion = false;
    let callsignChanged = false;
    if (isPromotionCandidate) {
      const claim = await prisma.member.updateMany({
        where: { id, rank: { not: body.rank } },
        data: body,
      });
      isPromotion = claim.count === 1;
      if (!isPromotion) {
        // Someone else already made this exact rank change. Still apply any
        // other fields from this submit (name, timezone, ...) — those are
        // real edits bundled into the same request, not part of the race.
        const { rank: _rank, callSign: _callSign, ...rest } = body;
        if (Object.keys(rest).length > 0) {
          await prisma.member.update({ where: { id }, data: rest });
        }
      }
    } else if (isCallsignChange) {
      const claim = await prisma.member.updateMany({
        where: { id, callSign: { not: body.callSign } },
        data: body,
      });
      callsignChanged = claim.count === 1;
      if (!callsignChanged) {
        const { callSign: _callSign, ...rest } = body;
        if (Object.keys(rest).length > 0) {
          await prisma.member.update({ where: { id }, data: rest });
        }
      }
    } else {
      await prisma.member.update({ where: { id }, data: body });
    }

    const member = await prisma.member.findUnique({ where: { id } });
    if (!member) return NextResponse.json({ error: "Not found" }, { status: 404 });

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
        callSign: before && body.callSign !== undefined && before.callSign !== body.callSign ? `${before.callSign ?? "none"} -> ${body.callSign ?? "none"}` : null,
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
        void postToPromotionWebhook(message);
      }
    }

    if (callsignChanged && before) {
      const settings = await getNotificationSettings();
      if (settings.callsignWebhook) {
        const message = settings.callsignWebhookMessage
          .replace(/{name}/g, member.name)
          .replace(/{oldCallSign}/g, before.callSign ?? "N/A")
          .replace(/{newCallSign}/g, member.callSign ?? "N/A")
          .replace(/{discordId}/g, member.discordId ?? "");
        void postToCallsignWebhook(message);
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
