"use client";

import React from "react";
import { DEFAULT_RANK_COLOR, getRankInfo, type RankLayout, type RankShape } from "@/lib/constants";

interface RankInsigniaProps {
  /** Draws this rank's badge as set in Admin → Ranks. */
  rank?: string;
  /** Or draw a badge directly (the Ranks editor's preview). */
  shape?: RankShape;
  count?: number;
  color?: string | null;
  layout?: RankLayout;
  size?: number;
}

/** Rows of a pyramid, top first: 3 → 1+2, 4 → 1+3, 5 → 2+3. */
function rowsFor(layout: RankLayout, count: number): number[] {
  if (layout === "stack") return Array.from({ length: count }, () => 1);
  if (layout === "pyramid" && count >= 3) {
    const bottom = Math.ceil(count / 2) + (count === 4 ? 1 : 0);
    return [count - bottom, bottom];
  }
  return [count];
}

export default function RankInsignia({ rank, shape, count, color, layout, size = 16 }: RankInsigniaProps) {
  const info = rank && !shape ? getRankInfo(rank) : null;
  const finalShape = shape ?? info?.shape ?? "none";
  const finalCount = count ?? info?.count ?? 0;
  const fill = color ?? info?.color ?? DEFAULT_RANK_COLOR;
  const arrangement = layout ?? info?.layout ?? "row";

  if (finalShape === "none" || finalCount <= 0) return null;

  const itemSize = size * 0.6;
  const gap = 2;
  const cell = itemSize + gap;
  // Chevrons and bars are short, so stacked ones sit closer together.
  const rowHeight = finalShape === "chevron" || finalShape === "bar" ? itemSize * 0.55 + gap : cell;
  const rows = rowsFor(arrangement, finalCount);
  const width = Math.max(...rows) * cell;
  const height = Math.max(size, rows.length * rowHeight + (size - rowHeight));

  const points: { x: number; y: number }[] = [];
  rows.forEach((n, r) => {
    const offset = (width - n * cell) / 2;
    const y = height / 2 + (r - (rows.length - 1) / 2) * rowHeight;
    for (let i = 0; i < n; i++) points.push({ x: offset + i * cell + itemSize / 2 + gap / 2, y });
  });

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {points.map(({ x, y }, i) => {
        if (finalShape === "pip") {
          return <circle key={i} cx={x} cy={y} r={itemSize / 2} fill={fill} opacity={0.9} />;
        }
        if (finalShape === "chevron") {
          const p = `${x - itemSize / 2},${y + itemSize / 3} ${x},${y - itemSize / 3} ${x + itemSize / 2},${y + itemSize / 3}`;
          return <polyline key={i} points={p} stroke={fill} strokeWidth={1.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />;
        }
        if (finalShape === "bar") {
          return <rect key={i} x={x - itemSize / 2} y={y - itemSize / 6} width={itemSize} height={itemSize / 3} rx={1} fill={fill} opacity={0.9} />;
        }
        if (finalShape === "star") {
          const r = itemSize / 2;
          const p = Array.from({ length: 5 })
            .map((_, j) => {
              const angle = (j * 72 - 90) * (Math.PI / 180);
              const innerAngle = (j * 72 + 36 - 90) * (Math.PI / 180);
              return `${x + r * Math.cos(angle)},${y + r * Math.sin(angle)} ${x + r * 0.4 * Math.cos(innerAngle)},${y + r * 0.4 * Math.sin(innerAngle)}`;
            })
            .join(" ");
          return <polygon key={i} points={p} fill={fill} opacity={0.9} />;
        }
        return null;
      })}
    </svg>
  );
}

export { RankInsignia };
