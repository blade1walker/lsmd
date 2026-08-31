"use client";

import React from "react";
import { Star, Shield, Check } from "lucide-react";
import {
  DEPARTMENT_ROLES,
  DEPARTMENT_ROLE_MARKS,
  normalizeDepartmentRole,
  type DepartmentRole,
} from "@/lib/departments";

/**
 * The tick in a roster department column. A solid star for high command, a
 * hollow one for command, a shield for a lead, a plain tick for everyone else
 * — so a row says at a glance not just which departments someone is in, but
 * what they are in them.
 */
export function DepartmentMark({
  role,
  size = 15,
  color,
}: {
  role: string | null | undefined;
  size?: number;
  /** The department's own colour, used for the plain member tick. */
  color?: string | null;
}) {
  if (!role) return <span className="text-gray-700 text-xs">·</span>;

  const key: DepartmentRole = normalizeDepartmentRole(role);
  const mark = DEPARTMENT_ROLE_MARKS[key];
  const common = { width: size, height: size, "aria-hidden": true } as const;

  const glyph =
    mark.icon === "star" ? (
      <Star {...common} fill={mark.filled ? "currentColor" : "none"} strokeWidth={2} />
    ) : mark.icon === "shield" ? (
      <Shield {...common} fill={mark.filled ? "currentColor" : "none"} strokeWidth={2} />
    ) : (
      <Check {...common} strokeWidth={3} />
    );

  return (
    <span
      title={mark.label}
      aria-label={mark.label}
      className={`inline-flex items-center justify-center ${mark.className}`}
      style={key === "Member" && color ? { color } : undefined}
    >
      {glyph}
    </span>
  );
}

/** Reads the legend once so the marks above don't have to be guessed at. */
export function DepartmentMarkLegend({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 ${className}`}>
      {DEPARTMENT_ROLES.map((role) => (
        <span key={role} className="inline-flex items-center gap-1.5">
          <DepartmentMark role={role} size={13} />
          {role}
        </span>
      ))}
    </div>
  );
}

export default DepartmentMark;
