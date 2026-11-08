"use client";

import React, { useState, useCallback } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import MemberRow from "@/components/roster/MemberRow";
import AddMemberDialog from "@/components/roster/AddMemberDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download } from "lucide-react";
import { RANK_LIST, ACTIVITY_STATUSES } from "@/lib/constants";
import { departmentTag } from "@/lib/departments";
import { groupByRank } from "@/lib/roster";
import { DepartmentMarkLegend } from "@/components/roster/DepartmentMark";
import { toast } from "sonner";
import { ErrorState } from "@/components/ui/error-state";
import { fetchJson, fetchList, errorMessage } from "@/lib/fetch-json";
import { useLoad } from "@/lib/use-load";

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
    stateId?: string | null;
    steamId?: string | null;
    ftoRole?: string | null;
    tempRank?: string | null;
    category?: string | null;
    order: number;
    loas?: { endDate: string }[];
    departmentMemberships?: { departmentId: string; role: string }[];
  }>;
}

interface DepartmentOption {
  id: string;
  name: string;
  tag?: string | null;
  color: string;
}

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
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [sectionList, deptList] = await Promise.all([
        fetchList<Section>("/api/members"),
        fetchList<DepartmentOption>("/api/admin/departments"),
      ]);
      setSections(sectionList);
      setDepartmentOptions(deptList);
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
      setSections([]);
      toast.error("Failed to load roster data");
    } finally {
      setLoading(false);
    }
  }, []);

  useLoad(fetchData);

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

  /** Moves a member to another section. Their rank stays as it is. */
  const moveMember = async (memberId: string, sectionId: string) => {
    const from = sections.find((s) => s.members.some((m) => m.id === memberId));
    const to = sections.find((s) => s.id === sectionId);
    const member = from?.members.find((m) => m.id === memberId);
    if (!from || !to || !member || from.id === to.id) return;

    setSections((current) =>
      current.map((s) => {
        const others = s.members.filter((m) => m.id !== memberId);
        return { ...s, members: s.id === sectionId ? [...others, { ...member, sectionId }] : others };
      })
    );
    try {
      await fetchJson(`/api/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sectionId }),
      });
      toast.success(`${member.name} moved to ${to.name}`);
    } catch (err) {
      toast.error(errorMessage(err));
    }
    fetchData();
  };

  // Deferred: changing the page during dragstart makes Chrome cancel the drag.
  const beginDrag = (id: string) => {
    setTimeout(() => setDraggingId(id), 0);
  };
  const endDrag = () => {
    setDraggingId(null);
    setDropTarget(null);
  };
  const dropZone = (sectionId: string) => ({
    onDragOver: (e: React.DragEvent) => {
      if (!draggingId) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setDropTarget(sectionId);
    },
    onDragLeave: (e: React.DragEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropTarget(null);
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      if (draggingId) moveMember(draggingId, sectionId);
      endDrag();
    },
  });

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
    const idx = RANK_LIST.indexOf(member.rank as typeof RANK_LIST[number]);
    if (idx < RANK_LIST.length - 1) {
      await handleUpdate(id, { rank: RANK_LIST[idx + 1], lastPromotion: new Date().toISOString() });
      toast.success(`Promoted to ${RANK_LIST[idx + 1]}`);
    }
  };

  const handleDemote = async (id: string) => {
    const member = sections.flatMap((s) => s.members).find((m) => m.id === id);
    if (!member) return;
    const idx = RANK_LIST.indexOf(member.rank as typeof RANK_LIST[number]);
    if (idx > 0) {
      await handleUpdate(id, { rank: RANK_LIST[idx - 1], lastPromotion: new Date().toISOString() });
      toast.success(`Demoted to ${RANK_LIST[idx - 1]}`);
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
        const q = search.trim().toLowerCase();
        if (!q) return true;
        // Identifiers are matched too, so an admin holding only a Discord,
        // Steam or State ID — which is how members are reported in-game and on
        // Discord — can find the row without knowing the character name.
        return [m.name, m.callSign, m.rank, m.discordId, m.stateId, m.steamId].some(
          (field) => field && field.toLowerCase().includes(q)
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
  const draggingMember = allMembers.find((m) => m.id === draggingId);
  const filteredCount = filteredSections.reduce((n, s) => n + s.members.length, 0);
  // The dropdown always includes every managed department name (even ones no
  // member currently has) plus, defensively, any raw dept string already on
  // a member that predates the department list — so the filter can still
  // find them.
  const deptNames = [...new Set([...departmentOptions.map((d) => d.name), ...allMembers.map((m) => m.dept)])].sort();

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="font-[family-name:var(--font-oswald)] text-2xl font-bold text-white uppercase">
            Roster Management
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {search || rankFilter || deptFilter || activityFilter
              ? `${filteredCount} of ${allMembers.length} members`
              : `${allMembers.length} total members`}
          </p>
        </div>
        <div className="flex max-w-full min-w-0 items-center gap-3 flex-wrap">
          <Input
            placeholder="Search name, call sign, Discord / Steam / State ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-72"
          />
          <select
            value={rankFilter}
            onChange={(e) => setRankFilter(e.target.value)}
            className="h-9 rounded-md border border-[#1e1e1e] bg-[#111111] px-3 text-sm text-white"
          >
            <option value="">All ranks</option>
            {RANK_LIST.map((r) => (
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
          {departmentOptions.length > 0 && <DepartmentMarkLegend />}
          <p className="text-xs text-gray-500 [@media(pointer:coarse)]:hidden">
            Drag a member by the handle next to their name to move them to another section. Their rank stays the same.
          </p>
          {displaySections.map((section) => (
            <div
              key={section.id}
              {...(section.id === LOA_SECTION_ID ? {} : dropZone(section.id))}
              className={`rounded-xl transition-shadow ${
                draggingId && dropTarget === section.id ? "ring-2 ring-red-500 ring-offset-4 ring-offset-[#0a0a0f]" : ""
              }`}
            >
              <h2 className="font-[family-name:var(--font-oswald)] text-lg font-semibold text-white uppercase mb-3">
                {section.name} ({section.members.length})
              </h2>
              <div className="bg-card border border-[#1e1e1e] rounded-xl overflow-x-auto">
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
                      {departmentOptions.map((dept) => (
                        <th
                          key={dept.id}
                          className="py-3 px-3 text-gray-500 font-medium text-center whitespace-nowrap"
                          title={dept.name}
                        >
                          {departmentTag(dept)}
                        </th>
                      ))}
                      <th className="text-left py-3 px-4 text-gray-500 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* One heading row per rank, most senior first — the same
                        classification the public roster shows. */}
                    {groupByRank(section.members).map((group) => (
                      <React.Fragment key={group.rank}>
                        <tr className="border-b border-[#1e1e1e]/60 bg-white/[0.015]">
                          <td colSpan={7 + departmentOptions.length + 1} className="py-1.5 px-4">
                            <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-red-400">
                              <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                              {group.rank}
                              <span className="font-medium tracking-normal text-gray-600">— {group.members.length}</span>
                            </span>
                          </td>
                        </tr>
                        {group.members.map((member) => (
                          <MemberRow
                            key={member.id}
                            member={member}
                            departments={departmentOptions.map((d) => d.name)}
                            departmentColumns={departmentOptions}
                            onUpdate={handleUpdate}
                            onDelete={handleDelete}
                            onPromote={handlePromote}
                            onDemote={handleDemote}
                            sections={sections}
                            onDragBegin={beginDrag}
                            onDragFinish={endDrag}
                          />
                        ))}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Every section at once, so a move does not depend on scrolling a long
          roster or on the target section having anyone in it to show. */}
      {draggingMember && (
        <div className="fixed left-1/2 top-4 z-50 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-2 rounded-xl border border-[#1e1e28] bg-[#111118] p-3 shadow-2xl">
          <span className="px-1 text-xs text-gray-400">Move {draggingMember.name} to</span>
          {sections.map((s) => {
            const current = s.members.some((m) => m.id === draggingMember.id);
            return (
              <div
                key={s.id}
                {...(current ? {} : dropZone(s.id))}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  current
                    ? "border-transparent text-gray-600"
                    : dropTarget === s.id
                      ? "border-red-500 bg-red-600 text-white"
                      : "border-[#2a2a36] bg-white/5 text-white"
                }`}
              >
                {s.name}
              </div>
            );
          })}
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
