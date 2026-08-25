"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle, XCircle, Loader2, Upload, Eye, Trash2, Plus, Pencil, Send, X, ClipboardList } from "lucide-react";
import * as XLSX from "xlsx";

interface RecruitRequest {
  id: string;
  discordId: string;
  discordUsername: string | null;
  steamId: string;
  characterName: string | null;
  user: string | null;
  status: string;
  reviewedBy: string | null;
  reviewNote: string | null;
  createdAt: string;
}

const EMPTY_FORM = {
  discordId: "",
  discordUsername: "",
  steamId: "",
  characterName: "",
  user: "",
};

export default function AdminRecruitPage() {
  const [requests, setRequests] = useState<RecruitRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<RecruitRequest | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [importing, setImporting] = useState(false);
  const [importCount, setImportCount] = useState(0);
  const [importUpdated, setImportUpdated] = useState(0);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState<RecruitRequest | null>(null);
  const [showTestModal, setShowTestModal] = useState(false);
  const [testTarget, setTestTarget] = useState({ discordId: "", characterName: "" });
  const [testMessage, setTestMessage] = useState("");
  const [testType, setTestType] = useState<"dm" | "webhook">("dm");
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"pending" | "log">("pending");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const res = await fetch("/api/recruit");
      if (res.ok) {
        const data = await res.json();
        setRequests(data);
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(sheet) as any[];

      if (jsonData.length === 0) {
        alert("No data found in the file");
        setImporting(false);
        return;
      }

      const headers = Object.keys(jsonData[0]).map((h) => h.trim().toLowerCase());

      const discordIdIdx = headers.findIndex((h) => h === "discord id");
      const steamIdIdx = headers.findIndex((h) => h === "steam id");
      const discordUsernameIdx = headers.findIndex((h) => h === "discord username");
      const characterNameIdx = headers.findIndex((h) => h === "character name");
      const userIdx = headers.findIndex((h) => h === "user");

      if (discordIdIdx === -1) {
        alert("File must contain 'Discord ID' column");
        setImporting(false);
        return;
      }

      const importData = jsonData.map((row: any) => {
        const keys = Object.keys(row);
        return {
          discordId: String(row[keys[discordIdIdx]] || ""),
          steamId: String(row[keys[steamIdIdx]] || ""),
          discordUsername: discordUsernameIdx >= 0 ? String(row[keys[discordUsernameIdx]] || "") : null,
          characterName: characterNameIdx >= 0 ? String(row[keys[characterNameIdx]] || "") : null,
          user: userIdx >= 0 ? String(row[keys[userIdx]] || "") : null,
        };
      }).filter((r) => r.discordId);

      const res = await fetch("/api/recruit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(importData),
      });

      if (res.ok) {
        const result = await res.json();
        setImportCount(result.count);
        setImportUpdated(result.updated || 0);
        fetchRequests();
      }
    } catch (err) {
      console.error(err);
      alert("Failed to parse file");
    }
    setImporting(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleAddManual = async () => {
    if (!form.discordId) {
      alert("Discord ID is required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/recruit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify([form]),
      });
      if (res.ok) {
        setForm(EMPTY_FORM);
        setShowAddModal(false);
        fetchRequests();
      }
    } catch (err) {
      console.error(err);
    }
    setSaving(false);
  };

  const handleEditSave = async () => {
    if (!showEditModal) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/recruit/${showEditModal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          discordId: form.discordId,
          discordUsername: form.discordUsername || null,
          steamId: form.steamId,
          characterName: form.characterName || null,
          user: form.user || null,
          status: showEditModal.status,
          reviewedBy: showEditModal.reviewedBy,
          reviewNote: showEditModal.reviewNote,
        }),
      });
      if (res.ok) {
        setShowEditModal(null);
        fetchRequests();
      }
    } catch (err) {
      console.error(err);
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this recruit?")) return;
    await fetch(`/api/recruit/${id}`, { method: "DELETE" });
    fetchRequests();
  };

  const handleAction = async (id: string, status: string) => {
    setProcessingId(id);
    try {
      const res = await fetch(`/api/recruit/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, reviewNote, customMessage, reviewedBy: "HR" }),
      });
      if (res.ok) {
        setRequests((prev) =>
          prev.map((r) => (r.id === id ? { ...r, status, reviewNote } : r))
        );
        setSelectedRequest(null);
        setReviewNote("");
        setCustomMessage("");
      }
    } catch (err) {
      console.error(err);
    }
    setProcessingId(null);
  };

  const handleTestSend = async () => {
    if (!testTarget.discordId) {
      alert("Enter a Discord ID to test");
      return;
    }
    setTestSending(true);
    setTestResult("");
    try {
      const res = await fetch("/api/recruit/test-webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          discordId: testTarget.discordId,
          characterName: testTarget.characterName,
          message: testMessage,
          type: testType,
        }),
      });
      const data = await res.json();
      setTestResult(res.ok ? `${testType === "dm" ? "DM" : "Webhook"} sent successfully!` : `Failed: ${data.error || "Unknown error"}`);
    } catch (err) {
      setTestResult("Failed to send test");
    }
    setTestSending(false);
  };

  const openEditModal = (req: RecruitRequest) => {
    setForm({
      discordId: req.discordId,
      discordUsername: req.discordUsername || "",
      steamId: req.steamId,
      characterName: req.characterName || "",
      user: req.user || "",
    });
    setShowEditModal(req);
  };

  const pending = requests.filter((r) => r.status === "Pending");
  const approved = requests.filter((r) => r.status === "Approved");
  const declined = requests.filter((r) => r.status === "Declined");
  const allReviewed = [...approved, ...declined].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-[family-name:var(--font-oswald)] text-2xl font-bold text-white uppercase">
            Recruit Management
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Import, add, and manage recruitment applications
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleFileImport} className="hidden" />
          <Button onClick={() => fileRef.current?.click()} disabled={importing} className="bg-[#dc2626] text-black hover:bg-[#b91c1c]">
            {importing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
            Import File
          </Button>
          <Button onClick={() => { setForm(EMPTY_FORM); setShowAddModal(true); }} className="bg-green-600 hover:bg-green-700 text-white">
            <Plus className="w-4 h-4 mr-2" />
            Add Manually
          </Button>
          <Button onClick={() => { setTestTarget({ discordId: "", characterName: "" }); setTestMessage(""); setTestType("dm"); setTestResult(""); setShowTestModal(true); }} variant="outline" className="border-[#1e1e1e] text-gray-400">
            <Send className="w-4 h-4 mr-2" />
            Test DM
          </Button>
        </div>
      </div>

      <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl p-4 mb-6">
        <p className="text-gray-400 text-sm">
          <strong>Import:</strong> CSV/XLSX/XLS with columns <code className="bg-white/10 px-1 rounded">Discord ID</code>, <code className="bg-white/10 px-1 rounded">Steam ID</code>, <code className="bg-white/10 px-1 rounded">Character Name</code>, <code className="bg-white/10 px-1 rounded">Discord Username</code>, <code className="bg-white/10 px-1 rounded">User</code>
        </p>
      </div>

      {importCount > 0 && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 mb-6 text-green-400 text-sm">
          Imported {importCount} new recruits{importUpdated > 0 ? `, updated ${importUpdated} existing` : ""}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-[#111111] border border-[#1e1e1e] rounded-xl p-1 w-fit">
        <button
          onClick={() => setActiveTab("pending")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "pending" ? "bg-[#dc2626] text-black" : "text-gray-400 hover:text-white"
          }`}
        >
          Pending ({pending.length})
        </button>
        <button
          onClick={() => setActiveTab("log")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "log" ? "bg-[#dc2626] text-black" : "text-gray-400 hover:text-white"
          }`}
        >
          <ClipboardList className="w-4 h-4 mr-1 inline" />
          Approve Log ({allReviewed.length})
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <Loader2 className="w-8 h-8 text-gray-500 animate-spin mx-auto" />
        </div>
      ) : (
        <>
          {/* Pending Tab */}
          {activeTab === "pending" && (
            <div>
              {pending.length === 0 ? (
                <p className="text-gray-500 text-sm">No pending recruits</p>
              ) : (
                <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#1e1e1e]">
                        <th className="text-left py-3 px-4 text-gray-500 font-medium">Name</th>
                        <th className="text-left py-3 px-4 text-gray-500 font-medium">Discord</th>
                        <th className="text-left py-3 px-4 text-gray-500 font-medium">User</th>
                        <th className="text-left py-3 px-4 text-gray-500 font-medium">Steam ID</th>
                        <th className="text-left py-3 px-4 text-gray-500 font-medium">Submitted</th>
                        <th className="text-left py-3 px-4 text-gray-500 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pending.map((req) => (
                        <tr key={req.id} className="border-b border-[#1e1e1e]/50 hover:bg-white/5">
                          <td className="py-3 px-4 text-white">{req.characterName ?? "—"}</td>
                          <td className="py-3 px-4 text-gray-400 text-xs">{req.discordUsername ?? req.discordId}</td>
                          <td className="py-3 px-4 text-gray-400 text-xs">{req.user ?? "—"}</td>
                          <td className="py-3 px-4 text-gray-400 text-xs">{req.steamId}</td>
                          <td className="py-3 px-4 text-gray-500 text-xs">{new Date(req.createdAt).toLocaleDateString()}</td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1">
                              <Button size="sm" onClick={() => setSelectedRequest(req)} variant="outline" className="border-[#1e1e1e] text-gray-400">
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button size="sm" onClick={() => openEditModal(req)} variant="outline" className="border-[#1e1e1e] text-gray-400">
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button size="sm" onClick={() => handleAction(req.id, "Approved")} disabled={processingId === req.id} className="bg-green-600 hover:bg-green-700 text-white">
                                {processingId === req.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                              </Button>
                              <Button size="sm" onClick={() => handleAction(req.id, "Declined")} disabled={processingId === req.id} className="bg-red-600 hover:bg-red-700 text-white">
                                {processingId === req.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                              </Button>
                              <Button size="sm" onClick={() => handleDelete(req.id)} variant="ghost" className="text-gray-500 hover:text-red-400">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Approve Log Tab */}
          {activeTab === "log" && (
            <div>
              {allReviewed.length === 0 ? (
                <p className="text-gray-500 text-sm">No reviewed recruits yet</p>
              ) : (
                <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#1e1e1e]">
                        <th className="text-left py-3 px-4 text-gray-500 font-medium">Name</th>
                        <th className="text-left py-3 px-4 text-gray-500 font-medium">Discord</th>
                        <th className="text-left py-3 px-4 text-gray-500 font-medium">User</th>
                        <th className="text-left py-3 px-4 text-gray-500 font-medium">Status</th>
                        <th className="text-left py-3 px-4 text-gray-500 font-medium">Reviewed By</th>
                        <th className="text-left py-3 px-4 text-gray-500 font-medium">Note</th>
                        <th className="text-left py-3 px-4 text-gray-500 font-medium">Date</th>
                        <th className="text-left py-3 px-4 text-gray-500 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allReviewed.map((req) => (
                        <tr key={req.id} className="border-b border-[#1e1e1e]/50 hover:bg-white/5">
                          <td className="py-3 px-4 text-white">{req.characterName ?? "—"}</td>
                          <td className="py-3 px-4 text-gray-400 text-xs">{req.discordUsername ?? req.discordId}</td>
                          <td className="py-3 px-4 text-gray-400 text-xs">{req.user ?? "—"}</td>
                          <td className="py-3 px-4">
                            <span className={`text-xs px-2 py-0.5 rounded ${req.status === "Approved" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                              {req.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-gray-400 text-xs">{req.reviewedBy ?? "—"}</td>
                          <td className="py-3 px-4 text-gray-500 text-xs max-w-[150px] truncate">{req.reviewNote ?? "—"}</td>
                          <td className="py-3 px-4 text-gray-500 text-xs">{new Date(req.createdAt).toLocaleDateString()}</td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1">
                              <Button size="sm" onClick={() => openEditModal(req)} variant="outline" className="border-[#1e1e1e] text-gray-400">
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button size="sm" onClick={() => handleDelete(req.id)} variant="ghost" className="text-gray-500 hover:text-red-400">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Review Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl p-6 max-w-lg w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-[family-name:var(--font-oswald)] text-lg font-semibold text-white">Review Recruitment</h3>
              <Button size="sm" onClick={() => { setSelectedRequest(null); setReviewNote(""); setCustomMessage(""); }} variant="ghost" className="text-gray-400"><X className="w-4 h-4" /></Button>
            </div>
            <div className="space-y-3 mb-4">
              <div><span className="text-gray-500 text-sm">Character Name:</span><span className="text-white ml-2">{selectedRequest.characterName ?? "—"}</span></div>
              <div><span className="text-gray-500 text-sm">Discord Username:</span><span className="text-white ml-2">{selectedRequest.discordUsername ?? "—"}</span></div>
              <div><span className="text-gray-500 text-sm">Discord ID:</span><span className="text-white ml-2">{selectedRequest.discordId}</span></div>
              <div><span className="text-gray-500 text-sm">User:</span><span className="text-white ml-2">{selectedRequest.user ?? "—"}</span></div>
              <div><span className="text-gray-500 text-sm">Steam ID:</span><span className="text-white ml-2">{selectedRequest.steamId}</span></div>
            </div>
            <div className="mb-4">
              <Label className="text-gray-400 text-sm">Custom DM Message (optional)</Label>
              <textarea value={customMessage} onChange={(e) => setCustomMessage(e.target.value)} placeholder="Leave empty for default message..." rows={4} className="mt-1 w-full bg-[#0a0a0a] border border-[#1e1e1e] rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#dc2626] resize-none" />
            </div>
            <div className="mb-4">
              <Label className="text-gray-400 text-sm">Review Note (optional)</Label>
              <textarea value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} rows={2} className="mt-1 w-full bg-[#0a0a0a] border border-[#1e1e1e] rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#dc2626] resize-none" />
            </div>
            <div className="flex gap-3">
              <Button onClick={() => handleAction(selectedRequest.id, "Approved")} disabled={processingId === selectedRequest.id} className="flex-1 bg-green-600 hover:bg-green-700 text-white">Approve</Button>
              <Button onClick={() => handleAction(selectedRequest.id, "Declined")} disabled={processingId === selectedRequest.id} className="flex-1 bg-red-600 hover:bg-red-700 text-white">Decline</Button>
              <Button onClick={() => { setSelectedRequest(null); setReviewNote(""); setCustomMessage(""); }} variant="outline" className="border-[#1e1e1e] text-gray-400">Cancel</Button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      {(showAddModal || showEditModal) && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl p-6 max-w-lg w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-[family-name:var(--font-oswald)] text-lg font-semibold text-white">
                {showEditModal ? "Edit Recruit" : "Add Recruit Manually"}
              </h3>
              <Button size="sm" onClick={() => { setShowAddModal(false); setShowEditModal(null); setForm(EMPTY_FORM); }} variant="ghost" className="text-gray-400"><X className="w-4 h-4" /></Button>
            </div>
            <div className="space-y-4">
              <div>
                <Label className="text-gray-400 text-sm">Discord ID *</Label>
                <Input value={form.discordId} onChange={(e) => setForm({ ...form, discordId: e.target.value })} placeholder="e.g. 721646919222427648" className="mt-1 bg-[#0a0a0a] border-[#1e1e1e] text-white" />
              </div>
              <div>
                <Label className="text-gray-400 text-sm">Discord Username</Label>
                <Input value={form.discordUsername} onChange={(e) => setForm({ ...form, discordUsername: e.target.value })} placeholder="e.g. username#1234" className="mt-1 bg-[#0a0a0a] border-[#1e1e1e] text-white" />
              </div>
              <div>
                <Label className="text-gray-400 text-sm">Steam ID</Label>
                <Input value={form.steamId} onChange={(e) => setForm({ ...form, steamId: e.target.value })} placeholder="e.g. 123456789" className="mt-1 bg-[#0a0a0a] border-[#1e1e1e] text-white" />
              </div>
              <div>
                <Label className="text-gray-400 text-sm">Character Name</Label>
                <Input value={form.characterName} onChange={(e) => setForm({ ...form, characterName: e.target.value })} placeholder="e.g. John Smith" className="mt-1 bg-[#0a0a0a] border-[#1e1e1e] text-white" />
              </div>
              <div>
                <Label className="text-gray-400 text-sm">User</Label>
                <Input value={form.user} onChange={(e) => setForm({ ...form, user: e.target.value })} placeholder="e.g. User#1234" className="mt-1 bg-[#0a0a0a] border-[#1e1e1e] text-white" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <Button onClick={showEditModal ? handleEditSave : handleAddManual} disabled={saving} className="flex-1 bg-[#dc2626] text-black hover:bg-[#b91c1c]">
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                {showEditModal ? "Save Changes" : "Add Recruit"}
              </Button>
              <Button onClick={() => { setShowAddModal(false); setShowEditModal(null); setForm(EMPTY_FORM); }} variant="outline" className="border-[#1e1e1e] text-gray-400">Cancel</Button>
            </div>
          </div>
        </div>
      )}

      {/* Test DM Modal */}
      {showTestModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl p-6 max-w-lg w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-[family-name:var(--font-oswald)] text-lg font-semibold text-white">Test DM / Webhook</h3>
              <Button size="sm" onClick={() => setShowTestModal(false)} variant="ghost" className="text-gray-400"><X className="w-4 h-4" /></Button>
            </div>
            <div className="flex gap-2 mb-4">
              <Button size="sm" onClick={() => setTestType("dm")} className={testType === "dm" ? "bg-[#dc2626] text-black" : "bg-[#1a1a1a] text-gray-400"}>Direct Message</Button>
              <Button size="sm" onClick={() => setTestType("webhook")} className={testType === "webhook" ? "bg-[#dc2626] text-black" : "bg-[#1a1a1a] text-gray-400"}>Webhook</Button>
            </div>
            <div className="space-y-4">
              <div>
                <Label className="text-gray-400 text-sm">Discord ID *</Label>
                <Input value={testTarget.discordId} onChange={(e) => setTestTarget({ ...testTarget, discordId: e.target.value })} placeholder="Your Discord ID" className="mt-1 bg-[#0a0a0a] border-[#1e1e1e] text-white" />
              </div>
              <div>
                <Label className="text-gray-400 text-sm">Character Name</Label>
                <Input value={testTarget.characterName} onChange={(e) => setTestTarget({ ...testTarget, characterName: e.target.value })} placeholder="Optional" className="mt-1 bg-[#0a0a0a] border-[#1e1e1e] text-white" />
              </div>
              <div>
                <Label className="text-gray-400 text-sm">Test Message</Label>
                <textarea value={testMessage} onChange={(e) => setTestMessage(e.target.value)} rows={4} placeholder="Leave empty for default test message..." className="mt-1 w-full bg-[#0a0a0a] border border-[#1e1e1e] rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#dc2626] resize-none" />
              </div>
            </div>
            {testResult && (
              <div className={`mt-4 p-3 rounded text-sm ${testResult.includes("success") ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
                {testResult}
              </div>
            )}
            <div className="flex gap-3 mt-4">
              <Button onClick={handleTestSend} disabled={testSending || !testTarget.discordId} className="flex-1 bg-[#dc2626] text-black hover:bg-[#b91c1c]">
                {testSending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                Send Test
              </Button>
              <Button onClick={() => setShowTestModal(false)} variant="outline" className="border-[#1e1e1e] text-gray-400">Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
