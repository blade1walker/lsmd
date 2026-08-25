"use client";

import { DiscordBar } from "@/components/DiscordBar";
import { Footer } from "@/components/Footer";
import { motion } from "framer-motion";

interface TrainingRecord {
  id: string;
  memberId: string;
  member: {
    name: string;
    callSign: string;
    rank: string;
    ftoRole: string;
  };
  coc: boolean;
  pcrs: boolean;
  useOfForce: boolean;
  situationResponding: boolean;
  legalKnowledge: boolean;
  basicConstitution: boolean;
  radioEtiquette: boolean;
  reportProcessing: boolean;
  negotiationTraining: boolean;
  hostageHandling: boolean;
  trafficStopTraining: boolean;
  ticketIssuing: boolean;
  pursuit: boolean;
  phase2SignOff: boolean;
  phase3SignOff: boolean;
}

interface TrainingPageClientProps {
  records: TrainingRecord[];
}

function ProgressBar({ label, completed, total }: { label: string; completed: number; total: number }) {
  const pct = total > 0 ? (completed / total) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-400">{label}</span>
        <span className="text-xs text-gray-500">
          {completed}/{total}
        </span>
      </div>
      <div className="w-full h-2 bg-[#1e1e1e] rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-[#dc2626] to-[#b91c1c] rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function TrainingPageClient({ records }: TrainingPageClientProps) {
  const trainees = records.filter((r) => {
    const rank = r.member.rank;
    return rank === "Medical Intern" || rank === "EMR" || rank === "EMT";
  });

  return (
    <div className="flex flex-col min-h-screen">
      <DiscordBar />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
        <div className="mb-8">
          <h1 className="font-[family-name:var(--font-oswald)] text-3xl font-bold text-white uppercase">
            Training Portal
          </h1>
          <p className="text-gray-500 text-sm mt-2">
            Track trainee progress and FTO sign-offs
          </p>
        </div>

        {trainees.length === 0 ? (
          <div className="text-center py-16 bg-[#111111] border border-[#1e1e1e] rounded-xl">
            <div className="text-gray-500 text-lg mb-2">No active trainees</div>
            <div className="text-gray-600 text-sm">
              Trainees will appear here once added to the roster
            </div>
          </div>
        ) : (
          <div className="grid gap-6">
            {trainees.map((record, index) => {
              const phase1Completed = [
                record.coc,
                record.pcrs,
                record.useOfForce,
                record.situationResponding,
              ].filter(Boolean).length;

              const phase2Completed = [
                record.legalKnowledge,
                record.basicConstitution,
                record.radioEtiquette,
                record.reportProcessing,
              ].filter(Boolean).length;

              const phase3Completed = [
                record.negotiationTraining,
                record.hostageHandling,
                record.trafficStopTraining,
                record.ticketIssuing,
                record.pursuit,
              ].filter(Boolean).length;

              return (
                <motion.div
                  key={record.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-[#111111] border border-[#1e1e1e] rounded-xl p-6"
                >
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#dc2626] to-[#b91c1c] flex items-center justify-center text-black font-bold text-sm">
                      {record.member.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </div>
                    <div>
                      <h3 className="text-white font-semibold">
                        {record.member.name}
                      </h3>
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <span className="font-[family-name:var(--font-mono)]">
                          {record.member.callSign}
                        </span>
                        <span>•</span>
                        <span>{record.member.rank}</span>
                      </div>
                    </div>
                    {record.member.ftoRole && (
                      <span className="ml-auto px-2 py-1 bg-[#dc2626]/10 text-[#dc2626] text-xs rounded-md border border-[#dc2626]/20">
                        {record.member.ftoRole}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium text-gray-300 uppercase tracking-wider">
                        Cadet Phase 1
                      </h4>
                      <ProgressBar
                        label="Phase 1 Progress"
                        completed={phase1Completed}
                        total={4}
                      />
                    </div>

                    <div className="space-y-3">
                      <h4 className="text-sm font-medium text-gray-300 uppercase tracking-wider">
                        Cadet Phase 2
                      </h4>
                      <ProgressBar
                        label="Phase 2 Progress"
                        completed={phase2Completed}
                        total={4}
                      />
                    </div>

                    <div className="space-y-3">
                      <h4 className="text-sm font-medium text-gray-300 uppercase tracking-wider">
                        Cadet Phase 3
                      </h4>
                      <ProgressBar
                        label="Phase 3 Progress"
                        completed={phase3Completed}
                        total={5}
                      />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
