"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Timer } from "lucide-react";
import { formatHours, type ViewerDuty } from "@/lib/roster-shared";
import { useNow, elapsedSeconds } from "./DutyStatus";

/**
 * The signed-in member's own duty clock. Until this, the clock routes existed
 * but nothing on the site called them, so no one could clock on and every
 * hours column read "—".
 */
export function DutyCard({ memberId, name, duty }: { memberId: string; name: string | null; duty: ViewerDuty }) {
  const router = useRouter();
  const now = useNow();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDuty = duty.onDutySince !== null;
  const running = onDuty && now !== null ? elapsedSeconds(duty.onDutySince!, now) : 0;

  const toggle = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(onDuty ? "/api/clock/out" : "/api/clock/in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Could not update your duty status");
      }
      // Re-renders the page on the server, so the Duty column, the On Duty
      // count and this card all agree afterwards.
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update your duty status");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={`flex flex-wrap items-center gap-4 rounded-xl border px-5 py-4 ${
        onDuty ? "border-emerald-600/40 bg-emerald-600/[0.06]" : "border-[#1c1c24] bg-[#0e0e14]"
      }`}
    >
      <span
        className={`flex h-10 w-10 items-center justify-center rounded-full ${
          onDuty ? "bg-emerald-500/15 text-emerald-400" : "bg-white/5 text-gray-500"
        }`}
      >
        <Timer className="h-5 w-5" />
      </span>

      <div className="min-w-[180px] flex-1">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500">
          Your Duty{name ? ` · ${name}` : ""}
        </div>
        <div className={`mt-0.5 text-sm font-semibold ${onDuty ? "text-emerald-300" : "text-gray-300"}`}>
          {onDuty ? `On duty${now !== null ? ` for ${formatHours(running)}` : ""}` : "Off duty"}
        </div>
      </div>

      <div className="flex gap-6 text-xs">
        <div>
          <div className="uppercase tracking-wider text-gray-600">Today</div>
          <div className="font-[family-name:var(--font-mono)] text-gray-200">{formatHours(duty.todaySeconds + running)}</div>
        </div>
        <div>
          <div className="uppercase tracking-wider text-gray-600">All time</div>
          <div className="font-[family-name:var(--font-mono)] text-gray-200">{formatHours(duty.totalSeconds + running)}</div>
        </div>
      </div>

      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        className={`rounded-lg px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white transition-colors disabled:opacity-60 ${
          onDuty ? "bg-[#26262f] hover:bg-[#32323c]" : "bg-red-600 hover:bg-red-700"
        }`}
      >
        {busy ? "…" : onDuty ? "Clock Out" : "Clock In"}
      </button>

      {error && <p className="w-full text-xs text-red-400">{error}</p>}
    </div>
  );
}
