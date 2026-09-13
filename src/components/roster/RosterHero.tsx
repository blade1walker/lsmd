"use client";

import Link from "next/link";
import { FileText, Radio, Shirt, GraduationCap, CalendarOff, Building2, UserPlus, Lock } from "lucide-react";
import { StarOfLife } from "./StarOfLife";

/** Every public destination the old header and hero linked to, kept in one row. */
const LINKS = [
  { href: "/sop", label: "View EMS SOP", icon: FileText },
  { href: "/radio-codes", label: "Radio Codes", icon: Radio },
  { href: "/uniform", label: "Uniform Guide", icon: Shirt },
  { href: "/training", label: "Training", icon: GraduationCap },
  { href: "/loa", label: "Request LOA", icon: CalendarOff },
  { href: "/departments", label: "Join a Department", icon: Building2 },
  { href: "/onboarding", label: "Enroll", icon: UserPlus },
] as const;

export function RosterHero({ adminHref }: { adminHref: string }) {
  return (
    <section className="relative overflow-hidden border-b border-[#1a1a22]">
      {/* A soft red bloom behind the emblem, fading into the page. */}
      <div className="pointer-events-none absolute left-1/2 top-0 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(220,38,38,0.22),rgba(220,38,38,0.06)_45%,transparent_70%)]" />

      <div className="relative mx-auto max-w-6xl px-4 pb-12 pt-16 text-center sm:pt-20">
        <StarOfLife className="mx-auto h-24 w-24 drop-shadow-[0_0_28px_rgba(220,38,38,0.55)] sm:h-28 sm:w-28" />

        <p className="mt-8 text-[11px] font-bold uppercase tracking-[0.5em] text-red-500">Nexus Universe RP</p>

        <h1 className="mt-3 font-[family-name:var(--font-oswald)] text-4xl font-bold uppercase leading-none tracking-wide text-white sm:text-6xl md:text-7xl">
          Emergency Medical Services
        </h1>

        <p className="mt-4 text-sm uppercase tracking-[0.45em] text-gray-400 sm:text-base">Official Personnel Roster</p>

        <div className="mx-auto mt-6 h-px w-56 bg-gradient-to-r from-transparent via-red-600/70 to-transparent" />

        <nav className="mt-8 flex flex-wrap items-center justify-center gap-2.5">
          {LINKS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="inline-flex items-center gap-2 rounded-lg border border-[#26262f] bg-[#101016]/80 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-gray-300 transition-colors hover:border-red-600/50 hover:text-white"
            >
              <Icon className="h-4 w-4 text-gray-500" />
              {label}
            </Link>
          ))}
          <Link
            href={adminHref}
            className="inline-flex items-center gap-2 rounded-lg border border-red-600/60 bg-red-600/10 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-white transition-colors hover:bg-red-600/20"
          >
            <Lock className="h-4 w-4 text-red-400" />
            Admin
          </Link>
        </nav>
      </div>
    </section>
  );
}
