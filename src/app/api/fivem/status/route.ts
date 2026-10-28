import { NextResponse } from "next/server";
import { optionalAccess, hasPermission } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import { cached } from "@/lib/data-cache";
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
    // The card is on every homepage and roster load; the city changes slowly,
    // so the settings and snapshot are cached briefly and read in parallel.
    const [access, settings] = await Promise.all([
      optionalAccess(),
      cached("fivem:settings", 60_000, () => readFiveMSettings()),
    ]);
    const member = !!access && hasPermission(access, "roster.view");

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

    const names = member || (settings?.showPublicNames ?? false);
    const status = await cached(`fivem:status:${names}`, 15_000, async () =>
      toPublicStatus(await getCitySnapshot(), names)
    );
    return NextResponse.json({ ...status, enabled: true }, { headers: NO_STORE });
  } catch (error) {
    return apiError("Failed to read the city status", error);
  }
}
