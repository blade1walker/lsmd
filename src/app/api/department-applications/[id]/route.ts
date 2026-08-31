import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied, actorLabel } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import { logAudit } from "@/lib/audit";
import { normalizeDepartmentRole, departmentTag } from "@/lib/departments";
import {
  getNotificationSettings,
  postToDepartmentWebhook,
  renderTemplate,
  sendDiscordDM,
} from "@/lib/discord-webhook";
import { addDepartmentDiscordRole } from "@/lib/discord-roles";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth("onboarding.approve");
  if (isDenied(auth)) return auth.error;

  try {
    const { id } = await params;
    const body = (await req.json()) as { status?: string; reviewNote?: string; role?: string };
    const { status, reviewNote } = body;
    const performedBy = actorLabel(auth.access);

    // Atomically claims the transition: only the request that actually moves
    // status away from its current value grants membership and posts below —
    // a double-click or a race must not add the member or announce twice.
    let wonTransition = true;
    if (status !== undefined) {
      const claim = await prisma.departmentApplication.updateMany({
        where: { id, status: { not: status } },
        data: { status, reviewedBy: performedBy, reviewNote },
      });
      wonTransition = claim.count === 1;
    } else {
      await prisma.departmentApplication.update({
        where: { id },
        data: { reviewedBy: performedBy, reviewNote },
      });
    }

    const application = await prisma.departmentApplication.findUnique({
      where: { id },
      include: { department: true },
    });
    if (!application) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { department } = application;
    const settings = await getNotificationSettings();

    if (wonTransition && status === "Approved") {
      const member =
        (application.memberId
          ? await prisma.member.findUnique({ where: { id: application.memberId } })
          : null) ?? (await prisma.member.findFirst({ where: { discordId: application.discordId } }));

      if (member) {
        // Standing defaults to Member; an approver can grant a higher one
        // straight away rather than approving and then editing the roster.
        const role = normalizeDepartmentRole(body.role);
        await prisma.departmentMembership.upsert({
          where: { departmentId_memberId: { departmentId: department.id, memberId: member.id } },
          create: { departmentId: department.id, memberId: member.id, role },
          update: { role },
        });

        // A no-op until the department carries a Discord role ID. Not fatal if
        // it fails: the roster is the source of truth, Discord follows it.
        await addDepartmentDiscordRole(application.discordId, department.discordRoleId);
      }

      const values = {
        department: department.name,
        tag: departmentTag(department),
        name: application.characterName,
        rank: application.currentRank,
        callSign: member?.callSign,
        discordId: application.discordId,
      };

      if (settings.departmentDM) {
        await sendDiscordDM(
          application.discordId,
          renderTemplate(settings.departmentDMApprove, values),
          "department.approved"
        );
      }

      if (settings.departmentWebhook) {
        await postToDepartmentWebhook(
          renderTemplate(settings.departmentWebhookApprove, values),
          "department.approved",
          department.webhookUrl
        );
      }
    } else if (wonTransition && status === "Declined") {
      if (settings.departmentDM) {
        await sendDiscordDM(
          application.discordId,
          renderTemplate(settings.departmentDMDecline, {
            department: department.name,
            tag: departmentTag(department),
            name: application.characterName,
            rank: application.currentRank,
            discordId: application.discordId,
          }),
          "department.declined"
        );
      }
    }

    if (wonTransition && (status === "Approved" || status === "Declined")) {
      await logAudit({
        action: status === "Approved" ? "approve" : "decline",
        entityType: "DepartmentApplication",
        entityId: application.id,
        entityLabel: `${application.characterName} → ${department.name}`,
        performedBy,
      });
    }

    return NextResponse.json(application);
  } catch (error) {
    return apiError("Failed to update department application", error);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth("onboarding.approve");
  if (isDenied(auth)) return auth.error;

  try {
    const { id } = await params;
    await prisma.departmentApplication.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError("Failed to delete department application", error);
  }
}
