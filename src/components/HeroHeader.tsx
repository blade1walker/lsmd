"use client";

import { motion } from "framer-motion";

export function HeroHeader() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-[#eab308]/10 via-[#0a0a0a] to-[#0a0a0a]" />
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDM0djZoNnYtNmgtNnptMC0zMHY2aDZ2LTZoLTZ6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-50" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#eab308]/10 border border-[#eab308]/20 rounded-full mb-8">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-sm text-[#eab308] font-medium">
              Active Department
            </span>
          </div>

          <h1 className="font-[family-name:var(--font-oswald)] text-4xl sm:text-5xl md:text-7xl font-bold text-white mb-4 tracking-tight uppercase">
            Los Santos
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#eab308] to-[#ca8a04]">
              Medical Department
            </span>
          </h1>

          <p className="text-gray-400 text-lg sm:text-xl max-w-2xl mx-auto mb-10">
            Official Personnel Roster of the Emergency Medical Services
            <br />
            <span className="text-gray-500">Nexus Universe RP</span>
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="#roster"
              className="px-8 py-3 bg-[#eab308] hover:bg-[#ca8a04] text-black font-semibold rounded-lg transition-all hover:scale-105 text-sm"
            >
              View Full Roster
            </a>
            <a
              href="/loa"
              className="px-8 py-3 bg-white/5 hover:bg-white/10 text-white border border-white/10 font-semibold rounded-lg transition-all hover:scale-105 text-sm"
            >
              Request LOA
            </a>
            <a
              href="/uniform"
              className="px-8 py-3 bg-white/5 hover:bg-white/10 text-white border border-white/10 font-semibold rounded-lg transition-all hover:scale-105 text-sm"
            >
              Uniform Guide
            </a>
            <a
              href="/onboarding"
              className="px-8 py-3 bg-[#eab308]/20 hover:bg-[#eab308]/30 text-[#eab308] border border-[#eab308]/30 font-semibold rounded-lg transition-all hover:scale-105 text-sm"
            >
              Enroll in Roster
            </a>
            <a
              href="/sop"
              className="px-8 py-3 bg-white/5 hover:bg-white/10 text-white border border-white/10 font-semibold rounded-lg transition-all hover:scale-105 text-sm"
            >
              Standard Operating Procedures
            </a>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mt-16 max-w-3xl mx-auto">
            <div className="text-center">
              <div className="text-3xl font-bold text-white font-[family-name:var(--font-oswald)]">
                EMS
              </div>
              <div className="text-sm text-gray-500 mt-1">Department</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-white font-[family-name:var(--font-oswald)]">
                24/7
              </div>
              <div className="text-sm text-gray-500 mt-1">Duty Coverage</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-white font-[family-name:var(--font-oswald)]">
                EMS
              </div>
              <div className="text-sm text-gray-500 mt-1">Service Type</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-white font-[family-name:var(--font-oswald)]">
                GTA
              </div>
              <div className="text-sm text-gray-500 mt-1">Jurisdiction</div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
