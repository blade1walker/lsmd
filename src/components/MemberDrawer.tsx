"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { RankInsignia } from "./RankInsignia";
import { ActivityPill } from "./ActivityPill";
import { DeptBadge } from "./DeptBadge";

interface MemberDrawerProps {
  member: any;
  onClose: () => void;
}

export function MemberDrawer({ member, onClose }: MemberDrawerProps) {
  if (!member) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          className="absolute right-0 top-0 h-full w-full max-w-md bg-[#111111] border-l border-[#1e1e1e] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-[family-name:var(--font-oswald)] text-xl font-bold text-white uppercase">
                Member Details
              </h2>
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#eab308] to-[#ca8a04] flex items-center justify-center text-black font-bold text-xl">
                  {member.name
                    .split(" ")
                    .map((n: string) => n[0])
                    .join("")}
                </div>
                <div>
                  <h3 className="text-white font-semibold text-lg">
                    {member.name}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <RankInsignia rank={member.rank} />
                    <span className="text-gray-400 text-sm">{member.rank}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#0a0a0a] rounded-lg p-4 border border-[#1e1e1e]">
                  <div className="text-xs text-gray-500 mb-1">Department</div>
                  <DeptBadge />
                </div>
                <div className="bg-[#0a0a0a] rounded-lg p-4 border border-[#1e1e1e]">
                  <div className="text-xs text-gray-500 mb-1">Status</div>
                  <ActivityPill activity={member.activity} />
                </div>
                <div className="bg-[#0a0a0a] rounded-lg p-4 border border-[#1e1e1e]">
                  <div className="text-xs text-gray-500 mb-1">Call Sign</div>
                  <div className="text-white font-[family-name:var(--font-mono)] text-sm">
                    {member.callSign ?? "N/A"}
                  </div>
                </div>
                <div className="bg-[#0a0a0a] rounded-lg p-4 border border-[#1e1e1e]">
                  <div className="text-xs text-gray-500 mb-1">Position</div>
                  <div className="text-white text-sm">
                    {member.position ?? "N/A"}
                  </div>
                </div>
              </div>

              {member.category && (
                <div className="bg-[#0a0a0a] rounded-lg p-4 border border-[#1e1e1e]">
                  <div className="text-xs text-gray-500 mb-1">Category</div>
                  <div className="text-white text-sm">{member.category}</div>
                </div>
              )}

              <div className="bg-[#0a0a0a] rounded-lg p-4 border border-[#1e1e1e]">
                <div className="text-xs text-gray-500 mb-2">Divisions</div>
                <div className="flex flex-wrap gap-2">
                  {member.ptd && (
                    <span className="px-2 py-1 bg-[#eab308]/10 text-[#eab308] text-xs rounded-md border border-[#eab308]/20">
                      PTD
                    </span>
                  )}
                  {member.hr && (
                    <span className="px-2 py-1 bg-blue-500/10 text-blue-400 text-xs rounded-md border border-blue-500/20">
                      HR
                    </span>
                  )}
                  {member.asd && (
                    <span className="px-2 py-1 bg-purple-500/10 text-purple-400 text-xs rounded-md border border-purple-500/20">
                      ASD
                    </span>
                  )}
                  {member.bike && (
                    <span className="px-2 py-1 bg-green-500/10 text-green-400 text-xs rounded-md border border-green-500/20">
                      Bike
                    </span>
                  )}
                  {member.speedUnit && (
                    <span className="px-2 py-1 bg-red-500/10 text-red-400 text-xs rounded-md border border-red-500/20">
                      Speed Unit
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
