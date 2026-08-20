"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { CheckCircle, Circle, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface TrainingRecord {
  id: string;
  memberId: string;
  member: {
    name: string;
    callSign: string;
    rank: string;
  };
  coc: boolean;
  cocBy: string;
  pcrs: boolean;
  pcrsBy: string;
  useOfForce: boolean;
  useOfForceBy: string;
  situationResponding: boolean;
  situationRespondingBy: string;
  legalKnowledge: boolean;
  legalKnowledgeBy: string;
  basicConstitution: boolean;
  basicConstitutionBy: string;
  radioEtiquette: boolean;
  radioEtiquetteBy: string;
  reportProcessing: boolean;
  reportProcessingBy: string;
  negotiationTraining: boolean;
  negotiationTrainingBy: string;
  hostageHandling: boolean;
  hostageHandlingBy: string;
  trafficStopTraining: boolean;
  trafficStopTrainingBy: string;
  ticketIssuing: boolean;
  ticketIssuingBy: string;
  pursuit: boolean;
  pursuitBy: string;
  phase2SignOff: boolean;
  phase2SignedBy: string;
  phase3SignOff: boolean;
  phase3SignedBy: string;
}

export default function AdminTrainingPage() {
  const [records, setRecords] = useState<TrainingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRecord, setEditingRecord] = useState<TrainingRecord | null>(null);
  const [signedBy, setSignedBy] = useState("");

  const fetchRecords = async () => {
    try {
      const res = await fetch("/api/training/summary");
      const data = await res.json();
      setRecords(data);
    } catch (error) {
      console.error("Error fetching records:", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  const handleToggleCheckpoint = async (
    recordId: string,
    field: string,
    currentValue: boolean
  ) => {
    try {
      await fetch(`/api/training/${recordId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          [field]: !currentValue,
          [`${field}By`]: signedBy || "Admin",
        }),
      });
      fetchRecords();
    } catch (error) {
      console.error("Error updating checkpoint:", error);
    }
  };

  const handlePhaseSignOff = async (
    recordId: string,
    phase: number,
    currentValue: boolean
  ) => {
    try {
      await fetch(`/api/training/${recordId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          [`phase${phase}SignOff`]: !currentValue,
          [`phase${phase}SignedBy`]: signedBy || "Admin",
          [`phase${phase}SignedAt`]: new Date().toISOString(),
        }),
      });
      fetchRecords();
    } catch (error) {
      console.error("Error signing off phase:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading training records...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-[family-name:var(--font-oswald)] text-2xl font-bold text-white uppercase">
            Training Management
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Manage trainee progress and checkpoints
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-gray-400 text-sm">Signed by:</Label>
          <Input
            value={signedBy}
            onChange={(e) => setSignedBy(e.target.value)}
            placeholder="Your call sign"
            className="w-32 bg-[#0a0a0a] border-[#1e1e1e]"
          />
        </div>
      </div>

      <div className="grid gap-6">
        {records.map((record, index) => (
          <motion.div
            key={record.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="bg-[#111111] border border-[#1e1e1e] rounded-xl p-6"
          >
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#eab308] to-[#ca8a04] flex items-center justify-center text-black font-bold text-sm">
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
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditingRecord(record)}
                className="ml-auto text-gray-400 hover:text-white"
              >
                <Edit className="w-4 h-4" />
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <h4 className="text-sm font-medium text-[#eab308] uppercase tracking-wider mb-3">
                  Phase 1
                </h4>
                <div className="space-y-2">
                  {[
                    { label: "COC", field: "coc", by: record.cocBy },
                    { label: "PCRS", field: "pcrs", by: record.pcrsBy },
                    { label: "Use of Force", field: "useOfForce", by: record.useOfForceBy },
                    { label: "Situation Responding", field: "situationResponding", by: record.situationRespondingBy },
                  ].map(({ label, field, by }) => (
                    <button
                      key={field}
                      onClick={() =>
                        handleToggleCheckpoint(
                          record.id,
                          field,
                          (record as any)[field]
                        )
                      }
                      className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-white/5 transition-colors text-left"
                    >
                      {(record as any)[field] ? (
                        <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                      ) : (
                        <Circle className="w-4 h-4 text-gray-600 shrink-0" />
                      )}
                      <span className="text-sm text-gray-300">{label}</span>
                      {by && (
                        <span className="ml-auto text-xs text-gray-600">
                          {by}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-[#eab308] uppercase tracking-wider mb-3">
                  Phase 2
                </h4>
                <div className="space-y-2">
                  {[
                    { label: "Legal Knowledge", field: "legalKnowledge", by: record.legalKnowledgeBy },
                    { label: "Basic Constitution", field: "basicConstitution", by: record.basicConstitutionBy },
                    { label: "Radio Etiquette", field: "radioEtiquette", by: record.radioEtiquetteBy },
                    { label: "Report Processing", field: "reportProcessing", by: record.reportProcessingBy },
                  ].map(({ label, field, by }) => (
                    <button
                      key={field}
                      onClick={() =>
                        handleToggleCheckpoint(
                          record.id,
                          field,
                          (record as any)[field]
                        )
                      }
                      className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-white/5 transition-colors text-left"
                    >
                      {(record as any)[field] ? (
                        <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                      ) : (
                        <Circle className="w-4 h-4 text-gray-600 shrink-0" />
                      )}
                      <span className="text-sm text-gray-300">{label}</span>
                      {by && (
                        <span className="ml-auto text-xs text-gray-600">
                          {by}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-[#eab308] uppercase tracking-wider mb-3">
                  Phase 3
                </h4>
                <div className="space-y-2">
                  {[
                    { label: "Negotiation", field: "negotiationTraining", by: record.negotiationTrainingBy },
                    { label: "Hostage Handling", field: "hostageHandling", by: record.hostageHandlingBy },
                    { label: "Traffic Stops", field: "trafficStopTraining", by: record.trafficStopTrainingBy },
                    { label: "Ticket Issuing", field: "ticketIssuing", by: record.ticketIssuingBy },
                    { label: "Pursuit", field: "pursuit", by: record.pursuitBy },
                  ].map(({ label, field, by }) => (
                    <button
                      key={field}
                      onClick={() =>
                        handleToggleCheckpoint(
                          record.id,
                          field,
                          (record as any)[field]
                        )
                      }
                      className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-white/5 transition-colors text-left"
                    >
                      {(record as any)[field] ? (
                        <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                      ) : (
                        <Circle className="w-4 h-4 text-gray-600 shrink-0" />
                      )}
                      <span className="text-sm text-gray-300">{label}</span>
                      {by && (
                        <span className="ml-auto text-xs text-gray-600">
                          {by}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
