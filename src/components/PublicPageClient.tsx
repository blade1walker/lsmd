"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { Footer } from "./Footer";
import { MemberDrawer } from "./MemberDrawer";
import { DepartmentMarkLegend } from "./DepartmentMark";
import { RosterHero } from "./roster/RosterHero";
import { RosterAuthButton } from "./roster/RosterAuthButton";
import { RosterBannerStrip } from "./roster/RosterBannerStrip";
import { RosterStats } from "./roster/RosterStats";
import { RosterFilters } from "./roster/RosterFilters";
import { RankStructure } from "./roster/RankStructure";
import { RosterSectionCard } from "./roster/RosterSectionCard";
import { DutyCard } from "./roster/DutyCard";
import {
  filtersToQuery,
  matchesFilters,
  type RosterFilters as Filters,
  type RosterMember,
  type RosterPageData,
} from "@/lib/roster-shared";

/** Collapse key for the LOA group — not a real Section, so it needs its own id. */
const LOA_SECTION_ID = "__loa";

export function PublicPageClient({ data, initialFilters }: { data: RosterPageData; initialFilters: Filters }) {
  const { sections, departments, banner, stats, viewer, viewerDuty } = data;

  const [filters, setFilters] = useState<Filters>(() => ({
    ...initialFilters,
    // A department removed since the link was made, or a shift filter in a
    // link opened by someone who cannot see shifts, would otherwise filter the
    // roster down to nothing with no visible reason why.
    dept: departments.some((d) => d.id === initialFilters.dept) ? initialFilters.dept : "",
    shift: viewer.fullAccess ? initialFilters.shift : "",
  }));
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<RosterMember | null>(null);

  const updateFilters = (patch: Partial<Filters>) => {
    const next = { ...filters, ...patch };
    setFilters(next);
    // replaceState rather than router.replace: this page renders on the
    // server, and a router navigation per keystroke would refetch it each time.
    const query = filtersToQuery(next);
    window.history.replaceState(null, "", query ? `?${query}` : window.location.pathname);
  };

  const everyone = useMemo(() => sections.flatMap((s) => s.members), [sections]);

  // Anyone on LOA is lifted out of their own section and listed together at the
  // bottom, so a section only shows the people currently serving in it.
  const { visibleSections, onLeave, shownCount } = useMemo(() => {
    const filtered = sections.map((section) => ({
      ...section,
      members: section.members.filter((member) => matchesFilters(member, filters)),
    }));
    const leave = filtered.flatMap((s) => s.members).filter((m) => m.activity === "LOA");
    return {
      visibleSections: filtered
        .map((section) => ({ ...section, members: section.members.filter((m) => m.activity !== "LOA") }))
        .filter((section) => section.members.length > 0),
      onLeave: leave,
      shownCount: filtered.reduce((n, s) => n + s.members.length, 0),
    };
  }, [sections, filters]);

  const toggleSection = (id: string) => setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));
  const closeDrawer = useCallback(() => setSelected(null), []);

  return (
    <div className="flex min-h-screen flex-col bg-[#08080c]">
      <RosterAuthButton viewer={viewer} />
      <RosterHero adminHref={viewer.hasPanel ? "/admin" : "/admin/login"} />
      {banner && <RosterBannerStrip banner={banner} />}

      <main id="roster" className="mx-auto w-full max-w-[1600px] flex-1 space-y-5 px-4 py-8 sm:px-6">
        <RosterStats stats={stats} />

        {viewer.canClock && viewer.memberId && viewerDuty && (
          <DutyCard memberId={viewer.memberId} name={viewer.name} duty={viewerDuty} />
        )}

        <RosterFilters
          filters={filters}
          onChange={updateFilters}
          departments={departments}
          showShift={viewer.fullAccess}
          shownCount={shownCount}
          totalCount={stats.total}
        />

        <RankStructure members={everyone} />

        {!viewer.signedIn && (
          <p className="text-xs text-gray-600">
            EMS members can log in with Discord to see duty status, hours, shifts and join dates.
          </p>
        )}

        {visibleSections.length === 0 && onLeave.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#1c1c24] py-16 text-center">
            <div className="mb-1 text-lg text-gray-400">No personnel match these filters</div>
            <div className="text-sm text-gray-600">Try a different search or clear the filters.</div>
          </div>
        ) : (
          <div className="space-y-5">
            {visibleSections.map((section) => (
              <RosterSectionCard
                key={section.id}
                name={section.name}
                members={section.members}
                departments={departments}
                fullAccess={viewer.fullAccess}
                open={!collapsed[section.id]}
                onToggle={() => toggleSection(section.id)}
                onSelect={setSelected}
              />
            ))}

            {onLeave.length > 0 && (
              <RosterSectionCard
                name="On Leave of Absence"
                members={onLeave}
                departments={departments}
                fullAccess={viewer.fullAccess}
                accent="amber"
                open={!collapsed[LOA_SECTION_ID]}
                onToggle={() => toggleSection(LOA_SECTION_ID)}
                onSelect={setSelected}
              />
            )}

            {departments.length > 0 && <DepartmentMarkLegend className="justify-end" />}
          </div>
        )}

        <Link
          href="/onboarding"
          className="group mt-10 block rounded-xl border border-red-600/30 bg-red-600/5 transition-colors hover:bg-red-600/10"
        >
          <div className="flex items-center justify-between p-6">
            <h3 className="font-[family-name:var(--font-oswald)] text-2xl font-bold uppercase tracking-wider text-red-500">
              Join EMS
            </h3>
            <span className="text-2xl text-red-500 transition-transform group-hover:translate-x-1">→</span>
          </div>
        </Link>
      </main>

      <Footer />

      {selected && (
        <MemberDrawer
          member={selected}
          departments={departments}
          fullAccess={viewer.fullAccess}
          onClose={closeDrawer}
        />
      )}
    </div>
  );
}
