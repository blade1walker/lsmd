"use client";

import React from "react";

interface IconBadgeProps {
  unit?: string;
}

export default function IconBadge({ unit }: IconBadgeProps) {
  if (!unit) return null;
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-white/5 text-gray-400 rounded text-xs">
      {unit}
    </span>
  );
}
