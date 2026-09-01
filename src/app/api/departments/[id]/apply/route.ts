import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import { isRankAtLeast } from "@/lib/constants";
import { collectAnswers } from "@/lib/departments";

/**
 * Submitting a join application.
 *
 * Requires a session for the same reason the FTP form did: identity and rank
 * come from the applicant's roster entry, never from the request body, so a
 * department's rank gate is actually enforceable.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (isDenied(auth)) return auth.error;

  try {
    const { id } = await params;
    const { memberId } = auth.access;

    if (!memberId) {
      return NextResponse.json(
        {
          error: "No roster entry",
          detail: "Your Discord account is not linked to a roster member, so it has no rank.",
        },
        { status: 403 }
      );
    }

    const [department, member] = await Promise.all([
      prisma.departmentTemplate.findUnique({
        where: { id },
        include: { questions: { orderBy: { order: "asc" } } },
      }),
      prisma.member.findUnique({
        where: { id: memberId },
        select: { id: true, name: true, rank: true, callSign: true, discordId: true },
      }),
    ]);

    if (!department) return NextResponse.json({ error: "Department not found" }, { status: 404 });
    if (!member) return NextResponse.json({ error: "Roster member not found" }, { status: 403 });

    if (!department.openForApplications) {
      return NextResponse.json(
        { error: "Applications closed", detail: `${department.name} is not accepting applications right now.` },
        { status: 403 }
      );
    }

    if (department.minRank && !isRankAtLeast(member.rank, department.minRank)) {
      return NextResponse.json(
        {
          error: `${department.minRank} or above required`,
          detail: `${department.name} is open to ${department.minRank} and above. Your current rank is ${member.rank}.`,
        },
        { status: 403 }
      );
    }

    const alreadyIn = await prisma.departmentMembership.findUnique({
      where: { departmentId_memberId: { departmentId: department.id, memberId: member.id } },
      select: { id: true },
    });
    if (alreadyIn) {
      return NextResponse.json(
        { error: "Already a member", detail: `You are already in ${department.name}.` },
        { status: 409 }
      );
    }

    const discordId = member.discordId ?? auth.access.discordId;

    const existing = await prisma.departmentApplication.findFirst({
      where: { departmentId: department.id, discordId, status: "Pending" },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        {
          error: "Application already pending",
          detail: `You already have a ${department.name} application awaiting review.`,
        },
        { status: 409 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as { answers?: Record<string, unknown> };
    const collected = collectAnswers(department.questions, body.answers ?? {});
    if ("error" in collected) {
      return NextResponse.json({ error: collected.error }, { status: 400 });
    }

    const application = await prisma.departmentApplication.create({
      data: {
        departmentId: department.id,
        memberId: member.id,
        characterName: member.name,
        discordId,
        currentRank: member.rank,
        answers: collected.answers as never,
      },
    });

    // The webhook only posts the decision (approved/declined) — reviewers work
    // from the admin panel's pending list, not a Discord announcement of every
    // new application.
    return NextResponse.json(application, { status: 201 });
  } catch (error) {
    return apiError("Failed to submit application", error);
  }
}
