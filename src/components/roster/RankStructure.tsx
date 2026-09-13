"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Layers } from "lucide-react";
import RankInsignia from "@/components/RankInsignia";
import { SECTION_HINTS } from "@/lib/constants";
import type { RosterMember } from "@/lib/roster-shared";

/**
 * The whole chain of command in one panel: every rank, grouped by tier,
 * with its insignia and how many people currently hold it. Collapsed by
 * default — reference for new members, not something to scroll past daily.
 */
export function RankStructure({ members }: { members: RosterMember[] }) {
  const [open, setOpen] = useState(false);

  const headcount = useMemo(() => {
    const counts = new Map<string, number>();
    for (const member of members) counts.set(member.rank, (counts.get(member.rank) ?? 0) + 1);
    return counts;
  }, [members]);

  const tiers = Object.entries(SECTION_HINTS);
  const rankCount = tiers.reduce((n, [, ranks]) => n + ranks.length, 0);

  return (
    <div className="rounded-xl border border-[#1c1c24] bg-[#0e0e14]">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-5 py-3.5 text-left"
      >
        <Layers className="h-4 w-4 text-red-500" />
        <span className="flex-1 text-xs font-bold uppercase tracking-[0.18em] text-gray-300">Rank Structure</span>
        <span className="text-xs text-gray-600">
          {rankCount} ranks · {tiers.length} tiers
        </span>
        <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${open ? "" : "-rotate-90"}`} />
      </button>

      {open && (
        <div className="grid gap-3 border-t border-[#1c1c24] p-4 sm:grid-cols-2 lg:grid-cols-5">
          {tiers.map(([tier, ranks]) => (
            <div key={tier} className="rounded-lg border border-[#1c1c24] bg-[#0a0a0f] p-3">
              <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-red-400">{tier}</div>
              <ul className="space-y-1.5">
                {ranks.map((rank) => (
                  <li key={rank} className="flex items-center gap-2 text-sm">
                    <span className="flex w-12 shrink-0 justify-start">
                      <RankInsignia rank={rank} size={13} />
                    </span>
                    <span className="flex-1 truncate text-gray-300">{rank}</span>
                    <span className="font-[family-name:var(--font-mono)] text-xs text-gray-600">
                      {headcount.get(rank) ?? 0}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
