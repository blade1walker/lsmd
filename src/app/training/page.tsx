"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useSession, signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { DiscordBar } from "@/components/DiscordBar";
import { Footer } from "@/components/Footer";
import RankInsignia from "@/components/RankInsignia";
import { fetchList, errorMessage } from "@/lib/fetch-json";
import { getRankWeight } from "@/lib/constants";
import { EMS_TRAINING, overallProgress, phaseProgress, type TrainingSummaryRow } from "@/lib/training";

/** Medical Intern, EMR and EMT — the ranks still working through the curriculum. */
const TRAINEE_MAX_WEIGHT = getRankWeight("EMT");

function Bar({ percent }: { percent: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#1e1e1e]">
      <div
        className="h-full rounded-full bg-gradient-to-r from-[#dc2626] to-[#b91c1c] transition-all"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

/**
 * The Training Portal: every trainee's progress through the EMS curriculum.
 *
 * Previously this read `cadetProgress` from /api/training/summary, a field that
 * route never returned, so the page threw as soon as there was a trainee to
 * show. It now reads the EMS progress the route actually sends.
 */
export default function TrainingPage() {
  const { data: session, status } = useSession();
  const [rows, setRows] = useState<TrainingSummaryRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetchList<TrainingSummaryRow>("/api/training/summary")
      .then(setRows)
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [status]);

  const trainees = useMemo(
    () =>
      rows
        .filter((row) => {
          const weight = getRankWeight(row.member.rank);
          return weight >= 1 && weight <= TRAINEE_MAX_WEIGHT;
        })
        .map((row) => ({ row, overall: overallProgress(row.progress) }))
        .sort((a, b) => b.overall.percent - a.overall.percent || a.row.member.name.localeCompare(b.row.member.name)),
    [rows]
  );

  const canOpenAdmin =
    !!session?.user && (session.user.isSuperAdmin || (session.user.permissions ?? []).includes("training.view"));

  if (status === "unauthenticated") {
    return (
      <div className="flex min-h-screen flex-col">
        <DiscordBar />
        <main className="flex flex-1 items-center justify-center p-6">
          <div className="text-center">
            <h1 className="mb-4 font-[family-name:var(--font-oswald)] text-2xl font-bold uppercase text-white">
              Training Portal
            </h1>
            <p className="mb-6 text-gray-500">Sign in with Discord to see training progress.</p>
            <Button onClick={() => signIn("discord")} className="bg-[#5865F2] hover:bg-[#4752C4]">
              Sign in with Discord
            </Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <DiscordBar />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-[family-name:var(--font-oswald)] text-3xl font-bold uppercase text-white">Training Portal</h1>
            <p className="mt-2 text-sm text-gray-500">Trainee progress through the EMS curriculum.</p>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/cadet" className="text-red-400 hover:text-red-300">
              My progress →
            </Link>
            {canOpenAdmin && (
              <Link href="/admin/training" className="text-gray-400 hover:text-white">
                Manage training →
              </Link>
            )}
          </div>
        </div>

        {status === "loading" || loading ? (
          <div className="py-16 text-center text-gray-500">Loading...</div>
        ) : error ? (
          <div className="rounded-xl border border-[#1e1e1e] bg-[#111111] py-16 text-center">
            <div className="mb-2 text-lg text-gray-400">Training progress isn&apos;t available to you</div>
            <div className="text-sm text-gray-600">{error}</div>
          </div>
        ) : trainees.length === 0 ? (
          <div className="rounded-xl border border-[#1e1e1e] bg-[#111111] py-16 text-center">
            <div className="mb-2 text-lg text-gray-500">No active trainees</div>
            <div className="text-sm text-gray-600">Medical Interns, EMRs and EMTs appear here once they are on the roster.</div>
          </div>
        ) : (
          <div className="grid gap-4">
            {trainees.map(({ row, overall }) => (
              <div key={row.memberId} className="rounded-xl border border-[#1e1e1e] bg-[#111111] p-6">
                <div className="mb-5 flex flex-wrap items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#dc2626] to-[#b91c1c] text-sm font-bold text-black">
                    {row.member.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 3)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-semibold text-white">{row.member.name}</h3>
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <span className="font-[family-name:var(--font-mono)]">{row.member.callSign ?? "—"}</span>
                      <span>•</span>
                      <RankInsignia rank={row.member.rank} size={12} />
                      <span>{row.member.rank}</span>
                    </div>
                  </div>
                  {row.member.ftoRole && (
                    <span className="rounded-md border border-[#dc2626]/20 bg-[#dc2626]/10 px-2 py-1 text-xs text-[#dc2626]">
                      {row.member.ftoRole}
                    </span>
                  )}
                  <div className="w-full sm:w-48">
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="text-gray-400">Overall</span>
                      <span className={overall.percent >= 100 ? "text-green-400" : "text-gray-300"}>{overall.percent}%</span>
                    </div>
                    <Bar percent={overall.percent} />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                  {EMS_TRAINING.map((phase) => {
                    const stats = phaseProgress(phase, row.progress);
                    return (
                      <div key={phase.key}>
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <span className="truncate text-xs text-gray-400">{phase.title}</span>
                          <span className="text-xs text-gray-500">
                            {stats.done}/{stats.total}
                          </span>
                        </div>
                        <Bar percent={stats.total ? Math.round((stats.done / stats.total) * 100) : 0} />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
