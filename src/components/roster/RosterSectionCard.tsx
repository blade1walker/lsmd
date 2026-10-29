"use client";

import React from "react";
import { ChevronDown } from "lucide-react";
import RankInsignia from "@/components/roster/RankInsignia";
import ActivityPill from "@/components/roster/ActivityPill";
import { DepartmentMark } from "@/components/roster/DepartmentMark";
import { departmentTag } from "@/lib/departments";
import {
  groupByRank,
  rankTier,
  formatShortDate,
  formatHours,
  type RosterDepartment,
  type RosterMember,
} from "@/lib/roster";
import { StarOfLife } from "./StarOfLife";
import { CopyId } from "./CopyId";
import { DutyStatus } from "./DutyStatus";

const TH = "whitespace-nowrap px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500";
const TD = "whitespace-nowrap px-3 py-3.5";

const ACCENTS = {
  red: { bar: "bg-red-600", dot: "bg-red-500", text: "text-red-400" },
  amber: { bar: "bg-amber-500", dot: "bg-amber-400", text: "text-amber-400" },
} as const;

type Accent = (typeof ACCENTS)[keyof typeof ACCENTS];

/**
 * One roster section as a card: the section header, then its members split
 * under a heading per rank, most senior first — so "who are the Lieutenants"
 * is a glance at the card rather than a scan of every row.
 */
export function RosterSectionCard({
  name,
  members,
  departments,
  fullAccess,
  accent = "red",
  open,
  onToggle,
  onSelect,
}: {
  name: string;
  members: RosterMember[];
  departments: RosterDepartment[];
  fullAccess: boolean;
  accent?: keyof typeof ACCENTS;
  open: boolean;
  onToggle: () => void;
  onSelect: (member: RosterMember) => void;
}) {
  const colors = ACCENTS[accent];
  // # Name Dept Insignia Rank Position CallSign Activity, a column per
  // department, and the six member-only columns.
  const columnCount = 8 + departments.length + (fullAccess ? 6 : 0);
  const groups = groupByRank(members);
  // Row numbers run continuously across the rank groups. Each group's
  // starting number is worked out up front, since a counter mutated while
  // rendering is not safe to rely on under React's rendering model.
  const groupStarts = groups.map((_, i) => groups.slice(0, i).reduce((n, g) => n + g.members.length, 0));

  return (
    <section className="relative overflow-hidden rounded-xl border border-[#1c1c24] bg-[#0e0e14]">
      <span className={`absolute inset-y-0 left-0 w-1 ${colors.bar}`} />

      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 py-4 pl-5 pr-4 text-left transition-colors hover:bg-white/[0.02] sm:gap-4 sm:py-5 sm:pl-7 sm:pr-6"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#26262f] bg-[#08080c] sm:h-11 sm:w-11">
          <StarOfLife className="h-6 w-6 sm:h-7 sm:w-7" />
        </span>
        <h2 className="min-w-0 flex-1 font-[family-name:var(--font-oswald)] text-lg font-bold uppercase tracking-wide text-white sm:text-xl">
          {name}
        </h2>
        <span className="shrink-0 whitespace-nowrap font-[family-name:var(--font-mono)] text-xs text-gray-500 sm:text-sm">
          {members.length} {members.length === 1 ? "member" : "members"}
        </span>
        <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${open ? "" : "-rotate-90"}`} />
      </button>

      {open && (
        <PhoneList
          groups={groups}
          groupStarts={groupStarts}
          departments={departments}
          accent={colors}
          onSelect={onSelect}
        />
      )}

      {open && (
        <div className="hidden overflow-x-auto border-t border-[#1c1c24] sm:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1c1c24]">
                <th className={`${TH} pl-7`}>#</th>
                <th className={TH}>Name</th>
                <th className={TH}>Dept</th>
                <th className={TH}>Insignia</th>
                <th className={TH}>Rank</th>
                <th className={TH}>Position</th>
                <th className={TH}>Call Sign</th>
                <th className={TH}>Activity</th>
                {departments.map((dept) => (
                  <th key={dept.id} className={`${TH} text-center`} title={dept.name}>
                    {departmentTag(dept)}
                  </th>
                ))}
                {fullAccess && (
                  <>
                    <th className={TH}>TZ</th>
                    <th className={TH}>Joined</th>
                    <th className={TH}>Promoted</th>
                    <th className={TH}>Discord</th>
                    <th className={TH}>Duty</th>
                    <th className={TH}>Total Hrs</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {groups.map((group, groupIndex) => (
                <React.Fragment key={group.rank}>
                  <tr className="border-b border-[#16161d] bg-white/[0.012]">
                    <td colSpan={columnCount} className="py-2 pl-7 pr-3">
                      <RankHeading rank={group.rank} count={group.members.length} accent={colors} />
                    </td>
                  </tr>

                  {group.members.map((member, memberIndex) => {
                    const index = groupStarts[groupIndex] + memberIndex + 1;
                    const standing = new Map(member.departments.map((d) => [d.departmentId, d.role]));
                    return (
                      <tr
                        key={member.id}
                        tabIndex={0}
                        onClick={() => onSelect(member)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onSelect(member);
                          }
                        }}
                        className="cursor-pointer border-b border-[#16161d] transition-colors last:border-b-0 hover:bg-white/[0.03] focus:bg-white/[0.04] focus:outline-none"
                      >
                        <td className={`${TD} pl-7 font-[family-name:var(--font-mono)] text-gray-600`}>{index}</td>
                        <td className={TD}>
                          <div className="font-semibold text-white">{member.name}</div>
                          <MemberTags member={member} />
                        </td>
                        <td className={TD}>
                          <span className="rounded bg-red-600/15 px-2 py-1 text-xs font-bold text-red-300">{member.dept}</span>
                        </td>
                        <td className={TD}>
                          <RankInsignia rank={member.rank} size={16} />
                        </td>
                        <td className={`${TD} text-gray-200`}>{member.rank}</td>
                        <td className={`${TD} text-gray-500`}>{member.position || rankTier(member.rank)}</td>
                        <td className={`${TD} font-[family-name:var(--font-mono)] font-bold text-white`}>
                          {member.callSign ?? "—"}
                        </td>
                        <td className={TD}>
                          <ActivityPill activity={member.activity} />
                          {member.loaEndsAt && (
                            <span className="mt-1 block text-[11px] text-gray-500">Back {formatShortDate(member.loaEndsAt)}</span>
                          )}
                        </td>
                        {departments.map((dept) => {
                          const role = standing.get(dept.id);
                          return (
                            <td key={dept.id} className={`${TD} text-center`}>
                              {role ? (
                                <span
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border"
                                  style={{ borderColor: `${dept.color}66`, backgroundColor: `${dept.color}14` }}
                                >
                                  <DepartmentMark role={role} color={dept.color} />
                                </span>
                              ) : (
                                <span className="text-gray-700">·</span>
                              )}
                            </td>
                          );
                        })}
                        {fullAccess && (
                          <>
                            <td className={`${TD} text-gray-400`}>{member.timezone || "—"}</td>
                            <td className={`${TD} font-[family-name:var(--font-mono)] text-xs text-gray-500`}>
                              {formatShortDate(member.joinedAt)}
                            </td>
                            <td className={`${TD} font-[family-name:var(--font-mono)] text-xs text-gray-500`}>
                              {formatShortDate(member.promotedAt)}
                            </td>
                            <td className={TD}>
                              <CopyId value={member.discordId} label="Copy Discord ID" />
                            </td>
                            <td className={TD}>
                              <DutyStatus since={member.onDutySince} />
                            </td>
                            <td className={`${TD} font-[family-name:var(--font-mono)] text-xs text-gray-400`}>
                              {formatHours(member.totalSeconds)}
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function RankHeading({ rank, count, accent }: { rank: string; count: number; accent: Accent }) {
  return (
    <span className={`inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] ${accent.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${accent.dot}`} />
      {rank}
      <span className="font-medium tracking-normal text-gray-600">— {count}</span>
    </span>
  );
}

/** FTO role, temporary rank and category, under the member's name. */
function MemberTags({ member }: { member: RosterMember }) {
  if (!member.tempRank && !member.ftoRole && !member.category) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {member.ftoRole && (
        <span className="rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wider text-amber-300">
          {member.ftoRole}
        </span>
      )}
      {member.tempRank && (
        <span className="rounded border border-sky-500/30 bg-sky-500/10 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wider text-sky-300">
          {member.tempRank}
        </span>
      )}
      {member.category && (
        <span className="rounded border border-[#2a2a33] bg-white/5 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wider text-gray-400">
          {member.category}
        </span>
      )}
    </div>
  );
}

/**
 * The section on a phone: one compact row per member instead of a table that
 * shows two columns and scrolls sideways for the rest. Name, call sign, rank
 * and status at a glance; tapping a row opens the full record in the drawer.
 */
function PhoneList({
  groups,
  groupStarts,
  departments,
  accent,
  onSelect,
}: {
  groups: { rank: string; members: RosterMember[] }[];
  groupStarts: number[];
  departments: RosterDepartment[];
  accent: Accent;
  onSelect: (member: RosterMember) => void;
}) {
  return (
    <div className="border-t border-[#1c1c24] sm:hidden">
      {groups.map((group, groupIndex) => (
        <div key={group.rank}>
          <div className="border-b border-[#16161d] bg-white/[0.012] py-2 pl-5 pr-4">
            <RankHeading rank={group.rank} count={group.members.length} accent={accent} />
          </div>
          <ul>
            {group.members.map((member, memberIndex) => {
              const standing = departments.flatMap((dept) => {
                const role = member.departments.find((d) => d.departmentId === dept.id)?.role;
                return role ? [{ dept, role }] : [];
              });
              return (
                <li key={member.id} className="border-b border-[#16161d] last:border-b-0">
                  <button
                    type="button"
                    onClick={() => onSelect(member)}
                    className="flex w-full items-start gap-3 py-3 pl-5 pr-4 text-left transition-colors hover:bg-white/[0.03] focus:bg-white/[0.04] focus:outline-none"
                  >
                    <span className="w-5 shrink-0 pt-0.5 font-[family-name:var(--font-mono)] text-xs text-gray-600">
                      {groupStarts[groupIndex] + memberIndex + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block break-words font-semibold leading-snug text-white">{member.name}</span>
                      <span className="mt-1 flex items-center gap-1.5 text-xs text-gray-500">
                        <RankInsignia rank={member.rank} size={12} />
                        <span className="truncate">{member.position || rankTier(member.rank)}</span>
                      </span>
                      <MemberTags member={member} />
                      {standing.length > 0 && (
                        <span className="mt-1.5 flex flex-wrap gap-1">
                          {standing.map(({ dept, role }) => (
                            <span
                              key={dept.id}
                              title={dept.name}
                              className="inline-flex items-center gap-1 rounded border px-1.5 py-px text-[11px] font-semibold uppercase tracking-wider"
                              style={{ borderColor: `${dept.color}55`, backgroundColor: `${dept.color}14`, color: dept.color }}
                            >
                              <DepartmentMark role={role} color={dept.color} size={11} />
                              {departmentTag(dept)}
                            </span>
                          ))}
                        </span>
                      )}
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1.5">
                      <span className="font-[family-name:var(--font-mono)] text-sm font-bold text-white">
                        {member.callSign ?? "—"}
                      </span>
                      <ActivityPill activity={member.activity} />
                      {member.loaEndsAt && (
                        <span className="text-[11px] text-gray-500">Back {formatShortDate(member.loaEndsAt)}</span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
