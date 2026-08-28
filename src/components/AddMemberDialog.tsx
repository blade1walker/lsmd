"use client";

import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { RANK_LIST, ACTIVITY_STATUSES, FTO_ROLES } from "@/lib/constants";

interface AddMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sections: Array<{ id: string; name: string }>;
  departments: string[];
  onAdd: (member: Record<string, unknown>) => void;
}

const BLANK_FORM = {
  name: "",
  rank: "Medical Intern",
  callSign: "",
  sectionId: "",
  activity: "Active",
  dept: "",
  timezone: "",
  discordId: "",
  ftoRole: "",
  tempRank: "",
  category: "",
};

export default function AddMemberDialog({ open, onOpenChange, sections, departments, onAdd }: AddMemberDialogProps) {
  const [form, setForm] = useState(BLANK_FORM);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          sectionId: form.sectionId || undefined,
          dept: form.dept || undefined,
        }),
      });
      if (res.ok) {
        const member = await res.json();
        onAdd(member);
        setForm(BLANK_FORM);
        onOpenChange(false);
      }
    } catch (err) {
      console.error("Failed to add member:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Member</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="Full name"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="rank">Rank</Label>
              <Select
                id="rank"
                value={form.rank}
                onChange={(e) => setForm((p) => ({ ...p, rank: e.target.value }))}
              >
                {RANK_LIST.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="callSign">Call Sign</Label>
              <Input
                id="callSign"
                value={form.callSign}
                onChange={(e) => setForm((p) => ({ ...p, callSign: e.target.value }))}
                placeholder="e.g. M-001"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="section">Section</Label>
              <Select
                id="section"
                value={form.sectionId}
                onChange={(e) => setForm((p) => ({ ...p, sectionId: e.target.value }))}
              >
                <option value="">Auto-assign</option>
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="activity">Status</Label>
              <Select
                id="activity"
                value={form.activity}
                onChange={(e) => setForm((p) => ({ ...p, activity: e.target.value }))}
              >
                {ACTIVITY_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="dept">Department</Label>
              <Select
                id="dept"
                value={form.dept}
                onChange={(e) => setForm((p) => ({ ...p, dept: e.target.value }))}
              >
                <option value="">Default (LSMD)</option>
                {departments.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="discordId">Discord ID</Label>
              <Input
                id="discordId"
                value={form.discordId}
                onChange={(e) => setForm((p) => ({ ...p, discordId: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="timezone">Timezone</Label>
              <Input
                id="timezone"
                value={form.timezone}
                onChange={(e) => setForm((p) => ({ ...p, timezone: e.target.value }))}
                placeholder="e.g. EST"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="ftoRole">FTO Role</Label>
              <Select
                id="ftoRole"
                value={form.ftoRole}
                onChange={(e) => setForm((p) => ({ ...p, ftoRole: e.target.value }))}
              >
                <option value="">None</option>
                {FTO_ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                value={form.category}
                onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !form.name.trim()}>
              {loading ? "Adding..." : "Add Member"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
