"use client";

import { useId } from "react";

/**
 * The Star of Life — the six-armed emblem EMS services carry worldwide, with
 * the Rod of Asclepius down the centre. Drawn inline because the project has
 * no logo asset, and it scales cleanly from a section badge to the hero mark.
 */
export function StarOfLife({ className = "" }: { className?: string }) {
  const gradient = useId();
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f87171" />
          <stop offset="1" stopColor="#b91c1c" />
        </linearGradient>
      </defs>
      {[0, 60, 120].map((angle) => (
        <rect
          key={angle}
          x="37"
          y="4"
          width="26"
          height="92"
          rx="3"
          fill={`url(#${gradient})`}
          transform={`rotate(${angle} 50 50)`}
        />
      ))}
      <rect x="47.5" y="20" width="5" height="62" rx="2.5" fill="#ffffff" />
      <path
        d="M50 27 c10 3 10 9 0 12 c-10 3 -10 9 0 12 c10 3 10 9 0 12 c-6 2 -7 6 -3 9"
        stroke="#ffffff"
        strokeWidth="3.2"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="50" cy="20" r="4" fill="#ffffff" />
    </svg>
  );
}
