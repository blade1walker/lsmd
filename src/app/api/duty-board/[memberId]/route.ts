import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, isDenied, hasPermission, actorLabel } from "@/lib/auth/api";
import { apiError } from "@/lib/api-error";
import { isOnDuty, parseUnitStatusInput, setUnitStatus } from "@/lib/duty-board/server";

/**
 * Sets a medic's unit status. Your own, as long as you are on duty; anyone
 * else's needs duty.manage. Not audited: a status changes a dozen times a
 * shift, and the board itself shows who set it last.
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ memberId: string }> }) {
  const auth = await requireAuth();
  if (isDenied(auth)) return auth.error;

  try {
    const { memberId } = await params;
    const isSelf = auth.access.memberId === memberId;
    if (!isSelf && !hasPermission(auth.access, "duty.manage")) {
      return NextResponse.json({ error: "Forbidden", detail: 'Setting another medic\'s status requires the "duty.manage" permission.' }, { status: 403 });
    }

    const parsed = parseUnitStatusInput(await req.json().catch(() => null));
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const member = await prisma.member.findUnique({ where: { id: memberId }, select: { id: true } });
    if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });
    if (!(await isOnDuty(memberId))) {
      return NextResponse.json(
        { error: isSelf ? "Clock on duty before setting your status" : "That medic is not on duty" },
        { status: 409 }
      );
    }

    const saved = await setUnitStatus(memberId, parsed.data, "site", actorLabel(auth.access));
    return NextResponse.json(saved);
  } catch (error) {
    return apiError("Failed to set the unit status", error);
  }
}
