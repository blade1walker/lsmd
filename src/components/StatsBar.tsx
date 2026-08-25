"use client";

import { motion } from "framer-motion";

interface StatsBarProps {
  total: number;
  active: number;
  reserve: number;
  loa: number;
}

export function StatsBar({ total, active, reserve, loa }: StatsBarProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8"
    >
      <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl p-4 text-center">
        <div className="text-2xl font-bold text-white font-[family-name:var(--font-oswald)]">
          {total}
        </div>
        <div className="text-xs text-gray-500 mt-1">Total Personnel</div>
      </div>
      <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl p-4 text-center">
        <div className="text-2xl font-bold text-green-400 font-[family-name:var(--font-oswald)]">
          {active}
        </div>
        <div className="text-xs text-gray-500 mt-1">Active</div>
      </div>
      <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl p-4 text-center">
        <div className="text-2xl font-bold text-red-400 font-[family-name:var(--font-oswald)]">
          {reserve}
        </div>
        <div className="text-xs text-gray-500 mt-1">Reserve</div>
      </div>
      <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl p-4 text-center">
        <div className="text-2xl font-bold text-red-400 font-[family-name:var(--font-oswald)]">
          {loa}
        </div>
        <div className="text-xs text-gray-500 mt-1">On LOA</div>
      </div>
    </motion.div>
  );
}
