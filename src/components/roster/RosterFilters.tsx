"use client";

import { Search, X } from "lucide-react";
import { FTO_ROLES } from "@/lib/constants";
import { SHIFT_BANDS } from "@/lib/shifts";
import { departmentTag } from "@/lib/departments";
import {
  STATUS_FILTERS,
  hasActiveFilters,
  EMPTY_FILTERS,
  type RosterDepartment,
  type RosterFilters as Filters,
} from "@/lib/roster-shared";

const TONES = {
  red: "border-red-500/70 bg-red-600/15 text-white",
  sky: "border-sky-500/70 bg-sky-500/15 text-sky-200",
  amber: "border-amber-500/70 bg-amber-500/15 text-amber-200",
} as const;

function Chip({
  active,
  onClick,
  tone = "red",
  children,
}: {
  active: boolean;
  onClick: () => void;
  tone?: keyof typeof TONES;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors ${
        active ? TONES[tone] : "border-[#24242c] bg-[#0e0e14] text-gray-500 hover:border-[#34343e] hover:text-gray-200"
      }`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-1 hidden h-5 w-px bg-[#24242c] sm:block" />;
}

export function RosterFilters({
  filters,
  onChange,
  departments,
  showShift,
  shownCount,
  totalCount,
}: {
  filters: Filters;
  onChange: (patch: Partial<Filters>) => void;
  departments: RosterDepartment[];
  /** Shift picks are member-only data, so the row only appears for members. */
  showShift: boolean;
  shownCount: number;
  totalCount: number;
}) {
  const toggle = (key: keyof Filters, value: string) => onChange({ [key]: filters[key] === value ? "" : value });

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-600" />
        <input
          type="search"
          value={filters.q}
          onChange={(e) => onChange({ q: e.target.value })}
          placeholder={
            showShift ? "Search by name, call sign, rank or Discord ID..." : "Search by name, call sign or rank..."
          }
          className="w-full rounded-xl border border-[#1c1c24] bg-[#0e0e14] py-3.5 pl-11 pr-4 text-sm text-white placeholder-gray-600 transition-colors focus:border-red-600/50 focus:outline-none"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Chip active={!filters.dept} onClick={() => onChange({ dept: "" })}>
          All
        </Chip>
        {departments.map((dept) => (
          <Chip key={dept.id} active={filters.dept === dept.id} onClick={() => toggle("dept", dept.id)}>
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: dept.color }} />
            {departmentTag(dept)}
          </Chip>
        ))}
        <Divider />
        <Chip active={!filters.status} onClick={() => onChange({ status: "" })}>
          All Status
        </Chip>
        {STATUS_FILTERS.map((status) => (
          <Chip key={status} active={filters.status === status} onClick={() => toggle("status", status)}>
            {status}
          </Chip>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {showShift && (
          <>
            <span className="mr-1 text-[10px] font-bold uppercase tracking-[0.2em] text-gray-600">Shift</span>
            <Chip tone="sky" active={!filters.shift} onClick={() => onChange({ shift: "" })}>
              All Shifts
            </Chip>
            {SHIFT_BANDS.map((band) => (
              <Chip key={band.key} tone="sky" active={filters.shift === band.key} onClick={() => toggle("shift", band.key)}>
                <span title={band.hours}>{band.label}</span>
              </Chip>
            ))}
            <Chip tone="sky" active={filters.shift === "none"} onClick={() => toggle("shift", "none")}>
              No Shift
            </Chip>
            <Divider />
          </>
        )}
        <span className="mr-1 text-[10px] font-bold uppercase tracking-[0.2em] text-gray-600">FTO</span>
        <Chip tone="amber" active={!filters.fto} onClick={() => onChange({ fto: "" })}>
          All FTO
        </Chip>
        {FTO_ROLES.map((role) => (
          <Chip key={role} tone="amber" active={filters.fto === role} onClick={() => toggle("fto", role)}>
            {role}
          </Chip>
        ))}
      </div>

      {hasActiveFilters(filters) && (
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span>
            Showing <span className="font-semibold text-gray-300">{shownCount}</span> of {totalCount} personnel
          </span>
          <button
            type="button"
            onClick={() => onChange(EMPTY_FILTERS)}
            className="inline-flex items-center gap-1 text-red-400 hover:text-red-300"
          >
            <X className="h-3.5 w-3.5" />
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
}
