"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function DiscordBar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-[#0a0a0a]/95 backdrop-blur border-b border-[#1e1e1e]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-red-600 to-red-700 flex items-center justify-center">
              <span className="font-[family-name:var(--font-oswald)] text-white font-bold text-lg">
                N
              </span>
            </div>
            <div>
              <span className="font-[family-name:var(--font-oswald)] text-white font-semibold text-lg tracking-wide">
                NEXUS
              </span>
              <span className="text-gray-500 text-sm ml-2 hidden sm:inline">
                Universe
              </span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-1">
            <a
              href="/"
              className="px-4 py-2 text-sm font-medium text-white bg-white/10 rounded-lg transition-colors"
            >
              Roster
            </a>
            <a
              href="/sop"
              className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
            >
              SOP
            </a>
            <a
              href="/radio-codes"
              className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
            >
              Radio Codes
            </a>
            <a
              href="/training"
              className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
            >
              Training
            </a>
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <a
              href="/admin/login"
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
            >
              Admin Login
            </a>
          </div>

          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 text-gray-400 hover:text-white"
          >
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden pb-4 border-t border-[#1e1e1e] mt-2 pt-4"
            >
              <div className="flex flex-col gap-2">
                <a href="/" className="px-4 py-2 text-sm font-medium text-white bg-white/10 rounded-lg">
                  Roster
                </a>
                <a href="/sop" className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 rounded-lg">
                  SOP
                </a>
                <a href="/radio-codes" className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 rounded-lg">
                  Radio Codes
                </a>
                <a href="/training" className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 rounded-lg">
                  Training
                </a>
                <a href="/admin/login" className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg text-center mt-2">
                  Admin Login
                </a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
}
