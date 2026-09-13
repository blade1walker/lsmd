"use client";

import type { RosterStats as Stats } from "@/lib/roster-shared";

export function RosterStats({ stats }: { stats: Stats }) {
  const tiles = [
    { label: "Total", value: stats.total, dot: "bg-gray-500", tone: "text-white" },
    { label: "Active", value: stats.active, dot: "bg-emerald-500", tone: "text-emerald-400" },
    { label: "Reserve", value: stats.reserve, dot: "bg-gray-400", tone: "text-white" },
    { label: "On LOA", value: stats.loa, dot: "bg-amber-500", tone: "text-amber-400" },
    // Everyone clocked on right now. A count only — who is on duty stays in the
    // member-only Duty column.
    { label: "On Duty Now", value: stats.onDuty, dot: "bg-red-500 animate-pulse", tone: "text-red-400" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {tiles.map((tile) => (
        <div key={tile.label} className="flex items-start gap-3 rounded-xl border border-[#1c1c24] bg-[#0e0e14] px-5 py-4">
          <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${tile.dot}`} />
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500">{tile.label}</div>
            <div className={`mt-0.5 font-[family-name:var(--font-oswald)] text-3xl font-bold leading-tight ${tile.tone}`}>
              {tile.value}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
