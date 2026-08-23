"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle, XCircle, Loader2, Upload, Eye, Trash2 } from "lucide-react";

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

export default function AdminRecruitPage() {
  const [requests, setRequests] = useState<RecruitRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<RecruitRequest | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [importing, setImporting] = useState(false);
  const [importCount, setImportCount] = useState(0);
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

  const handleCSVImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const text = await file.text();
      const lines = text.split("\n").filter((l) => l.trim());
      const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());

      const discordIdIdx = headers.findIndex((h) => h === "discord id");
      const steamIdIdx = headers.findIndex((h) => h === "steam id");
      const discordUsernameIdx = headers.findIndex((h) => h === "discord username");
      const characterNameIdx = headers.findIndex((h) => h === "character name");
      const userIdx = headers.findIndex((h) => h === "user");

      if (discordIdIdx === -1 || steamIdIdx === -1) {
        alert("CSV must contain 'Discord ID' and 'Steam ID' columns");
        setImporting(false);
        return;
      }

      const data = lines.slice(1).map((line) => {
        const cols = line.split(",").map((c) => c.trim());
        return {
          discordId: cols[discordIdIdx],
          steamId: cols[steamIdIdx],
          discordUsername: discordUsernameIdx >= 0 ? cols[discordUsernameIdx] : null,
          characterName: characterNameIdx >= 0 ? cols[characterNameIdx] : null,
          user: userIdx >= 0 ? cols[userIdx] : null,
        };
      }).filter((r) => r.discordId && r.steamId);

      const res = await fetch("/api/recruit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        const result = await res.json();
        setImportCount(result.count);
        fetchRequests();
      }
    } catch (err) {
      console.error(err);
    }
    setImporting(false);
    if (fileRef.current) fileRef.current.value = "";
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

  const handleDelete = async (id: string) => {
    await fetch(`/api/recruit/${id}`, { method: "DELETE" });
    fetchRequests();
  };

  const pending = requests.filter((r) => r.status === "Pending");
  const reviewed = requests.filter((r) => r.status !== "Pending");

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-[family-name:var(--font-oswald)] text-2xl font-bold text-white uppercase">
            Recruit Management
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Import and manage recruitment applications
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            onChange={handleCSVImport}
            className="hidden"
          />
          <Button
            onClick={() => fileRef.current?.click()}
            disabled={importing}
            className="bg-[#eab308] text-black hover:bg-[#ca8a04]"
          >
            {importing ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Upload className="w-4 h-4 mr-2" />
            )}
            Import CSV
          </Button>
        </div>
      </div>

      <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl p-4 mb-6">
        <p className="text-gray-400 text-sm">
          <strong>CSV Columns:</strong> <code className="bg-white/10 px-1 rounded">Discord ID</code>, <code className="bg-white/10 px-1 rounded">Steam ID</code>, <code className="bg-white/10 px-1 rounded">Character Name</code>, <code className="bg-white/10 px-1 rounded">Discord Username</code>, <code className="bg-white/10 px-1 rounded">User</code>
        </p>
      </div>

      {importCount > 0 && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 mb-6 text-green-400 text-sm">
          Successfully imported {importCount} recruits
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <Loader2 className="w-8 h-8 text-gray-500 animate-spin mx-auto" />
        </div>
      ) : (
        <>
          {/* Pending */}
          <div className="mb-8">
            <h2 className="font-[family-name:var(--font-oswald)] text-lg font-semibold text-white mb-4">
              Pending ({pending.length})
            </h2>
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
                        <td className="py-3 px-4 text-gray-500 text-xs">
                          {new Date(req.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              onClick={() => setSelectedRequest(req)}
                              variant="outline"
                              className="border-[#1e1e1e] text-gray-400"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleAction(req.id, "Approved")}
                              disabled={processingId === req.id}
                              className="bg-green-600 hover:bg-green-700 text-white"
                            >
                              {processingId === req.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleAction(req.id, "Declined")}
                              disabled={processingId === req.id}
                              className="bg-red-600 hover:bg-red-700 text-white"
                            >
                              {processingId === req.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleDelete(req.id)}
                              variant="ghost"
                              className="text-gray-500 hover:text-red-400"
                            >
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

          {/* Reviewed */}
          <div>
            <h2 className="font-[family-name:var(--font-oswald)] text-lg font-semibold text-white mb-4">
              Reviewed ({reviewed.length})
            </h2>
            {reviewed.length === 0 ? (
              <p className="text-gray-500 text-sm">No reviewed recruits</p>
            ) : (
              <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#1e1e1e]">
                      <th className="text-left py-3 px-4 text-gray-500 font-medium">Name</th>
                      <th className="text-left py-3 px-4 text-gray-500 font-medium">Discord</th>
                      <th className="text-left py-3 px-4 text-gray-500 font-medium">Status</th>
                      <th className="text-left py-3 px-4 text-gray-500 font-medium">Reviewed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reviewed.map((req) => (
                      <tr key={req.id} className="border-b border-[#1e1e1e]/50 opacity-70">
                        <td className="py-3 px-4 text-white">{req.characterName ?? "—"}</td>
                        <td className="py-3 px-4 text-gray-400 text-xs">{req.discordUsername ?? req.discordId}</td>
                        <td className="py-3 px-4">
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            req.status === "Approved"
                              ? "bg-green-500/20 text-green-400"
                              : "bg-red-500/20 text-red-400"
                          }`}>
                            {req.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-gray-500 text-xs">
                          {req.reviewedBy ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Review Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl p-6 max-w-lg w-full">
            <h3 className="font-[family-name:var(--font-oswald)] text-lg font-semibold text-white mb-4">
              Review Recruitment
            </h3>
            <div className="space-y-3 mb-4">
              <div>
                <span className="text-gray-500 text-sm">Character Name:</span>
                <span className="text-white ml-2">{selectedRequest.characterName ?? "—"}</span>
              </div>
              <div>
                <span className="text-gray-500 text-sm">Discord Username:</span>
                <span className="text-white ml-2">{selectedRequest.discordUsername ?? "—"}</span>
              </div>
              <div>
                <span className="text-gray-500 text-sm">Discord ID:</span>
                <span className="text-white ml-2">{selectedRequest.discordId}</span>
              </div>
              <div>
                <span className="text-gray-500 text-sm">User:</span>
                <span className="text-white ml-2">{selectedRequest.user ?? "—"}</span>
              </div>
              <div>
                <span className="text-gray-500 text-sm">Steam ID:</span>
                <span className="text-white ml-2">{selectedRequest.steamId}</span>
              </div>
            </div>
            <div className="mb-4">
              <Label className="text-gray-400 text-sm">Custom DM Message (optional)</Label>
              <textarea
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                placeholder="Leave empty for default message..."
                rows={4}
                className="mt-1 w-full bg-[#0a0a0a] border border-[#1e1e1e] rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#eab308] resize-none"
              />
            </div>
            <div className="mb-4">
              <Label className="text-gray-400 text-sm">Review Note (optional)</Label>
              <textarea
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                rows={2}
                className="mt-1 w-full bg-[#0a0a0a] border border-[#1e1e1e] rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#eab308] resize-none"
              />
            </div>
            <div className="flex gap-3">
              <Button
                onClick={() => handleAction(selectedRequest.id, "Approved")}
                disabled={processingId === selectedRequest.id}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
              >
                Approve
              </Button>
              <Button
                onClick={() => handleAction(selectedRequest.id, "Declined")}
                disabled={processingId === selectedRequest.id}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              >
                Decline
              </Button>
              <Button
                onClick={() => { setSelectedRequest(null); setReviewNote(""); setCustomMessage(""); }}
                variant="outline"
                className="border-[#1e1e1e] text-gray-400"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
