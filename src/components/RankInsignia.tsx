"use client";

import React from "react";

interface RankInsigniaProps {
  shape?: "none" | "pip" | "chevron" | "bar" | "star";
  count?: number;
  rank?: string;
  size?: number;
}

function getRankFromName(rank: string): { shape: string; count: number } {
  const map: Record<string, { shape: string; count: number }> = {
    "Director of Medicine": { shape: "star", count: 4 },
    "Chief of EMS": { shape: "star", count: 3 },
    "Deputy Chief of EMS": { shape: "star", count: 2 },
    "Assistant Chief": { shape: "star", count: 1 },
    "Division Chief": { shape: "bar", count: 2 },
    "EMS Captain": { shape: "bar", count: 1 },
    "Lieutenant": { shape: "chevron", count: 3 },
    "Senior Paramedic": { shape: "chevron", count: 2 },
    "Paramedic": { shape: "chevron", count: 1 },
    "EMT": { shape: "pip", count: 2 },
    "EMR": { shape: "pip", count: 1 },
    "Medical Intern": { shape: "none", count: 0 },
  };
  return map[rank] ?? { shape: "none", count: 0 };
}

export default function RankInsignia({ shape, count, rank, size = 16 }: RankInsigniaProps) {
  let finalShape = shape ?? "none";
  let finalCount = count ?? 0;

  if (rank && !shape) {
    const info = getRankFromName(rank);
    finalShape = info.shape as "none" | "pip" | "chevron" | "bar" | "star";
    finalCount = info.count;
  }

  if (finalShape === "none" || finalCount === 0) return null;

  const itemSize = size * 0.6;
  const gap = 2;
  const svgWidth = finalCount * (itemSize + gap);

  return (
    <svg
      width={svgWidth}
      height={size}
      viewBox={`0 0 ${svgWidth} ${size}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {Array.from({ length: finalCount }).map((_, i) => {
        const x = i * (itemSize + gap) + itemSize / 2;
        const y = size / 2;

        if (finalShape === "pip") {
          return <circle key={i} cx={x} cy={y} r={itemSize / 2} fill="#eab308" opacity={0.9} />;
        }
        if (finalShape === "chevron") {
          const points = `${x - itemSize / 2},${y + itemSize / 3} ${x},${y - itemSize / 3} ${x + itemSize / 2},${y + itemSize / 3}`;
          return <polyline key={i} points={points} stroke="#eab308" strokeWidth={1.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />;
        }
        if (finalShape === "bar") {
          return <rect key={i} x={x - itemSize / 2} y={y - itemSize / 6} width={itemSize} height={itemSize / 3} rx={1} fill="#eab308" opacity={0.9} />;
        }
        if (finalShape === "star") {
          const r = itemSize / 2;
          const points = Array.from({ length: 5 })
            .map((_, j) => {
              const angle = (j * 72 - 90) * (Math.PI / 180);
              const innerAngle = ((j * 72 + 36) - 90) * (Math.PI / 180);
              return `${x + r * Math.cos(angle)},${y + r * Math.sin(angle)} ${x + r * 0.4 * Math.cos(innerAngle)},${y + r * 0.4 * Math.sin(innerAngle)}`;
            })
            .join(" ");
          return <polygon key={i} points={points} fill="#eab308" opacity={0.9} />;
        }
        return null;
      })}
    </svg>
  );
}

export { RankInsignia };
