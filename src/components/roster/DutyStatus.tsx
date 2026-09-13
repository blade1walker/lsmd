"use client";

import { useSyncExternalStore } from "react";
import { formatHours } from "@/lib/roster-shared";

function subscribe(onTick: () => void) {
  const id = setInterval(onTick, 30_000);
  return () => clearInterval(id);
}

// Rounded to the minute so the snapshot is stable between renders — React
// requires getSnapshot to return the same value until something changes.
const getSnapshot = (): number | null => Math.floor(Date.now() / 60_000) * 60_000;
const getServerSnapshot = (): number | null => null;

/**
 * The current minute, or null during server rendering and hydration.
 *
 * Elapsed-time text cannot be rendered on the server: it would already be
 * stale by the time the browser hydrated it, and React would flag the
 * mismatch. Null first, then the real clock, keeps both passes identical.
 */
export function useNow(): number | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function elapsedSeconds(since: string, now: number): number {
  return Math.max(0, Math.floor((now - Date.parse(since)) / 1000));
}

export function DutyStatus({ since }: { since: string | null }) {
  const now = useNow();
  if (!since) return <span className="text-gray-600">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold text-emerald-400">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
      On duty
      {now !== null && <span className="font-normal text-gray-500">· {formatHours(elapsedSeconds(since, now))}</span>}
    </span>
  );
}
