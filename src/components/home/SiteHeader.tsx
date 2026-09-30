"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn, signOut } from "next-auth/react";
import { LayoutDashboard, LogOut, Menu, X } from "lucide-react";
import { StarOfLife } from "@/components/roster/StarOfLife";
import { UserNotificationBell } from "@/components/UserNotificationBell";
import type { RosterViewer } from "@/lib/roster-shared";

const NAV = [
  { href: "#applications", label: "Applications" },
  { href: "#members", label: "Members" },
  { href: "#resources", label: "Resources" },
  { href: "/roster", label: "Roster" },
] as const;

/** The landing page's top bar. Sign-in returns here, not to the panel. */
export function SiteHeader({ viewer }: { viewer: RosterViewer }) {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#08080c]/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-3">
          <StarOfLife className="h-9 w-9" />
          <div className="leading-tight">
            <div className="font-[family-name:var(--font-oswald)] text-base font-semibold uppercase tracking-[0.12em] text-white">
              Los Santos EMS
            </div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.3em] text-gray-500">Nexus Universe</div>
          </div>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3.5 py-2 text-sm font-medium text-gray-400 transition-colors hover:bg-white/5 hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Account viewer={viewer} />
        </div>

        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          className="rounded-md p-2 text-gray-400 hover:bg-white/5 hover:text-white md:hidden"
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-white/[0.06] px-4 pb-4 pt-2 md:hidden">
          <nav className="flex flex-col">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2.5 text-sm font-medium text-gray-300 hover:bg-white/5 hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-3">
            <Account viewer={viewer} />
          </div>
        </div>
      )}
    </header>
  );
}

function Account({ viewer }: { viewer: RosterViewer }) {
  if (!viewer.signedIn) {
    return (
      <button
        type="button"
        onClick={() => signIn("discord", { callbackUrl: "/" })}
        className="inline-flex items-center gap-2 rounded-md bg-[#5865F2] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#4752C4]"
      >
        <DiscordIcon className="h-4 w-4" />
        Sign in with Discord
      </button>
    );
  }

  return (
    <>
      <span className="max-w-[160px] truncate text-sm font-medium text-gray-300">{viewer.name ?? "Signed in"}</span>
      <UserNotificationBell />
      {viewer.hasPanel && (
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700"
        >
          <LayoutDashboard className="h-4 w-4" />
          Staff Panel
        </Link>
      )}
      <button
        type="button"
        onClick={() => signOut({ callbackUrl: "/" })}
        title="Sign out"
        aria-label="Sign out"
        className="rounded-md p-2 text-gray-500 transition-colors hover:bg-white/10 hover:text-white"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </>
  );
}

export function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20.317 4.37a19.79 19.79 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.865-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.74 19.74 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.058a.082.082 0 00.031.056 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.1 13.1 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.3 12.3 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.84 19.84 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}
