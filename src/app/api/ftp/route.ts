import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import { FTP_MIN_RANK, isRankAtLeast } from "@/lib/constants";

export async function GET() {
  const auth = await requireAuth("onboarding.view");
  if (isDenied(auth)) return auth.error;

  try {
    const requests = await prisma.fTPRequest.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(requests);
  } catch (error) {
      return apiError("Failed to fetch FTP requests", error);
  }
}

/**
 * Applying requires a session so the applicant's rank can be read from their
 * roster entry. It used to be an open endpoint taking a self-declared
 * discordId and currentRole, which made any rank rule unenforceable — an
 * applicant could simply type "Paramedic".
 */
export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (isDenied(auth)) return auth.error;

  try {
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

    const member = await prisma.member.findUnique({
      where: { id: memberId },
      select: { id: true, name: true, rank: true, dept: true, discordId: true },
    });

    if (!member) {
      return NextResponse.json({ error: "Roster member not found" }, { status: 403 });
    }

    if (!isRankAtLeast(member.rank, FTP_MIN_RANK)) {
      return NextResponse.json(
        {
          error: `${FTP_MIN_RANK} or above required`,
          detail: `The Field Training Program is open to ${FTP_MIN_RANK} and above. Your current rank is ${member.rank}.`,
        },
        { status: 403 }
      );
    }

    const existing = await prisma.fTPRequest.findFirst({
      where: { discordId: member.discordId ?? "", status: "Pending" },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Application already pending", detail: "You already have an FTP application awaiting review." },
        { status: 409 }
      );
    }

    const body = await req.json();

    // Identity and rank come from the roster, never from the request body.
    const request = await prisma.fTPRequest.create({
      data: {
        characterName: member.name,
        discordId: member.discordId ?? "",
        currentRole: member.rank,
        previousExperience: body.previousExperience ?? "",
        department: member.dept,
      },
    });

    return NextResponse.json(request, { status: 201 });
  } catch (error) {
      return apiError("Failed to submit FTP request", error);
  }
}
