import { NextResponse } from "next/server";
import { requireAuth, isDenied } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import { allCandidateSnapshots } from "@/lib/interviews-server";

/**
 * Everyone the Create Interview form can pick from: the roster as candidates,
 * each with the live figures the eligibility rules read, and the members who
 * can be seated on a panel.
 *
 * One route rather than two because the form needs both at once, and the
 * expensive half — the roster read — is shared between them.
 */
export async function GET() {
  const auth = await requireAuth("interviews.create");
  if (isDenied(auth)) return auth.error;

  try {
    const { members, candidates } = await allCandidateSnapshots();

    // A panel seat is keyed on a Discord account, so a member without one
    // cannot be seated — they would have no way to sign in and score.
    const panelists = members
      .filter((m) => m.discordId)
      .map((m) => ({ discordId: m.discordId!, name: m.name, rank: m.rank, callSign: m.callSign }));

    return NextResponse.json({ candidates, panelists });
  } catch (error) {
    return apiError("Failed to load the roster", error);
  }
}
