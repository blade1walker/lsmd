"use client";

import { motion } from "framer-motion";

interface SectionHeaderProps {
  name: string;
  count: number;
  isOpen: boolean;
  onToggle: () => void;
}

export function SectionHeader({ name, count, isOpen, onToggle }: SectionHeaderProps) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center gap-3 mb-4 px-1 py-2 hover:bg-white/5 rounded-lg transition-colors"
    >
      <div className="w-1 h-6 rounded-full bg-gradient-to-b from-[#eab308] to-[#ca8a04]" />
      <h2 className="font-[family-name:var(--font-oswald)] text-xl font-semibold text-white uppercase tracking-wide text-left">
        {name}
      </h2>
      <span className="text-sm text-gray-500">
        ({count} {count === 1 ? "member" : "members"})
      </span>
      <div className="flex-1 h-px bg-[#1e1e1e]" />
      <motion.span
        animate={{ rotate: isOpen ? 180 : 0 }}
        className="text-gray-500"
      >
        ▼
      </motion.span>
    </button>
  );
}
