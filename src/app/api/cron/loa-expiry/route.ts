import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { apiError } from "@/lib/api-error";
import { getNotificationSettings, sendDiscordDM, renderTemplate } from "@/lib/discord/webhook";
import { logAudit } from "@/lib/audit";
import { endLeave } from "@/lib/loa/server";
import { syncAllLoaRoles } from "@/lib/loa/role";
import { log } from "@/lib/log";

export const dynamic = "force-dynamic";

/** Statuses that mean the leave is running — the ones an end date can expire. */
const RUNNING = ["Approved", "Active"];

const DAY_MS = 86_400_000;

/**
 * Nightly LOA housekeeping. Until this existed nothing ever set "Expired": an
 * admin had to notice the end date had passed and click the button, so members
 * stayed flagged LOA on the roster indefinitely.
 *
 * lsmd-loa-expiry.timer on the server calls it daily with
 * `Authorization: Bearer $CRON_SECRET`.
 * Without it the route refuses rather than running unauthenticated — it mutates
 * the roster and sends DMs.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not set — refusing to run an unauthenticated job" },
      { status: 503 }
    );
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const settings = await getNotificationSettings();

    const expired: string[] = [];
    const reminded: string[] = [];

    const due = await prisma.lOA.findMany({
      where: { status: { in: RUNNING }, endDate: { lt: now } },
      include: { member: true },
    });

    for (const loa of due) {
      // Ended as of its end date. endLeave only lifts the LOA flag if the
      // member is still marked LOA — an admin may already have moved them to
      // Reserve or back to Active by hand — and takes the EMS LOA role away.
      await endLeave(loa.id, "Expired", "system (cron)", loa.endDate);
      expired.push(loa.member.name);

      await logAudit({
        action: "update",
        entityType: "LOA",
        entityId: loa.id,
        entityLabel: loa.member.name,
        details: { status: "Active -> Expired", endDate: loa.endDate.toISOString() },
        performedBy: "system (cron)",
      });

      if (settings.loaExpiredDM && loa.member.discordId) {
        await sendDiscordDM(
          loa.member.discordId,
          renderTemplate(settings.loaExpiredMessage, {
            name: loa.member.name,
            rank: loa.member.rank,
            callSign: loa.member.callSign ?? "N/A",
            startDate: loa.startDate.toLocaleDateString(),
            endDate: loa.endDate.toLocaleDateString(),
            reason: loa.reason || "Not specified",
            discordId: loa.member.discordId,
          }),
          "loa.expired"
        );
      }
    }

    if (settings.loaReminderDM) {
      // Ends in the next 24-48 hours: with a daily run each leave lands in this
      // window exactly once. The log check below covers a manual re-run.
      const soon = await prisma.lOA.findMany({
        where: {
          status: { in: RUNNING },
          endDate: { gte: new Date(now.getTime() + DAY_MS), lt: new Date(now.getTime() + 2 * DAY_MS) },
        },
        include: { member: true },
      });

      for (const loa of soon) {
        if (!loa.member.discordId) continue;

        const alreadySent = await prisma.notificationLog.findFirst({
          where: {
            event: "loa.reminder",
            target: loa.member.discordId,
            ok: true,
            createdAt: { gte: new Date(now.getTime() - 3 * DAY_MS) },
          },
        });
        if (alreadySent) continue;

        await sendDiscordDM(
          loa.member.discordId,
          renderTemplate(settings.loaReminderMessage, {
            name: loa.member.name,
            rank: loa.member.rank,
            callSign: loa.member.callSign ?? "N/A",
            startDate: loa.startDate.toLocaleDateString(),
            endDate: loa.endDate.toLocaleDateString(),
            daysLeft: String(Math.max(1, Math.ceil((loa.endDate.getTime() - now.getTime()) / DAY_MS))),
            reason: loa.reason || "Not specified",
            discordId: loa.member.discordId,
          }),
          "loa.reminder"
        );
        reminded.push(loa.member.name);
      }
    }

    // Nightly safety net for the EMS LOA role: anyone the per-change updates
    // missed — Discord down at the time, or the bot's role moved — is put
    // right here. Never fails the job.
    const roleSync = await syncAllLoaRoles("system (nightly LOA job)").catch((err) => {
      log.error("EMS LOA role sync failed", err);
      return null;
    });

    return NextResponse.json({
      ok: true,
      expired,
      reminded,
      roleSync: roleSync && {
        ok: roleSync.ok,
        error: roleSync.error,
        added: roleSync.added.length,
        removed: roleSync.removed.length,
        failed: roleSync.failed.length,
      },
      ranAt: now.toISOString(),
    });
  } catch (error) {
    return apiError("LOA expiry job failed", error);
  }
}
