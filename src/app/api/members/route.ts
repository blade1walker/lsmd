import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import { SECTION_HINTS } from "@/lib/constants";
import { getNextCallSign } from "@/lib/callsign";

/** Fields safe to expose to an anonymous caller — the same ones the public roster already shows. */
const PUBLIC_MEMBER_FIELDS = {
  id: true,
  name: true,
  rank: true,
  callSign: true,
  dept: true,
  activity: true,
  order: true,
  sectionId: true,
  category: true,
  tempRank: true,
  ftoRole: true,
} as const;

/**
 * The leave a member is currently on, so the roster's LOA section can show when
 * they are due back. Statuses match the ones the expiry job treats as running.
 */
const ACTIVE_LOA = {
  where: { status: { in: ["Approved", "Active"] } },
  orderBy: { endDate: "desc" as const },
  take: 1,
  select: { endDate: true, startDate: true, reason: true },
};

/**
 * Stays reachable without a session because the public LOA request page needs
 * to list members. Anonymous callers get a reduced projection: the full row
 * carries discordId, stateId and timezone, which the public roster never shows.
 */
export async function GET() {
  try {
    const auth = await requireAuth("roster.view");
    const full = !isDenied(auth);

    const sections = await prisma.section.findMany({
      include: {
        members: {
          orderBy: { order: "asc" },
          ...(full
            ? { include: { loas: ACTIVE_LOA } }
            : { select: { ...PUBLIC_MEMBER_FIELDS, loas: ACTIVE_LOA } }),
        },
      },
      orderBy: { order: "asc" },
    });
    return NextResponse.json(sections);
  } catch (error) {
      return apiError("Database connection failed", error);
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth("roster.add");
  if (isDenied(auth)) return auth.error;

  try {
    const body = await req.json();

    if (!body.callSign) {
      body.callSign = await getNextCallSign();
    }

    const member = await prisma.member.create({ data: body });

    if (body.rank) {
      for (const [sectionName, ranks] of Object.entries(SECTION_HINTS)) {
        if (ranks.includes(body.rank)) {
          const section = await prisma.section.findFirst({ where: { name: sectionName } });
          if (section) {
            await prisma.member.update({ where: { id: member.id }, data: { sectionId: section.id } });
          }
          break;
        }
      }
    }

    return NextResponse.json(member, { status: 201 });
  } catch (error) {
      return apiError("Failed to create member", error);
  }
}
