"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import RankInsignia from "@/components/RankInsignia";
import ActivityPill from "@/components/ActivityPill";
import { DepartmentMark } from "@/components/DepartmentMark";
import { shiftSlotLabel } from "@/lib/shifts";
import {
  rankTier,
  formatShortDate,
  formatHours,
  type RosterDepartment,
  type RosterMember,
} from "@/lib/roster-shared";
import { CopyId } from "@/components/roster/CopyId";
import { DutyStatus } from "@/components/roster/DutyStatus";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[#1c1c24] bg-[#0a0a0f] p-3">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-500">{label}</div>
      <div className="text-sm text-white">{children}</div>
    </div>
  );
}

/**
 * A member's details, opened by clicking their roster row. Shows exactly what
 * the viewer's roster shows: member-only fields are absent for visitors because
 * the data never reached the browser, not because this drawer hides it.
 */
export function MemberDrawer({
  member,
  departments,
  fullAccess,
  onClose,
}: {
  member: RosterMember;
  departments: RosterDepartment[];
  fullAccess: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const deptById = new Map(departments.map((d) => [d.id, d]));
  const initials = member.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 3);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.aside
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        transition={{ type: "spring", damping: 26, stiffness: 220 }}
        role="dialog"
        aria-label={`${member.name} details`}
        className="absolute right-0 top-0 h-full w-full max-w-md overflow-y-auto border-l border-[#1c1c24] bg-[#0e0e14]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="font-[family-name:var(--font-oswald)] text-lg font-bold uppercase tracking-wide text-white">
              Member Details
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mb-6 flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-red-600 to-red-800 text-xl font-bold text-white">
              {initials}
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-lg font-semibold text-white">{member.name}</h3>
              <div className="mt-1 flex items-center gap-2">
                <RankInsignia rank={member.rank} size={14} />
                <span className="text-sm text-gray-400">{member.rank}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Call Sign">
              <span className="font-[family-name:var(--font-mono)] font-bold">{member.callSign ?? "—"}</span>
            </Field>
            <Field label="Status">
              <ActivityPill activity={member.activity} />
              {member.loaEndsAt && (
                <span className="mt-1 block text-[11px] text-gray-500">Back {formatShortDate(member.loaEndsAt)}</span>
              )}
            </Field>
            <Field label="Position">{member.position || rankTier(member.rank)}</Field>
            <Field label="Department">{member.dept}</Field>
            {member.ftoRole && <Field label="FTO Role">{member.ftoRole}</Field>}
            {member.tempRank && <Field label="Temp Rank">{member.tempRank}</Field>}
            {member.category && <Field label="Category">{member.category}</Field>}
          </div>

          {member.departments.length > 0 && (
            <div className="mt-3 rounded-lg border border-[#1c1c24] bg-[#0a0a0f] p-3">
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-500">Departments</div>
              <ul className="space-y-2">
                {member.departments.map((membership) => {
                  const dept = deptById.get(membership.departmentId);
                  if (!dept) return null;
                  return (
                    <li key={membership.departmentId} className="flex items-center gap-2 text-sm">
                      <DepartmentMark role={membership.role} color={dept.color} />
                      <span className="flex-1 text-gray-200">{dept.name}</span>
                      <span className="text-xs text-gray-500">{membership.role}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {fullAccess && (
            <>
              <div className="mb-2 mt-6 text-[10px] font-bold uppercase tracking-[0.2em] text-red-400">Member Record</div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Joined">{formatShortDate(member.joinedAt)}</Field>
                <Field label="Last Promoted">{formatShortDate(member.promotedAt)}</Field>
                <Field label="Time Zone">{member.timezone || "—"}</Field>
                <Field label="Total Hours">{formatHours(member.totalSeconds)}</Field>
                <Field label="Duty">
                  <DutyStatus since={member.onDutySince} />
                </Field>
                <Field label="Discord">
                  <CopyId value={member.discordId} label="Copy Discord ID" />
                </Field>
              </div>
              <div className="mt-3">
                <Field label="Shifts">
                  {member.shift ? (
                    <div className="space-y-0.5 text-xs">
                      <div>
                        <span className="text-gray-500">Primary</span> {shiftSlotLabel(member.shift.primarySlot)}
                      </div>
                      <div>
                        <span className="text-gray-500">Secondary</span> {shiftSlotLabel(member.shift.secondarySlot)}
                      </div>
                    </div>
                  ) : (
                    <span className="text-gray-600">No shift picked</span>
                  )}
                </Field>
              </div>
            </>
          )}
        </div>
      </motion.aside>
    </motion.div>
  );
}
