"use client";

import React from "react";

interface DeptBadgeProps {
  dept?: string;
}

function DeptBadgeInner({ dept = "EMS" }: DeptBadgeProps) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded-md text-xs font-semibold">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      {dept}
    </span>
  );
}

export default DeptBadgeInner;
export { DeptBadgeInner as DeptBadge };
