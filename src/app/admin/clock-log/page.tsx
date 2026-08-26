"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { fetchList, errorMessage } from "@/lib/fetch-json";

interface ClockEntry {
  id: string;
  memberId: string;
  clockInAt: string;
  clockOutAt: string | null;
  durationSec: number | null;
  member: {
    name: string;
    callSign: string;
  };
}

export default function AdminClockLogPage() {
  const [entries, setEntries] = useState<ClockEntry[]>([]);
  const [totals, setTotals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setError(null);
    try {
      const [log, totalsList] = await Promise.all([
        fetchList<ClockEntry>("/api/clock/log"),
        fetchList<any>("/api/clock/totals"),
      ]);
      setEntries(log);
      setTotals(totalsList);
    } catch (err) {
      console.error("Error fetching data:", err);
      setError(errorMessage(err));
      setEntries([]);
      setTotals([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading clock log...</div>
      </div>
    );
  }

  if (error) {
    return <ErrorState title="Failed to load clock log" message={error} onRetry={fetchData} />;
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-[family-name:var(--font-oswald)] text-2xl font-bold text-white uppercase">
          Clock Log
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Track duty hours and clock sessions
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        <div className="lg:col-span-2 bg-[#111111] border border-[#1e1e1e] rounded-xl p-6">
          <h2 className="font-[family-name:var(--font-oswald)] text-lg font-bold text-white uppercase mb-4">
            Cumulative Hours
          </h2>
          <div className="space-y-3">
            {totals.length === 0 ? (
              <div className="text-gray-500 text-sm">No clock data</div>
            ) : (
              totals.slice(0, 10).map((t, i) => (
                <div
                  key={t.id}
                  className="flex items-center gap-4 p-3 bg-[#0a0a0a] rounded-lg"
                >
                  <span className="text-gray-500 text-sm w-6">#{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-sm">{t.name}</div>
                    <div className="text-xs text-gray-500 font-[family-name:var(--font-mono)]">
                      {t.callSign}
                    </div>
                  </div>
                  <span className="font-[family-name:var(--font-mono)] text-sm text-[#dc2626]">
                    {formatDuration(t.totalSeconds)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl p-6">
          <h2 className="font-[family-name:var(--font-oswald)] text-lg font-bold text-white uppercase mb-4">
            Summary
          </h2>
          <div className="space-y-4">
            <div className="p-4 bg-[#0a0a0a] rounded-lg text-center">
              <div className="text-2xl font-bold text-white font-[family-name:var(--font-oswald)]">
                {totals.length}
              </div>
              <div className="text-xs text-gray-500 mt-1">Members with Hours</div>
            </div>
            <div className="p-4 bg-[#0a0a0a] rounded-lg text-center">
              <div className="text-2xl font-bold text-[#dc2626] font-[family-name:var(--font-oswald)]">
                {formatDuration(
                  totals.reduce((sum: number, t: any) => sum + t.totalSeconds, 0)
                )}
              </div>
              <div className="text-xs text-gray-500 mt-1">Total Hours</div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#1e1e1e]">
          <h2 className="font-[family-name:var(--font-oswald)] text-lg font-bold text-white uppercase">
            Session Log
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1e1e1e]">
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">
                  Member
                </th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">
                  Clock In
                </th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">
                  Clock Out
                </th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">
                  Duration
                </th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    No clock entries
                  </td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <tr
                    key={entry.id}
                    className="border-b border-[#1e1e1e] hover:bg-white/5"
                  >
                    <td className="py-3 px-4">
                      <div className="text-white text-sm">{entry.member.name}</div>
                      <div className="text-xs text-gray-500 font-[family-name:var(--font-mono)]">
                        {entry.member.callSign}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-400">
                      {new Date(entry.clockInAt).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-400">
                      {entry.clockOutAt
                        ? new Date(entry.clockOutAt).toLocaleString()
                        : "-"}
                    </td>
                    <td className="py-3 px-4 font-[family-name:var(--font-mono)] text-sm text-gray-400">
                      {entry.durationSec
                        ? formatDuration(entry.durationSec)
                        : "-"}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs ${
                          entry.clockOutAt
                            ? "bg-gray-500/10 text-gray-400"
                            : "bg-green-500/10 text-green-400"
                        }`}
                      >
                        {entry.clockOutAt ? "Completed" : "Active"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
