"use client";

import { useState, useEffect, useMemo } from "react";
import { DiscordBar } from "./DiscordBar";
import { HeroHeader } from "./HeroHeader";
import { StatsBar } from "./StatsBar";
import { FilterBar } from "./FilterBar";
import { SectionHeader } from "./SectionHeader";
import { RosterTable } from "./RosterTable";
import { MemberDrawer } from "./MemberDrawer";
import { LOAModal } from "./LOAModal";
import { UserNotificationBell } from "./UserNotificationBell";
import { Footer } from "./Footer";
import { RANKS, SECTION_HINTS } from "@/lib/constants";

interface Section {
  id: string;
  name: string;
  order: number;
  members: any[];
}

interface PublicPageClientProps {
  sections: Section[];
}

export function PublicPageClient({ sections }: PublicPageClientProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activityFilter, setActivityFilter] = useState("All");
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [showLOAModal, setShowLOAModal] = useState(false);

  useEffect(() => {
    const initial: Record<string, boolean> = {};
    sections.forEach((s) => {
      initial[s.id] = true;
    });
    setOpenSections(initial);
  }, [sections]);

  const filteredSections = useMemo(() => {
    return sections
      .map((section) => ({
        ...section,
        members: section.members.filter((member) => {
          const matchesSearch =
            !searchQuery ||
            member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            member.callSign?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            member.rank.toLowerCase().includes(searchQuery.toLowerCase());

          const matchesActivity =
            activityFilter === "All" || member.activity === activityFilter;

          return matchesSearch && matchesActivity;
        }),
      }))
      .filter((section) => section.members.length > 0);
  }, [sections, searchQuery, activityFilter]);

  const totalMembers = sections.reduce((sum, s) => sum + s.members.length, 0);
  const activeMembers = sections.reduce(
    (sum, s) => sum + s.members.filter((m) => m.activity === "Active").length,
    0
  );
  const reserveMembers = sections.reduce(
    (sum, s) => sum + s.members.filter((m) => m.activity === "Reserve").length,
    0
  );
  const loaMembers = sections.reduce(
    (sum, s) => sum + s.members.filter((m) => m.activity === "LOA").length,
    0
  );

  return (
    <div className="flex flex-col min-h-screen">
      <DiscordBar />
      <HeroHeader />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="font-[family-name:var(--font-oswald)] text-2xl font-bold text-white uppercase">
              Personnel Roster
            </h2>
            <p className="text-gray-500 text-sm mt-1">
              {totalMembers} total personnel
            </p>
          </div>
          <UserNotificationBell />
        </div>

        <StatsBar
          total={totalMembers}
          active={activeMembers}
          reserve={reserveMembers}
          loa={loaMembers}
        />

        <FilterBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          activityFilter={activityFilter}
          onActivityFilterChange={setActivityFilter}
        />

        {filteredSections.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-gray-500 text-lg mb-2">No results found</div>
            <div className="text-gray-600 text-sm">
              Try adjusting your search or filters
            </div>
          </div>
        ) : (
          <div>
            {filteredSections.map((section) => (
              <div key={section.id} className="mb-8">
                <SectionHeader
                  name={section.name}
                  count={section.members.length}
                  isOpen={openSections[section.id] ?? true}
                  onToggle={() =>
                    setOpenSections((prev) => ({
                      ...prev,
                      [section.id]: !prev[section.id],
                    }))
                  }
                />
                {openSections[section.id] && (
                  <RosterTable members={section.members} />
                )}
              </div>
            ))}

            {/* Join LSMD CTA */}
            <a
              href="/onboarding"
              className="block mt-12 rounded-xl border border-[#eab308]/30 bg-[#eab308]/5 hover:bg-[#eab308]/10 transition-all group"
            >
              <div className="flex items-center justify-between p-6">
                <h3 className="font-[family-name:var(--font-oswald)] text-2xl font-bold text-[#eab308] uppercase tracking-wider group-hover:scale-105 transition-transform origin-left">
                  Join LSMD
                </h3>
                <div className="text-[#eab308] text-2xl group-hover:translate-x-1 transition-transform">
                  →
                </div>
              </div>
            </a>
          </div>
        )}
      </main>

      <Footer />

      {selectedMember && (
        <MemberDrawer
          member={selectedMember}
          onClose={() => setSelectedMember(null)}
        />
      )}

      <LOAModal
        isOpen={showLOAModal}
        onClose={() => setShowLOAModal(false)}
      />
    </div>
  );
}
