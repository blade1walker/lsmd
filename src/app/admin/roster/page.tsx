"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import MemberRow from "@/components/MemberRow";
import AddMemberDialog from "@/components/AddMemberDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download } from "lucide-react";
import { RANK_NAMES, SECTION_HINTS, ACTIVITY_STATUSES } from "@/lib/constants";
import { toast } from "sonner";
import { ErrorState } from "@/components/ui/error-state";
import { fetchJson, fetchList, errorMessage } from "@/lib/fetch-json";

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
    loas?: { endDate: string }[];
  }>;
}

interface DepartmentOption { id: string; name: string; }

/** Key for the LOA group — not a real Section, so it needs an id of its own. */
const LOA_SECTION_ID = "__loa";

export default function AdminRosterPage() {
  const [sections, setSections] = useState<Section[]>([]);
  const [departmentOptions, setDepartmentOptions] = useState<DepartmentOption[]>([]);
  const [search, setSearch] = useState("");
  const [rankFilter, setRankFilter] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [activityFilter, setActivityFilter] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setError(null);
    try {
      const [sectionList, deptList] = await Promise.all([
        fetchList<Section>("/api/members"),
        fetchList<DepartmentOption>("/api/admin/departments"),
      ]);
      setSections(sectionList);
      setDepartmentOptions(deptList);
    } catch (err) {
      setError(errorMessage(err));
      setSections([]);
      toast.error("Failed to load roster data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleUpdate = async (id: string, data: Record<string, unknown>) => {
    try {
      await fetchJson(`/api/members/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      fetchData();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetchJson(`/api/members/${id}`, { method: "DELETE" });
      toast.success("Member removed");
      fetchData();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const handlePromote = async (id: string) => {
    const member = sections.flatMap((s) => s.members).find((m) => m.id === id);
    if (!member) return;
    const idx = RANK_NAMES.indexOf(member.rank as typeof RANK_NAMES[number]);
    if (idx < RANK_NAMES.length - 1) {
      await handleUpdate(id, { rank: RANK_NAMES[idx + 1], lastPromotion: new Date().toISOString() });
      toast.success(`Promoted to ${RANK_NAMES[idx + 1]}`);
    }
  };

  const handleDemote = async (id: string) => {
    const member = sections.flatMap((s) => s.members).find((m) => m.id === id);
    if (!member) return;
    const idx = RANK_NAMES.indexOf(member.rank as typeof RANK_NAMES[number]);
    if (idx > 0) {
      await handleUpdate(id, { rank: RANK_NAMES[idx - 1], lastPromotion: new Date().toISOString() });
      toast.success(`Demoted to ${RANK_NAMES[idx - 1]}`);
    }
  };

  const filteredSections = sections
    .map((s) => ({
      ...s,
      members: s.members.filter((m) => {
        if (rankFilter && m.rank !== rankFilter) return false;
        if (deptFilter && m.dept !== deptFilter) return false;
        if (activityFilter && m.activity !== activityFilter) return false;
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

  // Members on LOA are lifted out of their own section into one group at the
  // bottom, so a section lists only who is actually serving in it. They keep
  // their real sectionId — this is a display grouping, not a reassignment.
  const membersOnLOA = filteredSections.flatMap((s) => s.members).filter((m) => m.activity === "LOA");
  const displaySections = [
    ...filteredSections
      .map((s) => ({ ...s, members: s.members.filter((m) => m.activity !== "LOA") }))
      .filter((s) => s.members.length > 0),
    ...(membersOnLOA.length > 0
      ? [{ id: LOA_SECTION_ID, name: "On Leave of Absence", order: Number.MAX_SAFE_INTEGER, members: membersOnLOA }]
      : []),
  ];

  const allMembers = sections.flatMap((s) => s.members);
  const filteredCount = filteredSections.reduce((n, s) => n + s.members.length, 0);
  // The dropdown always includes every managed department name (even ones no
  // member currently has) plus, defensively, any raw dept string already on
  // a member that predates the department list — so the filter can still
  // find them.
  const deptNames = [...new Set([...departmentOptions.map((d) => d.name), ...allMembers.map((m) => m.dept)])].sort();

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-[family-name:var(--font-oswald)] text-2xl font-bold text-white uppercase">
            Roster Management
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {rankFilter || deptFilter || activityFilter
              ? `${filteredCount} of ${allMembers.length} members`
              : `${allMembers.length} total members`}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Input
            placeholder="Search members..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-56"
          />
          <select
            value={rankFilter}
            onChange={(e) => setRankFilter(e.target.value)}
            className="h-9 rounded-md border border-[#1e1e1e] bg-[#111111] px-3 text-sm text-white"
          >
            <option value="">All ranks</option>
            {RANK_NAMES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="h-9 rounded-md border border-[#1e1e1e] bg-[#111111] px-3 text-sm text-white"
          >
            <option value="">All departments</option>
            {deptNames.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <select
            value={activityFilter}
            onChange={(e) => setActivityFilter(e.target.value)}
            className="h-9 rounded-md border border-[#1e1e1e] bg-[#111111] px-3 text-sm text-white"
          >
            <option value="">All statuses</option>
            {/* "Reserve" is the stored activity value; shown as "Inactive" here since that's what it means day to day. */}
            {ACTIVITY_STATUSES.map((s) => (
              <option key={s} value={s}>{s === "Reserve" ? "Inactive" : s}</option>
            ))}
          </select>
          <Button
            variant="outline"
            onClick={() => window.open("/api/admin/export?type=members", "_blank")}
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <Button onClick={() => setShowAdd(true)}>Add Member</Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-8">
          {[...Array(3)].map((_, i) => (
            <div key={i}>
              <Skeleton className="h-6 w-32 mb-3" />
              <div className="bg-card border border-[#1e1e28] rounded-xl overflow-hidden">
                {[...Array(4)].map((_, j) => (
                  <div key={j} className="flex items-center gap-4 px-4 py-3 border-b border-[#1e1e28]">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <ErrorState title="Failed to load roster" message={error} onRetry={fetchData} />
      ) : (
        <div className="space-y-8">
          {displaySections.map((section) => (
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
                      <th className="text-left py-3 px-4 text-gray-500 font-medium">Department</th>
                      <th className="text-left py-3 px-4 text-gray-500 font-medium">Category</th>
                      <th className="text-left py-3 px-4 text-gray-500 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {section.members.map((member) => (
                      <MemberRow
                        key={member.id}
                        member={member}
                        departments={departmentOptions.map((d) => d.name)}
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
        departments={departmentOptions.map((d) => d.name)}
        onAdd={() => fetchData()}
      />
    </div>
  );
}
