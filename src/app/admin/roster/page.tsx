"use client";

import React, { useState, useEffect, useCallback } from "react";
import MemberRow from "@/components/MemberRow";
import AddMemberDialog from "@/components/AddMemberDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RANK_NAMES, SECTION_HINTS } from "@/lib/constants";

interface Section {
  id: string;
  name: string;
  order: number;
  members: Array<{
    id: string;
    name: string;
    callSign?: string | null;
    rank: string;
    activity: string;
    dept: string;
    sectionId?: string | null;
    timezone?: string | null;
    discordId?: string | null;
    ftoRole?: string | null;
    tempRank?: string | null;
    category?: string | null;
    order: number;
  }>;
}

export default function AdminRosterPage() {
  const [sections, setSections] = useState<Section[]>([]);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/members");
      const data = await res.json();
      setSections(data);
    } catch (err) {
      console.error("Failed to fetch:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleUpdate = async (id: string, data: Record<string, unknown>) => {
    await fetch(`/api/members/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    fetchData();
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/members/${id}`, { method: "DELETE" });
    fetchData();
  };

  const handlePromote = async (id: string) => {
    const member = sections.flatMap((s) => s.members).find((m) => m.id === id);
    if (!member) return;
    const idx = RANK_NAMES.indexOf(member.rank as typeof RANK_NAMES[number]);
    if (idx < RANK_NAMES.length - 1) {
      await handleUpdate(id, { rank: RANK_NAMES[idx + 1], lastPromotion: new Date().toISOString() });
    }
  };

  const handleDemote = async (id: string) => {
    const member = sections.flatMap((s) => s.members).find((m) => m.id === id);
    if (!member) return;
    const idx = RANK_NAMES.indexOf(member.rank as typeof RANK_NAMES[number]);
    if (idx > 0) {
      await handleUpdate(id, { rank: RANK_NAMES[idx - 1], lastPromotion: new Date().toISOString() });
    }
  };

  const filteredSections = sections
    .map((s) => ({
      ...s,
      members: s.members.filter((m) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (
          m.name.toLowerCase().includes(q) ||
          (m.callSign && m.callSign.toLowerCase().includes(q)) ||
          m.rank.toLowerCase().includes(q)
        );
      }),
    }))
    .filter((s) => s.members.length > 0);

  const allMembers = sections.flatMap((s) => s.members);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-[family-name:var(--font-oswald)] text-2xl font-bold text-white uppercase">
            Roster Management
          </h1>
          <p className="text-gray-500 text-sm mt-1">{allMembers.length} total members</p>
        </div>
        <div className="flex items-center gap-3">
          <Input
            placeholder="Search members..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64"
          />
          <Button onClick={() => setShowAdd(true)}>Add Member</Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-500">Loading...</div>
      ) : (
        <div className="space-y-8">
          {filteredSections.map((section) => (
            <div key={section.id}>
              <h2 className="font-[family-name:var(--font-oswald)] text-lg font-semibold text-white uppercase mb-3">
                {section.name} ({section.members.length})
              </h2>
              <div className="bg-card border border-[#1e1e1e] rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#1e1e1e]">
                      <th className="text-left py-3 px-4 text-gray-500 font-medium">Name</th>
                      <th className="text-left py-3 px-4 text-gray-500 font-medium">Call Sign</th>
                      <th className="text-left py-3 px-4 text-gray-500 font-medium">Rank</th>
                      <th className="text-left py-3 px-4 text-gray-500 font-medium">Status</th>
                      <th className="text-left py-3 px-4 text-gray-500 font-medium">Temp Rank</th>
                      <th className="text-left py-3 px-4 text-gray-500 font-medium">Category</th>
                      <th className="text-left py-3 px-4 text-gray-500 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {section.members.map((member) => (
                      <MemberRow
                        key={member.id}
                        member={member}
                        onUpdate={handleUpdate}
                        onDelete={handleDelete}
                        onPromote={handlePromote}
                        onDemote={handleDemote}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      <AddMemberDialog
        open={showAdd}
        onOpenChange={setShowAdd}
        sections={sections}
        onAdd={() => fetchData()}
      />
    </div>
  );
}
