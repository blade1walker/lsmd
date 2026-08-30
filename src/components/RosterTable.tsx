"use client";

import React from "react";
import RankInsignia from "@/components/RankInsignia";
import ActivityPill from "@/components/ActivityPill";
import DeptBadge from "@/components/DeptBadge";
import ClockButton from "@/components/ClockButton";
import { getRankInfo } from "@/lib/constants";
import { formatDuration } from "@/lib/utils";

interface Member {
  id: string;
  name: string;
  callSign?: string | null;
  rank: string;
  activity: string;
  dept: string;
  timezone?: string | null;
  category?: string | null;
  tempRank?: string | null;
  /** At most one row: the leave the member is currently on. */
  loas?: { endDate: string | Date }[];
}

/** "Back 12/09/2026" under the status pill, for members listed in the LOA section. */
function LeaveReturn({ member }: { member: Member }) {
  const endDate = member.activity === "LOA" ? member.loas?.[0]?.endDate : undefined;
  if (!endDate) return null;
  return (
    <span className="block text-[11px] text-gray-500 mt-1">
      Back {new Date(endDate).toLocaleDateString()}
    </span>
  );
}

interface RosterTableProps {
  members: Member[];
  clockStatus?: Record<string, { isClockedIn: boolean; todayTotal: number }>;
  onMemberClick?: (member: Member) => void;
}

export default function RosterTable({ members, clockStatus, onMemberClick }: RosterTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#1e1e1e]">
            <th className="text-left py-3 px-4 text-gray-500 font-medium">#</th>
            <th className="text-left py-3 px-4 text-gray-500 font-medium">Name</th>
            <th className="text-left py-3 px-4 text-gray-500 font-medium">Call Sign</th>
            <th className="text-left py-3 px-4 text-gray-500 font-medium">Rank</th>
            <th className="text-left py-3 px-4 text-gray-500 font-medium">Dept</th>
            <th className="text-left py-3 px-4 text-gray-500 font-medium">Status</th>
            <th className="text-left py-3 px-4 text-gray-500 font-medium">Today</th>
          </tr>
        </thead>
        <tbody>
          {members.map((member, idx) => {
            const rankInfo = getRankInfo(member.rank);
            const clock = clockStatus?.[member.id];
            return (
              <tr
                key={member.id}
                className="border-b border-[#1e1e1e]/50 hover:bg-white/5 cursor-pointer transition-colors"
                onClick={() => onMemberClick?.(member)}
              >
                <td className="py-3 px-4 text-gray-500 font-[family-name:var(--font-mono)]">
                  {idx + 1}
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gold/80 to-gold/40 flex items-center justify-center text-[#0a0a0a] font-bold text-xs shrink-0">
                      {member.name.split(" ").map((n) => n[0]).join("")}
                    </div>
                    <div>
                      <div className="text-white font-medium">{member.name}</div>
                      {member.tempRank && (
                        <div className="text-xs text-gold">{member.tempRank}</div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="py-3 px-4 font-[family-name:var(--font-mono)] text-gray-400">
                  {member.callSign ?? "—"}
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <RankInsignia shape={rankInfo?.shape as "none" | "pip" | "chevron" | "bar" | "star"} count={rankInfo?.count ?? 0} size={14} />
                    <span className="text-gray-300 text-xs">{member.rank}</span>
                  </div>
                </td>
                <td className="py-3 px-4">
                  <DeptBadge dept={member.dept} />
                </td>
                <td className="py-3 px-4">
                  <ActivityPill activity={member.activity} />
                  <LeaveReturn member={member} />
                </td>
                <td className="py-3 px-4 font-[family-name:var(--font-mono)] text-gray-400 text-xs">
                  {clock ? formatDuration(clock.todayTotal) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export { RosterTable };
