"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { ErrorState } from "@/components/ui/error-state";
import RankInsignia from "@/components/RankInsignia";
import { fetchList, errorMessage } from "@/lib/fetch-json";
import { TRAINEE_RANKS } from "@/lib/constants";
import { GraduationCap, Search } from "lucide-react";

interface Trainee {
  id: string;
  name: string;
  callSign: string | null;
  rank: string;
  activity: string;
  startDate: string;
  /** True when the member has no joining date and startDate is when their roster row was created. */
  startDateEstimated: boolean;
  daysInDepartment: number;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function AdminTraineesPage() {
  const [trainees, setTrainees] = useState<Trainee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const fetchData = useCallback(async () => {
    setError(null);
    try {
      setTrainees(await fetchList<Trainee>("/api/trainees"));
    } catch (err) {
      setError(errorMessage(err));
      setTrainees([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return trainees;
    return trainees.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.callSign && t.callSign.toLowerCase().includes(q)) ||
        t.rank.toLowerCase().includes(q)
    );
  }, [trainees, search]);

  const stats = useMemo(() => {
    if (trainees.length === 0) return { count: 0, average: 0, longest: 0 };
    const days = trainees.map((t) => t.daysInDepartment);
    return {
      count: trainees.length,
      average: Math.round(days.reduce((a, b) => a + b, 0) / days.length),
      longest: Math.max(...days),
    };
  }, [trainees]);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="text-gray-500">Loading trainees...</div></div>;
  }

  if (error) {
    return <ErrorState title="Failed to load trainees" message={error} onRetry={fetchData} />;
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-[family-name:var(--font-oswald)] text-2xl font-bold text-white uppercase flex items-center gap-2">
          <GraduationCap className="w-6 h-6 text-[#dc2626]" />
          Trainees
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Everyone on the roster currently ranked {TRAINEE_RANKS.join(" or ")}. Change a trainee&apos;s rank on the
          roster and they leave this list automatically.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {[
          { label: "Trainees", value: stats.count.toString() },
          { label: "Average days in EMS", value: stats.average.toString() },
          { label: "Longest serving", value: `${stats.longest} day${stats.longest === 1 ? "" : "s"}` },
        ].map((tile) => (
          <div key={tile.label} className="bg-[#111111] border border-[#1e1e1e] rounded-xl p-4">
            <div className="text-xs uppercase tracking-wider text-gray-500">{tile.label}</div>
            <div className="font-[family-name:var(--font-oswald)] text-2xl font-bold text-white mt-1">{tile.value}</div>
          </div>
        ))}
      </div>

      <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl overflow-hidden">
        <div className="p-3 border-b border-[#1e1e1e]">
          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, call sign or rank..."
              className="pl-8 h-9 text-sm"
            />
          </div>
        </div>

        {trainees.length === 0 ? (
          <p className="p-6 text-sm text-gray-500">There are no trainees on the roster right now.</p>
        ) : filtered.length === 0 ? (
          <p className="p-6 text-sm text-gray-500">No trainees match this search.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1e1e1e]">
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">Name</th>
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">Current Role</th>
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">Joining Date</th>
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">Days in EMS</th>
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr key={t.id} className="border-b border-[#1e1e1e]/50 hover:bg-white/5">
                    <td className="py-3 px-4">
                      <Link href={`/admin/roster/${t.id}`} className="text-white hover:text-[#dc2626]">
                        {t.name}
                      </Link>
                      {t.callSign && (
                        <span className="ml-2 font-[family-name:var(--font-mono)] text-xs text-gray-500">{t.callSign}</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-2 text-gray-300">
                        <RankInsignia rank={t.rank} size={13} />
                        {t.rank}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-400">
                      {formatDate(t.startDate)}
                      {t.startDateEstimated && (
                        <span
                          className="ml-2 text-[10px] uppercase tracking-wider text-yellow-500/80"
                          title="No joining date on the roster — counted from when they were added"
                        >
                          added
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-[family-name:var(--font-mono)] text-white">{t.daysInDepartment}</span>
                      <span className="text-gray-500 text-xs ml-1">day{t.daysInDepartment === 1 ? "" : "s"}</span>
                    </td>
                    <td className="py-3 px-4 text-gray-400 text-xs">{t.activity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
