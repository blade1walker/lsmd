"use client";

import { Megaphone } from "lucide-react";
import type { RosterBannerData } from "@/lib/roster-shared";

/** The spotlight strip under the hero, set from Admin → Roster Banner. */
export function RosterBannerStrip({ banner }: { banner: RosterBannerData }) {
  return (
    <div className="border-b border-[#1a1a22] bg-[#0c0c12]">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-center gap-x-4 gap-y-1 px-4 py-3.5 text-center">
        <Megaphone className="h-4 w-4 shrink-0 text-red-500" />
        {banner.label && (
          <span className="text-sm font-bold uppercase tracking-[0.12em] text-white">{banner.label}</span>
        )}
        {banner.highlight && (
          <>
            {banner.label && <span className="hidden h-4 w-px bg-[#2a2a33] sm:block" />}
            <span className="text-sm font-bold text-red-400">{banner.highlight}</span>
          </>
        )}
        {banner.message && (
          <>
            <span className="hidden h-4 w-px bg-[#2a2a33] sm:block" />
            <span className="text-sm italic text-gray-400">{banner.message}</span>
          </>
        )}
      </div>
    </div>
  );
}
