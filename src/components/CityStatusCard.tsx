"use client";

import { useCallback, useEffect, useState } from "react";
import { Gamepad2, Plug } from "lucide-react";
import type { CityStatusPublic } from "@/lib/fivem";

/**
 * The FiveM server at a glance: up or down, how full, and how many EMS are in
 * the city. Loaded in the browser rather than with the page, so a slow or
 * unreachable game server never holds up the home page or the roster.
 *
 * Renders nothing until the City Link is set up, or when command has hidden
 * the server from the public.
 */
export function CityStatusCard({ variant = "wide" }: { variant?: "compact" | "wide" }) {
  const [status, setStatus] = useState<CityStatusPublic | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/fivem/status", { cache: "no-store" });
      if (res.ok) setStatus(await res.json());
    } catch {
      // Decoration — a failed read just leaves the card as it was.
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(() => load(), 0);
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 60_000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [load]);

  if (!status || !status.enabled || !status.configured) return null;

  const players =
    status.playerCount !== null ? `${status.playerCount}${status.maxPlayers ? ` / ${status.maxPlayers}` : ""} players` : null;
  const members = status.ems.members ?? [];

  if (variant === "compact") {
    return (
      <div className="mt-6 rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
        <div className="flex items-center gap-3">
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
              status.online ? "bg-emerald-500/15 text-emerald-400" : "bg-white/5 text-gray-500"
            }`}
          >
            <Gamepad2 className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.2em]">
              <span className={`h-1.5 w-1.5 rounded-full ${status.online ? "animate-pulse bg-emerald-400" : "bg-gray-600"}`} />
              <span className={status.online ? "text-emerald-300" : "text-gray-500"}>{status.online ? "City online" : "City offline"}</span>
            </div>
            <div className="truncate text-sm font-semibold text-white">{status.name ?? "FiveM server"}</div>
            {status.online && (
              <div className="text-xs text-gray-500">
                {players && <>{players} · </>}
                <span className="text-red-300">{status.ems.inCity} EMS in city</span>
              </div>
            )}
          </div>
          {status.connectUrl && status.online && (
            <a
              href={status.connectUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-white transition-colors hover:bg-red-700"
            >
              <Plug className="h-3.5 w-3.5" />
              Join
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#1c1c24] bg-[#0e0e14] px-5 py-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex min-w-[200px] flex-1 items-center gap-3">
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
              status.online ? "bg-emerald-500/15 text-emerald-400" : "bg-white/5 text-gray-500"
            }`}
          >
            <Gamepad2 className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500">
              {status.online ? "In the city now" : "City offline"}
            </div>
            <div className="truncate text-sm font-semibold text-white">{status.name ?? "FiveM server"}</div>
          </div>
        </div>
        {status.online && (
          <div className="flex gap-6 text-xs">
            {players && (
              <div>
                <div className="uppercase tracking-wider text-gray-600">Players</div>
                <div className="font-[family-name:var(--font-mono)] text-gray-200">{players.replace(" players", "")}</div>
              </div>
            )}
            <div>
              <div className="uppercase tracking-wider text-gray-600">EMS in city</div>
              <div className="font-[family-name:var(--font-mono)] text-red-300">{status.ems.inCity}</div>
            </div>
            <div>
              <div className="uppercase tracking-wider text-gray-600">On duty</div>
              <div className="font-[family-name:var(--font-mono)] text-emerald-300">{status.ems.onDuty}</div>
            </div>
          </div>
        )}
        {status.connectUrl && status.online && (
          <a
            href={status.connectUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white transition-colors hover:bg-red-700"
          >
            <Plug className="h-4 w-4" />
            Join the city
          </a>
        )}
      </div>

      {status.online && members.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5 border-t border-[#1c1c24] pt-3">
          {members.map((m) => (
            <li
              key={`${m.callSign}-${m.name}`}
              title={`${m.rank}${m.onDuty ? " · on duty" : ""}`}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${
                m.onDuty ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" : "border-[#26262f] bg-white/[0.03] text-gray-400"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${m.onDuty ? "bg-emerald-400" : "bg-gray-600"}`} />
              {m.callSign && <span className="font-[family-name:var(--font-mono)] font-bold">{m.callSign}</span>}
              {m.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
