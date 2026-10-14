import { NextResponse } from "next/server";
import { optionalAccess, hasPermission } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import { getCitySnapshot, readFiveMSettings, toPublicStatus } from "@/lib/fivem-server";
import type { CityStatusPublic } from "@/lib/fivem";

const NO_STORE = { "Cache-Control": "private, no-store" };

/**
 * The server card on the home page and roster, and the bot's /city.
 *
 * Public, but not the same for everyone: a visitor gets the server and the
 * number of EMS in the city, and names only when command has made them public.
 * A roster member always gets names — the roster already tells them who is on
 * duty — and still sees the card when command has hidden it from the public.
 */
export async function GET() {
  try {
    const access = await optionalAccess();
    const member = !!access && hasPermission(access, "roster.view");

    const settings = await readFiveMSettings();
    if (settings && !settings.showPublicStatus && !member) {
      const hidden: CityStatusPublic = {
        enabled: false,
        configured: true,
        online: false,
        name: null,
        playerCount: null,
        maxPlayers: null,
        connectUrl: null,
        joinCode: null,
        updatedAt: null,
        ems: { inCity: 0, onDuty: 0, members: null },
      };
      return NextResponse.json(hidden, { headers: NO_STORE });
    }

    const snapshot = await getCitySnapshot();
    const status = await toPublicStatus(snapshot, member || (settings?.showPublicNames ?? false));
    return NextResponse.json({ ...status, enabled: true }, { headers: NO_STORE });
  } catch (error) {
    return apiError("Failed to read the city status", error);
  }
}
