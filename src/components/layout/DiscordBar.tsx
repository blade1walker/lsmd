"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { BrandLogo, useSiteContent } from "./SiteContentProvider";

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
  const { text } = useSiteContent();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <header className="sticky top-0 z-50 bg-[#0a0a0a]/95 pt-[env(safe-area-inset-top)] backdrop-blur border-b border-[#1e1e1e]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <BrandLogo className="h-9 w-9 shrink-0" />
            <div className="min-w-0 whitespace-nowrap leading-tight">
              <div className="font-[family-name:var(--font-oswald)] text-white font-semibold text-base uppercase tracking-[0.12em]">
                {text("brand.name")}
              </div>
              <div className="text-gray-500 text-[10px] font-semibold uppercase tracking-[0.3em] hidden sm:block">
                {text("brand.community")}
              </div>
            </div>
          </Link>

          <nav className="hidden lg:flex items-center gap-1">
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

          <div className="hidden lg:flex items-center gap-3">
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
            className="lg:hidden -mr-2 p-2.5 text-gray-400 hover:text-white"
          >
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

          {mobileOpen && (
            <div
              className="lg:hidden pb-4 border-t border-[#1e1e1e] mt-2 pt-4 animate-fade-up [--fade-up-y:-10px]"
            >
              <div className="flex flex-col gap-2">
                {NAV.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`px-4 py-3 text-base font-medium rounded-lg ${
                      isActive(item.href) ? "text-white bg-white/10" : "text-gray-400 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
                <Link
                  href="/admin/login"
                  onClick={() => setMobileOpen(false)}
                  className="px-4 py-3 text-base font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg text-center mt-2"
                >
                  EMS Staff Login
                </Link>
              </div>
            </div>
          )}
      </div>
    </header>
  );
}
