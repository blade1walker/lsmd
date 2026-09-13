"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { fetchJson, errorMessage } from "@/lib/fetch-json";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  User,
  Hash,
  Building2,
  Activity,
  Calendar,
  TrendingUp,
  Clock,
  FileText,
  ClipboardCheck,
} from "lucide-react";
import ActivityPill from "@/components/ActivityPill";
import { EMS_TRAINING, overallProgress, phaseProgress, type EmsProgress } from "@/lib/training";

interface MemberProfileData {
  member: {
    id: string;
    name: string;
    callSign: string | null;
    rank: string;
    activity: string;
    dept: string;
    category: string | null;
    tempRank: string | null;
    dateOfJoining: string | null;
    lastPromotion: string | null;
    section: { id: string; name: string } | null;
  };
  trainingRecord: {
    emsProgress: EmsProgress;
  };
  clockEntries: Array<{
    id: string;
    clockInAt: string;
    clockOutAt: string | null;
    durationSec: number | null;
  }>;
  loaHistory: Array<{
    id: string;
    reason: string;
    startDate: string;
    endDate: string;
    status: string;
    notes: string | null;
    createdAt: string;
  }>;
}

function formatDuration(sec: number | null): string {
  if (!sec) return "—";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

export default function MemberProfilePage() {
  const params = useParams();
  const memberId = params.memberId as string;
  const [data, setData] = useState<MemberProfileData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchJson<MemberProfileData>(`/api/members/${memberId}/profile`));
    } catch (err) {
      console.error("Failed to load profile:", err);
      setError(errorMessage(err));
      setData(null);
    }
    setLoading(false);
  }, [memberId]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  if (loading) {
    return (
      <div>
        <Skeleton className="h-8 w-48 mb-6" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl lg:col-span-2" />
        </div>
      </div>
    );
  }

  if (!data?.member) {
    return (
      <div>
        <Link
          href="/admin/roster"
          className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Roster
        </Link>
        <ErrorState
          title="Failed to load member profile"
          message={error ?? "This member could not be found."}
          onRetry={fetchProfile}
        />
      </div>
    );
  }

  const { member, trainingRecord } = data;
  const clockEntries = data.clockEntries ?? [];
  const loaHistory = data.loaHistory ?? [];

  const progress = trainingRecord.emsProgress;
  const overall = overallProgress(progress);

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/admin/roster"
          className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Roster
        </Link>
        <h1 className="font-[family-name:var(--font-oswald)] text-2xl font-bold text-white uppercase">
          {member.name}
        </h1>
        {member.callSign && (
          <p className="text-gray-500 text-sm mt-1 font-[family-name:var(--font-mono)]">
            #{member.callSign}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Member Info Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#111118] border border-[#1e1e28] rounded-xl p-6"
        >
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-red-600/80 to-red-600/40 flex items-center justify-center text-[#0a0a0a] font-bold text-lg">
              {member.name.split(" ").map((n) => n[0]).join("")}
            </div>
            <div>
              <h2 className="text-white font-bold text-lg">{member.name}</h2>
              <p className="text-gray-400 text-sm">{member.rank}</p>
            </div>
          </div>

          <div className="space-y-3">
            <InfoRow icon={User} label="Rank" value={member.rank} />
            {member.callSign && <InfoRow icon={Hash} label="Call Sign" value={`#${member.callSign}`} mono />}
            <InfoRow icon={Building2} label="Department" value={member.dept} />
            {member.section && <InfoRow icon={Building2} label="Section" value={member.section.name} />}
            <InfoRow icon={Activity} label="Status" value={member.activity} custom={<ActivityPill activity={member.activity} />} />
            {member.category && <InfoRow icon={FileText} label="Category" value={member.category} />}
            {member.tempRank && <InfoRow icon={TrendingUp} label="Temp Rank" value={member.tempRank} />}
            {member.dateOfJoining && (
              <InfoRow
                icon={Calendar}
                label="Join Date"
                value={new Date(member.dateOfJoining).toLocaleDateString()}
              />
            )}
            {member.lastPromotion && (
              <InfoRow
                icon={TrendingUp}
                label="Last Promotion"
                value={new Date(member.lastPromotion).toLocaleDateString()}
              />
            )}
          </div>
        </motion.div>

        {/* Training Record */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-[#111118] border border-[#1e1e28] rounded-xl p-6 lg:col-span-2"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-[family-name:var(--font-oswald)] text-lg font-bold text-white uppercase">
              EMS Training Record
            </h2>
            <span className="text-sm text-gray-400">
              {overall.done}/{overall.total} completed
            </span>
          </div>

          {/* Progress bar */}
          <div className="h-2 bg-[#1e1e28] rounded-full overflow-hidden mb-5">
            <div
              className="h-full bg-gradient-to-r from-green-600 to-green-500 rounded-full transition-all"
              style={{ width: `${overall.percent}%` }}
            />
          </div>

          <div className="space-y-5">
            {EMS_TRAINING.map((phase) => {
              const stats = phaseProgress(phase, progress);
              return (
                <div key={phase.key}>
                  <div className="mb-2 flex items-baseline justify-between">
                    <h3 className="text-xs font-bold text-gray-400 uppercase">{phase.title}</h3>
                    <span className="text-[11px] text-gray-600">
                      {stats.done}/{stats.total}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {phase.checkpoints.map((item) => {
                      const mark = progress.checkpoints[item.key];
                      return (
                        <div
                          key={item.key}
                          title={item.description}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                            mark ? "bg-green-500/10" : "bg-[#0a0a0f]"
                          }`}
                        >
                          <ClipboardCheck
                            className={`w-4 h-4 shrink-0 ${mark ? "text-green-500" : "text-gray-600"}`}
                          />
                          <div className="min-w-0">
                            <div className={`text-xs font-medium ${mark ? "text-green-400" : "text-gray-400"}`}>
                              {item.label}
                            </div>
                            {mark && (
                              <div className="text-[10px] text-gray-600 truncate">
                                Signed by {mark.by ?? "unknown"}
                                {mark.at && ` · ${new Date(mark.at).toLocaleDateString()}`}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {(phase.counters ?? []).map((counter) => {
                      const value = progress.counters[counter.key] ?? 0;
                      const met = value >= counter.target;
                      return (
                        <div
                          key={counter.key}
                          className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg ${
                            met ? "bg-green-500/10" : "bg-[#0a0a0f]"
                          }`}
                        >
                          <span className={`text-xs font-medium ${met ? "text-green-400" : "text-gray-400"}`}>
                            {counter.label}
                          </span>
                          <span className="font-[family-name:var(--font-mono)] text-xs text-gray-500">
                            {value}/{counter.target}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Clock History */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-[#111118] border border-[#1e1e28] rounded-xl p-6"
        >
          <h2 className="font-[family-name:var(--font-oswald)] text-lg font-bold text-white uppercase mb-4">
            Clock History
          </h2>
          {clockEntries.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">No clock entries</div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {clockEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between p-3 bg-[#0a0a0f] rounded-lg"
                >
                  <div>
                    <div className="text-xs text-white">
                      {new Date(entry.clockInAt).toLocaleDateString()}{" "}
                      <span className="text-gray-400">
                        {new Date(entry.clockInAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    {entry.clockOutAt && (
                      <div className="text-[10px] text-gray-600">
                        → {new Date(entry.clockOutAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    )}
                  </div>
                  <span className="text-xs font-bold text-red-500 font-[family-name:var(--font-oswald)]">
                    {formatDuration(entry.durationSec)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* LOA History */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-[#111118] border border-[#1e1e28] rounded-xl p-6"
        >
          <h2 className="font-[family-name:var(--font-oswald)] text-lg font-bold text-white uppercase mb-4">
            LOA History
          </h2>
          {loaHistory.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">No LOA records</div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {loaHistory.map((loa) => (
                <div
                  key={loa.id}
                  className="p-3 bg-[#0a0a0f] rounded-lg"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-white font-medium">{loa.reason}</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full ${
                        loa.status === "Approved"
                          ? "bg-green-500/20 text-green-400"
                          : loa.status === "Pending"
                          ? "bg-yellow-500/20 text-yellow-400"
                          : loa.status === "Active"
                          ? "bg-blue-500/20 text-blue-400"
                          : "bg-gray-500/20 text-gray-400"
                      }`}
                    >
                      {loa.status}
                    </span>
                  </div>
                  <div className="text-[10px] text-gray-500">
                    {new Date(loa.startDate).toLocaleDateString()} — {new Date(loa.endDate).toLocaleDateString()}
                  </div>
                  {loa.notes && (
                    <div className="text-[10px] text-gray-600 mt-1">{loa.notes}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  mono,
  custom,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  mono?: boolean;
  custom?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-gray-500 text-xs">
        <Icon className="w-3.5 h-3.5" />
        {label}
      </div>
      {custom ?? (
        <span
          className={`text-xs text-gray-300 ${mono ? "font-[family-name:var(--font-mono)]" : ""}`}
        >
          {value}
        </span>
      )}
    </div>
  );
}
