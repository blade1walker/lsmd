"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ErrorState } from "@/components/ui/error-state";
import { fetchJson, fetchList, errorMessage } from "@/lib/fetch-json";
import { toast } from "sonner";

interface Member {
  id: string;
  name: string;
  callSign: string;
  rank: string;
}

interface ShiftAssignment {
  id: string;
  memberId: string;
  date: string;
  status: string;
  notes: string | null;
  member: Member;
}

interface Shift {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  days: string[];
  color: string;
  assignments: ShiftAssignment[];
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const COLOR_OPTIONS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4"];

function startOfWeek(from: Date): Date {
  const d = new Date(from);
  const day = d.getDay();
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function AdminShiftsPage() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [selectedShift, setSelectedShift] = useState<string>("");
  const [selectedDay, setSelectedDay] = useState<string>("");
  const [form, setForm] = useState({ name: "", startTime: "08:00", endTime: "16:00", days: [] as string[], color: "#3b82f6" });
  const [assignForm, setAssignForm] = useState({ memberId: "", date: "" });
  // Resolved after mount, not in the initial state: this page is statically
  // prerendered, so deriving "this week" during render bakes the build date
  // into the HTML and mismatches whatever week the browser is actually in.
  const [currentWeekStart, setCurrentWeekStart] = useState<Date | null>(null);

  useEffect(() => {
    setCurrentWeekStart(startOfWeek(new Date()));
  }, []);

  const weekDates = DAYS.map((_, i) => {
    if (!currentWeekStart) return "";
    const d = new Date(currentWeekStart);
    d.setDate(d.getDate() + i);
    return d.toISOString().split("T")[0];
  });

  const fetchData = useCallback(async () => {
    setError(null);
    try {
      const [shiftList, sections] = await Promise.all([
        fetchList<Shift>("/api/admin/shifts"),
        fetchList<{ members: Member[] }>("/api/members"),
      ]);
      setShifts(shiftList);
      setMembers(sections.flatMap((s) => s.members ?? []));
    } catch (err) {
      console.error("Failed to fetch:", err);
      setError(errorMessage(err));
      setShifts([]);
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetchJson("/api/admin/shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      toast.success("Shift created");
      setForm({ name: "", startTime: "08:00", endTime: "16:00", days: [], color: "#3b82f6" });
      setShowCreate(false);
      fetchData();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetchJson("/api/admin/shifts/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shiftId: selectedShift, memberId: assignForm.memberId, date: assignForm.date }),
      });
      setAssignForm({ memberId: "", date: "" });
      setShowAssign(false);
      fetchData();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const handleRemoveAssignment = async (shiftId: string, memberId: string, date: string) => {
    try {
      await fetchJson("/api/admin/shifts/assign", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shiftId, memberId, date }),
      });
      fetchData();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const handleDeleteShift = async (id: string) => {
    if (!confirm("Delete this shift?")) return;
    try {
      await fetchJson(`/api/admin/shifts/${id}`, { method: "DELETE" });
      toast.success("Shift deleted");
      fetchData();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const openAssignDialog = (shiftId: string, day: string) => {
    setSelectedShift(shiftId);
    setSelectedDay(day);
    setAssignForm({ memberId: "", date: weekDates[DAYS.indexOf(day)] });
    setShowAssign(true);
  };

  const getAssignmentsForShiftAndDay = (shiftId: string, day: string) => {
    const date = weekDates[DAYS.indexOf(day)];
    return shifts.find((s) => s.id === shiftId)?.assignments.filter((a) => a.date.startsWith(date)) ?? [];
  };

  const toggleDay = (day: string) => {
    setForm((prev) => ({
      ...prev,
      days: prev.days.includes(day) ? prev.days.filter((d) => d !== day) : [...prev.days, day],
    }));
  };

  const navigateWeek = (direction: number) => {
    setCurrentWeekStart((prev) => {
      if (!prev) return prev;
      const d = new Date(prev);
      d.setDate(d.getDate() + direction * 7);
      return d;
    });
  };

  if (loading || !currentWeekStart) {
    return <div className="flex items-center justify-center h-64"><div className="text-gray-500">Loading shifts...</div></div>;
  }

  if (error) {
    return <ErrorState title="Failed to load shifts" message={error} onRetry={fetchData} />;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-[family-name:var(--font-oswald)] text-2xl font-bold text-white uppercase">
            Shift Schedule
          </h1>
          <p className="text-gray-500 text-sm mt-1">Manage shift schedules and assignments</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>Create Shift</Button>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" onClick={() => navigateWeek(-1)}>Previous Week</Button>
        <span className="text-white font-medium">
          {weekDates[0]} - {weekDates[6]}
        </span>
        <Button variant="ghost" onClick={() => navigateWeek(1)}>Next Week</Button>
      </div>

      <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl overflow-hidden">
        <div className="grid grid-cols-8 border-b border-[#1e1e1e]">
          <div className="p-3 text-xs font-medium text-gray-500 uppercase">Shift</div>
          {DAYS.map((day, i) => (
            <div key={day} className="p-3 text-xs font-medium text-gray-500 uppercase text-center border-l border-[#1e1e1e]">
              <div>{day.slice(0, 3)}</div>
              <div className="text-gray-600 mt-0.5">{weekDates[i].slice(5)}</div>
            </div>
          ))}
        </div>

        {shifts.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No shifts created yet</div>
        ) : (
          shifts.map((shift) => (
            <div key={shift.id} className="grid grid-cols-8 border-b border-[#1e1e1e] last:border-b-0">
              <div className="p-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: shift.color }} />
                    <span className="text-white text-sm font-medium">{shift.name}</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">{shift.startTime} - {shift.endTime}</div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs text-red-400 mt-2 self-start"
                  onClick={() => handleDeleteShift(shift.id)}
                >
                  Delete
                </Button>
              </div>
              {DAYS.map((day) => {
                const dayAssignments = getAssignmentsForShiftAndDay(shift.id, day);
                const isShiftDay = shift.days.includes(day);
                return (
                  <div
                    key={day}
                    className={`p-2 border-l border-[#1e1e1e] min-h-[80px] ${isShiftDay ? "" : "opacity-30"}`}
                  >
                    <div className="space-y-1">
                      {dayAssignments.map((a) => (
                        <div
                          key={a.id}
                          className="text-xs p-1.5 rounded bg-white/5 text-gray-300 flex items-center justify-between group"
                        >
                          <span className="truncate">{a.member.callSign ?? a.member.name}</span>
                          <button
                            onClick={() => handleRemoveAssignment(shift.id, a.memberId, a.date)}
                            className="text-red-400 opacity-0 group-hover:opacity-100 ml-1"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                    {isShiftDay && (
                      <button
                        onClick={() => openAssignDialog(shift.id, day)}
                        className="text-xs text-gray-600 hover:text-gray-400 mt-1 w-full text-left"
                      >
                        + assign
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Create Shift</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <Label>Shift Name</Label>
              <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Start Time</Label>
                <Input type="time" value={form.startTime} onChange={(e) => setForm((p) => ({ ...p, startTime: e.target.value }))} required />
              </div>
              <div>
                <Label>End Time</Label>
                <Input type="time" value={form.endTime} onChange={(e) => setForm((p) => ({ ...p, endTime: e.target.value }))} required />
              </div>
            </div>
            <div>
              <Label className="mb-2 block">Days</Label>
              <div className="flex flex-wrap gap-2">
                {DAYS.map((day) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                      form.days.includes(day)
                        ? "bg-[#dc2626] text-white"
                        : "bg-white/5 text-gray-400 hover:bg-white/10"
                    }`}
                  >
                    {day.slice(0, 3)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label className="mb-2 block">Color</Label>
              <div className="flex gap-2">
                {COLOR_OPTIONS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, color: c }))}
                    className={`w-8 h-8 rounded-full border-2 transition-colors ${
                      form.color === c ? "border-white" : "border-transparent"
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button type="submit">Create</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showAssign} onOpenChange={setShowAssign}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Member to {shifts.find((s) => s.id === selectedShift)?.name} - {selectedDay}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAssign} className="space-y-4">
            <div>
              <Label>Member</Label>
              <select
                value={assignForm.memberId}
                onChange={(e) => setAssignForm((p) => ({ ...p, memberId: e.target.value }))}
                className="flex h-9 w-full rounded-md border border-[#1e1e1e] bg-[#111111] px-3 py-1 text-sm text-white"
                required
              >
                <option value="">Select member</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.name} ({m.callSign ?? "N/A"})</option>
                ))}
              </select>
            </div>
            <input type="hidden" value={assignForm.date} />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setShowAssign(false)}>Cancel</Button>
              <Button type="submit">Assign</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
