"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface TrainingRecord {
  id: string;
  memberId: string;
  member?: { name: string; callSign?: string | null };
  [key: string]: unknown;
}

interface TrainingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberId: string | null;
}

export default function TrainingModal({ open, onOpenChange, memberId }: TrainingModalProps) {
  const [record, setRecord] = useState<TrainingRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [remarkText, setRemarkText] = useState("");

  const fetchRecord = useCallback(async () => {
    if (!memberId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/training/${memberId}`);
      const data = await res.json();
      setRecord(data);
    } catch (err) {
      console.error("Failed to fetch training record:", err);
    } finally {
      setLoading(false);
    }
  }, [memberId]);

  useEffect(() => {
    if (open && memberId) fetchRecord();
  }, [open, memberId, fetchRecord]);

  const updateCheckpoint = async (field: string, value: boolean | string | number) => {
    if (!memberId) return;
    await fetch(`/api/training/${memberId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    setRecord((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const addRemark = async () => {
    if (!memberId || !remarkText.trim()) return;
    await fetch(`/api/training/${memberId}/remarks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: remarkText, authorCallSign: "Admin" }),
    });
    setRemarkText("");
    fetchRecord();
  };

  const checkpoints = [
    { label: "COC", field: "cadetPhase1COC" },
    { label: "PCRS", field: "cadetPhase1PCRS" },
    { label: "Use of Force", field: "cadetPhase1UoF" },
    { label: "Situation Responding", field: "cadetPhase1Situation" },
    { label: "Legal Knowledge", field: "cadetPhase2Legal" },
    { label: "Basic Constitution", field: "cadetPhase2Constitution" },
    { label: "Radio Etiquette", field: "cadetPhase2Radio" },
    { label: "Report Processing", field: "cadetPhase2Report" },
    { label: "Negotiation Training", field: "cadetPhase3Negotiation" },
    { label: "Hostage Handling", field: "cadetPhase3Hostage" },
    { label: "Traffic Stop Training", field: "cadetPhase3Traffic" },
    { label: "Ticket Issuing", field: "cadetPhase3Ticket" },
    { label: "Pursuit", field: "cadetPhase3Pursuit" },
    { label: "Probationary Negotiation", field: "probationaryNegotiation" },
    { label: "Probationary Communication", field: "probationaryCommunication" },
    { label: "Recommendation", field: "probationaryRecommendation" },
    { label: "Theory", field: "probationaryTheory" },
    { label: "Practical", field: "probationaryPractical" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Training Record — {record?.member?.name ?? "Loading..."}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-gray-500">Loading...</div>
        ) : record ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              {checkpoints.map((cp) => (
                <label key={cp.field} className="flex items-center gap-3 p-3 rounded-lg border border-[#1e1e1e] hover:bg-white/5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!record[cp.field]}
                    onChange={(e) => updateCheckpoint(cp.field, e.target.checked)}
                    className="w-4 h-4 rounded border-gray-600 bg-transparent"
                  />
                  <span className="text-sm text-gray-300">{cp.label}</span>
                </label>
              ))}
            </div>

            <div className="space-y-2">
              <Label>Report Number</Label>
              <Input
                value={(record.probationaryReportNumber as string) ?? ""}
                onChange={(e) => updateCheckpoint("probationaryReportNumber", e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Traffic Stops ({record.probationaryTrafficStops as number ?? 0}/4)</Label>
                <Input
                  type="number"
                  min={0}
                  max={10}
                  value={(record.probationaryTrafficStops as number) ?? 0}
                  onChange={(e) => updateCheckpoint("probationaryTrafficStops", parseInt(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label>MDT Reports ({record.probationaryMDTReports as number ?? 0}/3)</Label>
                <Input
                  type="number"
                  min={0}
                  max={10}
                  value={(record.probationaryMDTReports as number) ?? 0}
                  onChange={(e) => updateCheckpoint("probationaryMDTReports", parseInt(e.target.value) || 0)}
                />
              </div>
            </div>

            <div className="border-t border-[#1e1e1e] pt-4">
              <Label className="mb-2 block">Remarks</Label>
              <div className="space-y-2 mb-3">
                {((record.remarks as Array<{ id: string; content: string; authorCallSign?: string | null }>) ?? []).map((r) => (
                  <div key={r.id} className="p-2 bg-white/5 rounded text-sm text-gray-300">
                    <span className="text-gold font-medium">{r.authorCallSign ?? "Admin"}:</span> {r.content}
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Textarea
                  value={remarkText}
                  onChange={(e) => setRemarkText(e.target.value)}
                  placeholder="Add a remark..."
                  className="min-h-[60px]"
                />
                <Button size="sm" onClick={addRemark} disabled={!remarkText.trim()}>
                  Add
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-gray-500">No training record found</div>
        )}
      </DialogContent>
    </Dialog>
  );
}
