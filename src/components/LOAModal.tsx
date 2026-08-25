"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface LOAModalProps {
  isOpen: boolean;
  onClose: () => void;
  memberId?: string;
}

export function LOAModal({ isOpen, onClose, memberId }: LOAModalProps) {
  const [reason, setReason] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!reason || !startDate || !endDate) return;

    setLoading(true);
    try {
      await fetch("/api/loa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId,
          reason,
          startDate,
          endDate,
        }),
      });
      onClose();
      setReason("");
      setStartDate("");
      setEndDate("");
    } catch (error) {
      console.error("Error submitting LOA:", error);
    }
    setLoading(false);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="w-full max-w-md bg-[#111111] border border-[#1e1e1e] rounded-xl p-6"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-red-500" />
              <h2 className="font-[family-name:var(--font-oswald)] text-lg font-bold text-white uppercase">
                Apply for LOA
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-white rounded-lg hover:bg-white/10"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <Label className="text-gray-400 text-sm">Reason</Label>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Enter reason for LOA..."
                className="mt-1 bg-[#0a0a0a] border-[#1e1e1e]"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-400 text-sm">Start Date</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="mt-1 bg-[#0a0a0a] border-[#1e1e1e]"
                />
              </div>
              <div>
                <Label className="text-gray-400 text-sm">End Date</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="mt-1 bg-[#0a0a0a] border-[#1e1e1e]"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={onClose}
                className="flex-1 border-[#1e1e1e] text-gray-400"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={loading || !reason || !startDate || !endDate}
                className="flex-1 bg-red-600 text-white hover:bg-red-700"
              >
                {loading ? "Submitting..." : "Submit"}
              </Button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
