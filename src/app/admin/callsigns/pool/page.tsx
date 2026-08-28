"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { ChevronLeft, Hash } from "lucide-react";
import { ErrorState } from "@/components/ui/error-state";
import { fetchList, errorMessage } from "@/lib/fetch-json";
import {
  CALLSIGN_MIN,
  CALLSIGN_MAX,
  CALLSIGN_FLOOR,
  CALLSIGN_CEILING,
  isReservedCallSign,
} from "@/lib/constants";
import { toast } from "sonner";

interface Member {
  id: string;
  name: string;
  callSign: string | null;
  rank: string;
}

interface Section {
  members: Member[];
}

export default function CallsignPoolPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setError(null);
    try {
      const sections = await fetchList<Section>("/api/members");
      setMembers(sections.flatMap((s) => s.members ?? []));
    } catch (err) {
      setError(errorMessage(err));
      setMembers([]);
      toast.error("Failed to load roster");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // A call sign can legitimately be held by more than one member if it was
  // assigned manually, so map to a list rather than a single holder.
  const holders = useMemo(() => {
    const map = new Map<string, Member[]>();
    for (const m of members) {
      if (!m.callSign) continue;
      const list = map.get(m.callSign);
      if (list) list.push(m);
      else map.set(m.callSign, [m]);
    }
    return map;
  }, [members]);

  const slots = useMemo(
    () =>
      Array.from({ length: CALLSIGN_MAX - CALLSIGN_MIN + 1 }, (_, i) => {
        const n = CALLSIGN_MIN + i;
        const cs = String(n);
        const taken = holders.get(cs) ?? [];
        return { n, cs, taken, reserved: isReservedCallSign(n) };
      }),
    [holders]
  );

  const availableCount = slots.filter((s) => !s.reserved && s.taken.length === 0).length;
  const takenCount = slots.filter((s) => !s.reserved && s.taken.length > 0).length;
  const reservedCount = slots.filter((s) => s.reserved).length;
  const nextUp = slots.find((s) => !s.reserved && s.taken.length === 0);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="text-gray-500">Loading call sign pool...</div></div>;
  }

  if (error) {
    return <ErrorState title="Failed to load call sign pool" message={error} onRetry={fetchData} />;
  }

  return (
    <div>
      <Link href="/admin/callsigns" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white mb-4">
        <ChevronLeft className="w-4 h-4" />
        Back to Call Signs
      </Link>

      <div className="mb-6">
        <h1 className="font-[family-name:var(--font-oswald)] text-2xl font-bold text-white uppercase flex items-center gap-2">
          <Hash className="w-6 h-6 text-[#dc2626]" />
          Call Sign Pool
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          {CALLSIGN_MIN}&ndash;{CALLSIGN_MAX}. New members are assigned the lowest available number
          in {CALLSIGN_FLOOR}&ndash;{CALLSIGN_CEILING}; a call sign returns to the pool as soon as it is freed.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4 mb-6 text-sm">
        <span className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm bg-green-500/20 border border-green-500/40" />
          <span className="text-gray-400">{availableCount} available</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm bg-red-500/20 border border-red-500/40" />
          <span className="text-gray-400">{takenCount} in use</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm bg-[#1a1a1a] border border-[#2a2a2a]" />
          <span className="text-gray-400">{reservedCount} reserved</span>
        </span>
        {nextUp && (
          <span className="ml-auto text-gray-500">
            Next assigned: <span className="font-[family-name:var(--font-mono)] text-green-400">{nextUp.cs}</span>
          </span>
        )}
      </div>

      <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl p-4">
        <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2">
          {slots.map(({ n, cs, taken, reserved }) => {
            const inUse = taken.length > 0;
            const title = reserved
              ? `${cs} — reserved`
              : inUse
                ? `${cs} — ${taken.map((m) => `${m.name} (${m.rank})`).join(", ")}`
                : `${cs} — available`;

            return (
              <div
                key={n}
                title={title}
                className={`rounded-md border px-1 py-2 text-center ${
                  reserved
                    ? "bg-[#1a1a1a] border-[#2a2a2a] text-gray-600"
                    : inUse
                      ? "bg-red-500/10 border-red-500/30 text-red-400"
                      : "bg-green-500/10 border-green-500/30 text-green-400"
                }`}
              >
                <div className="font-[family-name:var(--font-mono)] text-sm">{cs}</div>
                <div className="text-[10px] leading-tight truncate mt-0.5 text-gray-500">
                  {reserved ? "reserved" : inUse ? taken[0].name : "free"}
                </div>
                {taken.length > 1 && (
                  <div className="text-[10px] leading-tight text-red-300">+{taken.length - 1} dup</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
