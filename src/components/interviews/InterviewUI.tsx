"use client";

import { RESULT_STYLES, STATUS_STYLES, scoreColor } from "@/lib/interviews";
import { cn } from "@/lib/utils";

/**
 * The small, repeated pieces of the Promotion & Interview section — the status
 * chips, the score meter and the stat tiles. Shared between the dashboard, the
 * session page and Promotion History so one interview reads the same wherever
 * it appears.
 */

export function ResultBadge({ result, className }: { result: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider",
        RESULT_STYLES[result] ?? "bg-gray-500/10 text-gray-400 border-gray-500/20",
        className
      )}
    >
      {result}
    </span>
  );
}

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider",
        STATUS_STYLES[status] ?? "bg-gray-500/10 text-gray-400 border-gray-500/20",
        className
      )}
    >
      {status}
    </span>
  );
}

export function EligibilityBadge({ eligible }: { eligible: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider",
        eligible
          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
          : "bg-red-500/10 text-red-400 border-red-500/20"
      )}
    >
      {eligible ? "Eligible for Promotion" : "Not Yet Eligible"}
    </span>
  );
}

/**
 * A 0-100 score as a bar plus the number. The passing score is drawn as a
 * notch on the track, so a reader sees how far off a score is without having
 * to hold the threshold in their head.
 */
export function ScoreBar({
  score,
  passingScore,
  label,
  floor,
}: {
  score: number | null;
  passingScore: number;
  label?: string;
  /** The category's own minimum, drawn instead of the passing score when given. */
  floor?: number;
}) {
  const mark = floor ?? passingScore;
  return (
    <div>
      {label && (
        <div className="mb-1 flex items-baseline justify-between gap-2">
          <span className="text-xs text-gray-400">{label}</span>
          <span className={cn("font-[family-name:var(--font-oswald)] text-sm font-bold", scoreColor(score, mark))}>
            {score === null ? "—" : `${score}%`}
          </span>
        </div>
      )}
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-[#1e1e28]">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            score === null
              ? "bg-gray-700"
              : score >= mark
                ? "bg-emerald-500"
                : score >= mark - 10
                  ? "bg-amber-500"
                  : "bg-red-500"
          )}
          style={{ width: `${score ?? 0}%` }}
        />
        <div
          className="absolute top-0 h-full w-px bg-white/40"
          style={{ left: `${mark}%` }}
          title={`Minimum ${mark}%`}
        />
      </div>
    </div>
  );
}

export function StatTile({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="rounded-xl border border-[#1e1e1e] bg-[#111111] p-4">
      <div className="text-xs uppercase tracking-wider text-gray-500">{label}</div>
      <div
        className={cn(
          "mt-1 font-[family-name:var(--font-oswald)] text-2xl font-bold",
          tone ?? "text-white"
        )}
      >
        {value}
      </div>
    </div>
  );
}
