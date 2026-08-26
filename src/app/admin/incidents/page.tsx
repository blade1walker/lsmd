"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ErrorState } from "@/components/ui/error-state";
import { fetchJson, fetchList, errorMessage } from "@/lib/fetch-json";
import { toast } from "sonner";

interface Incident {
  id: string;
  reportNumber: string;
  type: string;
  location: string;
  description: string;
  status: string;
  priority: string;
  reportedById: string;
  reportedBy: string;
  assignedToId: string | null;
  assignedTo: string | null;
  outcome: string | null;
  createdAt: string;
  members?: { member: { id: string; name: string; callSign: string; rank: string }; role: string }[];
}

const STATUS_COLORS: Record<string, string> = {
  Open: "bg-green-500/10 text-green-400",
  Closed: "bg-gray-500/10 text-gray-400",
  Pending: "bg-yellow-500/10 text-yellow-400",
};

const PRIORITY_COLORS: Record<string, string> = {
  High: "bg-red-500/10 text-red-400",
  Normal: "bg-blue-500/10 text-blue-400",
  Low: "bg-gray-500/10 text-gray-400",
};

const INCIDENT_TYPES = ["Traffic Stop", "Medical Emergency", "Fire", "Crime Report", "Accident", "Other"];
const PRIORITIES = ["Low", "Normal", "High"];
const STATUSES = ["Open", "Pending", "Closed"];

export default function AdminIncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [form, setForm] = useState({
    type: "Traffic Stop",
    location: "",
    description: "",
    priority: "Normal",
    reportedBy: "",
  });
  const [updateForm, setUpdateForm] = useState({ status: "", outcome: "", assignedTo: "" });

  const fetchIncidents = useCallback(async () => {
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set("status", filterStatus);
      if (filterType) params.set("type", filterType);
      if (filterPriority) params.set("priority", filterPriority);

      setIncidents(await fetchList<Incident>(`/api/admin/incidents?${params}`));
    } catch (err) {
      console.error("Failed to fetch incidents:", err);
      setError(errorMessage(err));
      setIncidents([]);
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterType, filterPriority]);

  useEffect(() => { fetchIncidents(); }, [fetchIncidents]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetchJson("/api/admin/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, reportedById: "admin" }),
      });
      toast.success("Incident created");
      setForm({ type: "Traffic Stop", location: "", description: "", priority: "Normal", reportedBy: "" });
      setShowCreate(false);
      fetchIncidents();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIncident) return;
    try {
      await fetchJson(`/api/admin/incidents/${selectedIncident.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateForm),
      });
      toast.success("Incident updated");
      setShowDetail(false);
      setSelectedIncident(null);
      fetchIncidents();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this incident?")) return;
    try {
      await fetchJson(`/api/admin/incidents/${id}`, { method: "DELETE" });
      toast.success("Incident deleted");
      setShowDetail(false);
      setSelectedIncident(null);
      fetchIncidents();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const openDetail = async (incident: Incident) => {
    try {
      const full = await fetchJson<Incident>(`/api/admin/incidents/${incident.id}`);
      setSelectedIncident(full);
      setUpdateForm({ status: full.status, outcome: full.outcome ?? "", assignedTo: full.assignedTo ?? "" });
      setShowDetail(true);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="text-gray-500">Loading incidents...</div></div>;
  }

  if (error) {
    return <ErrorState title="Failed to load incidents" message={error} onRetry={fetchIncidents} />;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-[family-name:var(--font-oswald)] text-2xl font-bold text-white uppercase">
            Incident Reports
          </h1>
          <p className="text-gray-500 text-sm mt-1">Track and manage incident reports</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>New Incident</Button>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="h-9 rounded-md border border-[#1e1e1e] bg-[#111111] px-3 py-1 text-sm text-white"
        >
          <option value="">All Statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="h-9 rounded-md border border-[#1e1e1e] bg-[#111111] px-3 py-1 text-sm text-white"
        >
          <option value="">All Types</option>
          {INCIDENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value)}
          className="h-9 rounded-md border border-[#1e1e1e] bg-[#111111] px-3 py-1 text-sm text-white"
        >
          <option value="">All Priorities</option>
          {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        {(filterStatus || filterType || filterPriority) && (
          <Button variant="ghost" size="sm" onClick={() => { setFilterStatus(""); setFilterType(""); setFilterPriority(""); }}>
            Clear Filters
          </Button>
        )}
      </div>

      <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1e1e1e]">
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Report #</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Location</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Reported By</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Priority</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Date</th>
              </tr>
            </thead>
            <tbody>
              {incidents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">No incidents found</td>
                </tr>
              ) : (
                incidents.map((inc) => (
                  <tr
                    key={inc.id}
                    className="border-b border-[#1e1e1e] hover:bg-white/5 cursor-pointer"
                    onClick={() => openDetail(inc)}
                  >
                    <td className="py-3 px-4 font-[family-name:var(--font-mono)] text-sm text-white">{inc.reportNumber}</td>
                    <td className="py-3 px-4 text-sm text-gray-400">{inc.type}</td>
                    <td className="py-3 px-4 text-sm text-gray-400">{inc.location}</td>
                    <td className="py-3 px-4 text-sm text-gray-400">{inc.reportedBy}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${PRIORITY_COLORS[inc.priority] ?? "bg-gray-500/10 text-gray-400"}`}>
                        {inc.priority}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_COLORS[inc.status] ?? "bg-gray-500/10 text-gray-400"}`}>
                        {inc.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-500">{new Date(inc.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Incident Report</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <Label>Type</Label>
              <select
                value={form.type}
                onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
                className="flex h-9 w-full rounded-md border border-[#1e1e1e] bg-[#111111] px-3 py-1 text-sm text-white"
                required
              >
                {INCIDENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <Label>Location</Label>
              <Input value={form.location} onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))} required />
            </div>
            <div>
              <Label>Description</Label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                className="flex min-h-[80px] w-full rounded-md border border-[#1e1e1e] bg-[#111111] px-3 py-2 text-sm text-white"
                required
              />
            </div>
            <div>
              <Label>Priority</Label>
              <select
                value={form.priority}
                onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value }))}
                className="flex h-9 w-full rounded-md border border-[#1e1e1e] bg-[#111111] px-3 py-1 text-sm text-white"
              >
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <Label>Reported By</Label>
              <Input value={form.reportedBy} onChange={(e) => setForm((p) => ({ ...p, reportedBy: e.target.value }))} required />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button type="submit">Create</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedIncident && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <span className="font-[family-name:var(--font-mono)]">{selectedIncident.reportNumber}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_COLORS[selectedIncident.status]}`}>
                    {selectedIncident.status}
                  </span>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-gray-500">Type:</span> <span className="text-white ml-2">{selectedIncident.type}</span></div>
                  <div><span className="text-gray-500">Location:</span> <span className="text-white ml-2">{selectedIncident.location}</span></div>
                  <div><span className="text-gray-500">Reported By:</span> <span className="text-white ml-2">{selectedIncident.reportedBy}</span></div>
                  <div><span className="text-gray-500">Priority:</span> <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${PRIORITY_COLORS[selectedIncident.priority]}`}>{selectedIncident.priority}</span></div>
                  <div className="col-span-2"><span className="text-gray-500">Description:</span> <span className="text-white ml-2">{selectedIncident.description}</span></div>
                </div>

                {selectedIncident.members && selectedIncident.members.length > 0 && (
                  <div>
                    <h3 className="text-sm text-gray-500 mb-2">Involved Members</h3>
                    <div className="space-y-1">
                      {selectedIncident.members.map((m, i) => (
                        <div key={i} className="text-sm text-white bg-white/5 rounded px-3 py-1.5">
                          {m.member.name} ({m.member.callSign}) - {m.role}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <form onSubmit={handleUpdate} className="space-y-4 border-t border-[#1e1e1e] pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Status</Label>
                      <select
                        value={updateForm.status}
                        onChange={(e) => setUpdateForm((p) => ({ ...p, status: e.target.value }))}
                        className="flex h-9 w-full rounded-md border border-[#1e1e1e] bg-[#111111] px-3 py-1 text-sm text-white"
                      >
                        {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <Label>Assigned To</Label>
                      <Input value={updateForm.assignedTo} onChange={(e) => setUpdateForm((p) => ({ ...p, assignedTo: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <Label>Outcome</Label>
                    <textarea
                      value={updateForm.outcome}
                      onChange={(e) => setUpdateForm((p) => ({ ...p, outcome: e.target.value }))}
                      className="flex min-h-[60px] w-full rounded-md border border-[#1e1e1e] bg-[#111111] px-3 py-2 text-sm text-white"
                    />
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="ghost" className="text-red-400 mr-auto" onClick={() => handleDelete(selectedIncident.id)}>
                      Delete
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => setShowDetail(false)}>Cancel</Button>
                    <Button type="submit">Update</Button>
                  </DialogFooter>
                </form>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
