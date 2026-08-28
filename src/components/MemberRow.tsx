"use client";

import React, { useState } from "react";
import RankInsignia from "@/components/RankInsignia";
import ActivityPill from "@/components/ActivityPill";
import { getRankInfo, RANK_LIST, ACTIVITY_STATUSES } from "@/lib/constants";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface Member {
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
}

interface MemberRowProps {
  member: Member;
  departments: string[];
  onUpdate: (id: string, data: Partial<Member>) => void;
  onDelete: (id: string) => void;
  onPromote: (id: string) => void;
  onDemote: (id: string) => void;
}

export default function MemberRow({ member, departments, onUpdate, onDelete, onPromote, onDemote }: MemberRowProps) {
  const [editing, setEditing] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    name: member.name,
    callSign: member.callSign ?? "",
    rank: member.rank,
    activity: member.activity,
    dept: member.dept,
    timezone: member.timezone ?? "",
    tempRank: member.tempRank ?? "",
    category: member.category ?? "",
  });

  const rankInfo = getRankInfo(member.rank);

  const handleSave = () => {
    onUpdate(member.id, {
      name: editForm.name,
      callSign: editForm.callSign || null,
      rank: editForm.rank,
      activity: editForm.activity,
      dept: editForm.dept,
      timezone: editForm.timezone || null,
      tempRank: editForm.tempRank || null,
      category: editForm.category || null,
    });
    setEditing(false);
  };

  if (editing) {
    return (
      <tr className="border-b border-[#1e1e1e]/50 bg-red-600/5">
        <td className="py-2 px-4">
          <Input
            value={editForm.name}
            onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
            className="h-8 text-xs"
          />
        </td>
        <td className="py-2 px-4">
          <Input
            value={editForm.callSign}
            onChange={(e) => setEditForm((p) => ({ ...p, callSign: e.target.value }))}
            className="h-8 text-xs"
          />
        </td>
        <td className="py-2 px-4">
          <Select
            value={editForm.rank}
            onChange={(e) => setEditForm((p) => ({ ...p, rank: e.target.value }))}
            className="h-8 text-xs"
          >
            {RANK_LIST.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </Select>
        </td>
        <td className="py-2 px-4">
          <Select
            value={editForm.activity}
            onChange={(e) => setEditForm((p) => ({ ...p, activity: e.target.value }))}
            className="h-8 text-xs"
          >
            {ACTIVITY_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </Select>
        </td>
        <td className="py-2 px-4">
          <Input
            value={editForm.tempRank}
            onChange={(e) => setEditForm((p) => ({ ...p, tempRank: e.target.value }))}
            className="h-8 text-xs"
            placeholder="Temp rank"
          />
        </td>
        <td className="py-2 px-4">
          {departments.length > 0 ? (
            <Select
              value={editForm.dept}
              onChange={(e) => setEditForm((p) => ({ ...p, dept: e.target.value }))}
              className="h-8 text-xs"
            >
              {!departments.includes(editForm.dept) && (
                <option value={editForm.dept}>{editForm.dept}</option>
              )}
              {departments.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </Select>
          ) : (
            <Input
              value={editForm.dept}
              onChange={(e) => setEditForm((p) => ({ ...p, dept: e.target.value }))}
              className="h-8 text-xs"
            />
          )}
        </td>
        <td className="py-2 px-4">
          <div className="flex items-center gap-1">
            <Button size="sm" className="h-7 text-xs" onClick={handleSave}>Save</Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <>
    <tr className="border-b border-[#1e1e1e]/50 hover:bg-white/5 transition-colors">
      <td className="py-3 px-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-600/80 to-red-600/40 flex items-center justify-center text-[#0a0a0a] font-bold text-xs shrink-0">
            {member.name.split(" ").map((n) => n[0]).join("")}
          </div>
          <span className="text-white font-medium text-sm">{member.name}</span>
        </div>
      </td>
      <td className="py-3 px-4 font-[family-name:var(--font-mono)] text-gray-400 text-xs">
        {member.callSign ?? "—"}
      </td>
      <td className="py-3 px-4">
        <div className="flex items-center gap-2">
          <RankInsignia shape={rankInfo?.shape ?? "none"} count={rankInfo?.count ?? 0} size={14} />
          <span className="text-gray-300 text-xs">{member.rank}</span>
        </div>
      </td>
      <td className="py-3 px-4">
        <ActivityPill activity={member.activity} />
      </td>
      <td className="py-3 px-4 text-gray-400 text-xs">
        {member.tempRank ?? "—"}
      </td>
      <td className="py-3 px-4 text-gray-400 text-xs">
        {member.dept}
      </td>
      <td className="py-3 px-4">
        {member.category ? (
          <span className={`text-xs px-2 py-0.5 rounded ${
            member.category === "FTP" ? "bg-blue-500/20 text-blue-400" :
            member.category === "Full Time" ? "bg-green-500/20 text-green-400" :
            member.category === "Part Time" ? "bg-yellow-500/20 text-yellow-400" :
            member.category === "Probationary" ? "bg-orange-500/20 text-orange-400" :
            "bg-gray-500/20 text-gray-400"
          }`}>
            {member.category}
          </span>
        ) : (
          <span className="text-gray-600 text-xs">—</span>
        )}
      </td>
      <td className="py-3 px-4">
        <div className="flex items-center gap-1">
          <Link href={`/admin/roster/${member.id}`}>
            <Button size="sm" variant="ghost" className="h-7 text-xs text-blue-400">
              View
            </Button>
          </Link>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditing(true)}>
            Edit
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs text-green-400" onClick={() => onPromote(member.id)}>
            ↑
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs text-orange-400" onClick={() => onDemote(member.id)}>
            ↓
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs text-red-400" onClick={() => setDeleteId(member.id)}>
            ×
          </Button>
        </div>
      </td>
    </tr>
    <AlertDialog open={deleteId !== null} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Member</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete {member.name}? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setDeleteId(null)}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => { onDelete(member.id); setDeleteId(null); }}>Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
