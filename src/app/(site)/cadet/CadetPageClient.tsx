"use client";

import { DiscordBar } from "@/components/DiscordBar";
import { Footer } from "@/components/Footer";
import { motion } from "framer-motion";
import { CheckCircle2, Circle } from "lucide-react";
import { EMS_TRAINING, overallProgress, parseEmsProgress, phaseProgress } from "@/lib/training";

interface CadetMember {
  name: string;
  callSign: string | null;
  rank: string;
  trainingRecord: {
    emsProgress: unknown;
    remarks: { id: string; content: string; authorCallSign: string | null; createdAt: string | Date }[];
  } | null;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** From UTC fields, so the server render and the browser render produce the same text. */
function formatDay(value: string | Date): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/**
 * A member's own training progress. Shows the whole curriculum, with what
 * each skill covers, whether or not they have a record yet — it doubles as
 * the study guide for what comes next.
 */
export function CadetPageClient({ member }: { member: CadetMember | null }) {
  if (!member) {
    return (
      <div className="flex min-h-screen flex-col">
        <DiscordBar />
        <main className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <div className="mb-2 text-lg text-gray-500">Member not found</div>
            <div className="text-sm text-gray-600">Your Discord account is not linked to a roster member</div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const progress = parseEmsProgress(member.trainingRecord?.emsProgress);
  const overall = overallProgress(progress);
  const remarks = [...(member.trainingRecord?.remarks ?? [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <div className="flex min-h-screen flex-col">
      <DiscordBar />

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="font-[family-name:var(--font-oswald)] text-3xl font-bold uppercase text-white">Training Progress</h1>
          <p className="mt-2 text-sm text-gray-500">
            {member.name}
            {member.callSign ? ` (${member.callSign})` : ""} — {member.rank}
          </p>
        </div>

        <div className="mb-8 rounded-xl border border-[#1e1e1e] bg-[#111111] p-6">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-sm font-semibold uppercase tracking-wider text-gray-300">EMS Curriculum</span>
            <span className="text-sm text-gray-400">
              {overall.done}/{overall.total} complete · <span className="text-white">{overall.percent}%</span>
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[#1e1e28]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-green-600 to-green-500"
              style={{ width: `${overall.percent}%` }}
            />
          </div>
          {overall.done === 0 && (
            <p className="mt-3 text-xs text-gray-500">
              Nothing signed off yet. A trainer signs each skill off once you have shown it — the list below is what you
              will be assessed on.
            </p>
          )}
        </div>

        <div className="space-y-6">
          {EMS_TRAINING.map((phase, index) => {
            const stats = phaseProgress(phase, progress);
            return (
              <motion.section
                key={phase.key}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="rounded-xl border border-[#1e1e1e] bg-[#111111] p-6"
              >
                <div className="mb-1 flex items-baseline justify-between gap-4">
                  <h2 className="font-[family-name:var(--font-oswald)] text-lg font-bold uppercase text-white">{phase.title}</h2>
                  <span className="text-sm text-gray-500">
                    {stats.done}/{stats.total}
                  </span>
                </div>
                <p className="mb-4 text-sm text-gray-500">{phase.subtitle}</p>

                <div className="grid gap-2">
                  {phase.checkpoints.map((cp) => {
                    const mark = progress.checkpoints[cp.key];
                    return (
                      <div
                        key={cp.key}
                        className={`flex items-start gap-3 rounded-lg p-3 ${mark ? "bg-green-500/5" : "bg-[#0a0a0a]"}`}
                      >
                        {mark ? (
                          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-400" />
                        ) : (
                          <Circle className="mt-0.5 h-5 w-5 shrink-0 text-gray-600" />
                        )}
                        <div className="flex-1">
                          <div className={`text-sm font-medium ${mark ? "text-white" : "text-gray-300"}`}>{cp.label}</div>
                          <div className="mt-0.5 text-xs text-gray-500">{cp.description}</div>
                          {mark && (
                            <div className="mt-1 text-xs text-green-400/80">
                              Signed off by {mark.by ?? "a trainer"}
                              {mark.at && ` · ${formatDay(mark.at)}`}
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
                        className={`flex items-center gap-3 rounded-lg p-3 ${met ? "bg-green-500/5" : "bg-[#0a0a0a]"}`}
                      >
                        {met ? (
                          <CheckCircle2 className="h-5 w-5 shrink-0 text-green-400" />
                        ) : (
                          <Circle className="h-5 w-5 shrink-0 text-gray-600" />
                        )}
                        <span className={`flex-1 text-sm font-medium ${met ? "text-white" : "text-gray-300"}`}>
                          {counter.label}
                        </span>
                        <span className={`font-[family-name:var(--font-mono)] text-sm ${met ? "text-green-400" : "text-gray-500"}`}>
                          {value}/{counter.target}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </motion.section>
            );
          })}

          {remarks.length > 0 && (
            <section className="rounded-xl border border-[#1e1e1e] bg-[#111111] p-6">
              <h2 className="mb-4 font-[family-name:var(--font-oswald)] text-lg font-bold uppercase text-white">
                Trainer Remarks
              </h2>
              <ul className="space-y-3">
                {remarks.map((remark) => (
                  <li key={remark.id} className="rounded-lg bg-[#0a0a0a] p-3">
                    <div className="text-sm text-gray-300">{remark.content}</div>
                    <div className="mt-1 text-xs text-gray-600">
                      {remark.authorCallSign ?? "Trainer"} · {formatDay(remark.createdAt)}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
