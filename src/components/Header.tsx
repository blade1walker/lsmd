"use client";

import { useState } from "react";

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-[#0a0a0a]/95 backdrop-blur border-b border-[#1e1e1e]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center">
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
              href="#"
              className="px-4 py-2 text-sm font-medium text-white bg-white/10 rounded-lg transition-colors"
            >
              Roster
            </a>
            <a
              href="#"
              className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
            >
              Departments
            </a>
            <a
              href="#"
              className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
            >
              Regulations
            </a>
            <a
              href="#"
              className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
            >
              Contact
            </a>
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <a
              href="#"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              Join LSPD
            </a>
          </div>

          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 text-gray-400 hover:text-white"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {mobileOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>

        {mobileOpen && (
          <div className="md:hidden pb-4 border-t border-[#1e1e1e] mt-2 pt-4">
            <div className="flex flex-col gap-2">
              <a
                href="#"
                className="px-4 py-2 text-sm font-medium text-white bg-white/10 rounded-lg"
              >
                Roster
              </a>
              <a
                href="#"
                className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 rounded-lg"
              >
                Departments
              </a>
              <a
                href="#"
                className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 rounded-lg"
              >
                Regulations
              </a>
              <a
                href="#"
                className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 rounded-lg"
              >
                Contact
              </a>
              <a
                href="#"
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg text-center mt-2"
              >
                Join LSPD
              </a>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
