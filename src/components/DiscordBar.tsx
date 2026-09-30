"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { StarOfLife } from "./roster/StarOfLife";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/roster", label: "Roster" },
  { href: "/sop", label: "SOP" },
  { href: "/radio-codes", label: "Radio Codes" },
  { href: "/training", label: "Training" },
] as const;

export function DiscordBar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <header className="sticky top-0 z-50 bg-[#0a0a0a]/95 backdrop-blur border-b border-[#1e1e1e]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-3">
            <StarOfLife className="h-9 w-9" />
            <div className="leading-tight">
              <div className="font-[family-name:var(--font-oswald)] text-white font-semibold text-base uppercase tracking-[0.12em]">
                Los Santos EMS
              </div>
              <div className="text-gray-500 text-[10px] font-semibold uppercase tracking-[0.3em] hidden sm:block">
                Nexus Universe
              </div>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  isActive(item.href) ? "text-white bg-white/10" : "text-gray-400 hover:text-white hover:bg-white/5"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <Link
              href="/admin/login"
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
            >
              EMS Staff Login
            </Link>
          </div>

          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
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
                {NAV.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`px-4 py-2 text-sm font-medium rounded-lg ${
                      isActive(item.href) ? "text-white bg-white/10" : "text-gray-400 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
                <Link
                  href="/admin/login"
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg text-center mt-2"
                >
                  EMS Staff Login
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
}
