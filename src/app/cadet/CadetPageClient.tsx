"use client";

import { DiscordBar } from "@/components/DiscordBar";
import { Footer } from "@/components/Footer";
import { motion } from "framer-motion";
import { CheckCircle, Circle } from "lucide-react";

interface CadetPageClientProps {
  member: any;
}

function CheckpointItem({ label, completed, signedBy }: { label: string; completed: boolean; signedBy?: string }) {
  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg ${completed ? "bg-green-500/5" : "bg-[#0a0a0a]"}`}>
      {completed ? (
        <CheckCircle className="w-5 h-5 text-green-400 shrink-0" />
      ) : (
        <Circle className="w-5 h-5 text-gray-600 shrink-0" />
      )}
      <div className="flex-1">
        <div className={`text-sm ${completed ? "text-white" : "text-gray-400"}`}>
          {label}
        </div>
        {signedBy && (
          <div className="text-xs text-gray-500 mt-0.5">
            Signed by: {signedBy}
          </div>
        )}
      </div>
    </div>
  );
}

export function CadetPageClient({ member }: CadetPageClientProps) {
  if (!member) {
    return (
      <div className="flex flex-col min-h-screen">
        <DiscordBar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-gray-500 text-lg mb-2">Member not found</div>
            <div className="text-gray-600 text-sm">
              Your Discord account is not linked to a roster member
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const record = member.trainingRecord;

  return (
    <div className="flex flex-col min-h-screen">
      <DiscordBar />

      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
        <div className="mb-8">
          <h1 className="font-[family-name:var(--font-oswald)] text-3xl font-bold text-white uppercase">
            Training Progress
          </h1>
          <p className="text-gray-500 text-sm mt-2">
            {member.name} ({member.callSign}) - {member.rank}
          </p>
        </div>

        {record ? (
          <div className="space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-[#111111] border border-[#1e1e1e] rounded-xl p-6"
            >
              <h2 className="font-[family-name:var(--font-oswald)] text-lg font-bold text-white uppercase mb-4">
                Cadet Phase 1
              </h2>
              <div className="grid gap-2">
                <CheckpointItem label="Code of Conduct (COC)" completed={record.coc} signedBy={record.cocBy} />
                <CheckpointItem label="PCRS Training" completed={record.pcrs} signedBy={record.pcrsBy} />
                <CheckpointItem label="Use of Force" completed={record.useOfForce} signedBy={record.useOfForceBy} />
                <CheckpointItem label="Situation Responding" completed={record.situationResponding} signedBy={record.situationRespondingBy} />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-[#111111] border border-[#1e1e1e] rounded-xl p-6"
            >
              <h2 className="font-[family-name:var(--font-oswald)] text-lg font-bold text-white uppercase mb-4">
                Cadet Phase 2
              </h2>
              <div className="grid gap-2">
                <CheckpointItem label="Legal Knowledge" completed={record.legalKnowledge} signedBy={record.legalKnowledgeBy} />
                <CheckpointItem label="Basic Constitution" completed={record.basicConstitution} signedBy={record.basicConstitutionBy} />
                <CheckpointItem label="Radio Etiquette" completed={record.radioEtiquette} signedBy={record.radioEtiquetteBy} />
                <CheckpointItem label="Report Processing" completed={record.reportProcessing} signedBy={record.reportProcessingBy} />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-[#111111] border border-[#1e1e1e] rounded-xl p-6"
            >
              <h2 className="font-[family-name:var(--font-oswald)] text-lg font-bold text-white uppercase mb-4">
                Cadet Phase 3
              </h2>
              <div className="grid gap-2">
                <CheckpointItem label="Negotiation Training" completed={record.negotiationTraining} signedBy={record.negotiationTrainingBy} />
                <CheckpointItem label="Hostage Handling" completed={record.hostageHandling} signedBy={record.hostageHandlingBy} />
                <CheckpointItem label="Traffic Stop Training" completed={record.trafficStopTraining} signedBy={record.trafficStopTrainingBy} />
                <CheckpointItem label="Ticket Issuing" completed={record.ticketIssuing} signedBy={record.ticketIssuingBy} />
                <CheckpointItem label="Pursuit" completed={record.pursuit} signedBy={record.pursuitBy} />
              </div>
            </motion.div>
          </div>
        ) : (
          <div className="text-center py-16 bg-[#111111] border border-[#1e1e1e] rounded-xl">
            <div className="text-gray-500 text-lg mb-2">No training record found</div>
            <div className="text-gray-600 text-sm">
              Your training record will be created by an administrator
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
