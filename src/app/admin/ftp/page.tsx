"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Loader2, Eye } from "lucide-react";

interface FTPRequest {
  id: string;
  characterName: string;
  discordId: string;
  currentRole: string;
  previousExperience: string;
  department: string;
  status: string;
  reviewedBy: string | null;
  reviewNote: string | null;
  createdAt: string;
}

export default function AdminFTPPage() {
  const [requests, setRequests] = useState<FTPRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<FTPRequest | null>(null);
  const [reviewNote, setReviewNote] = useState("");

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const res = await fetch("/api/ftp");
      if (res.ok) {
        const data = await res.json();
        setRequests(data);
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const handleAction = async (id: string, status: string) => {
    setProcessingId(id);
    try {
      const res = await fetch(`/api/ftp/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, reviewNote, reviewedBy: "HR" }),
      });
      if (res.ok) {
        setRequests((prev) =>
          prev.map((r) => (r.id === id ? { ...r, status, reviewNote } : r))
        );
        setSelectedRequest(null);
        setReviewNote("");
      }
    } catch (err) {
      console.error(err);
    }
    setProcessingId(null);
  };

  const pending = requests.filter((r) => r.status === "Pending");
  const reviewed = requests.filter((r) => r.status !== "Pending");

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-[family-name:var(--font-oswald)] text-2xl font-bold text-white uppercase">
          FTP Applications
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Review and manage Field Training Program requests
        </p>
      </div>

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
              <p className="text-gray-500 text-sm">No pending requests</p>
            ) : (
              <div className="space-y-3">
                {pending.map((req) => (
                  <div
                    key={req.id}
                    className="bg-[#111111] border border-[#1e1e1e] rounded-xl p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-white font-medium">{req.characterName}</div>
                        <div className="text-gray-500 text-sm">
                          {req.currentRole} • {req.department} • Discord: {req.discordId}
                        </div>
                        {req.previousExperience && (
                          <div className="text-gray-600 text-xs mt-1">
                            Experience: {req.previousExperience}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
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
                          {processingId === req.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <CheckCircle className="w-4 h-4" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleAction(req.id, "Declined")}
                          disabled={processingId === req.id}
                          className="bg-red-600 hover:bg-red-700 text-white"
                        >
                          {processingId === req.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <XCircle className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Reviewed */}
          <div>
            <h2 className="font-[family-name:var(--font-oswald)] text-lg font-semibold text-white mb-4">
              Reviewed ({reviewed.length})
            </h2>
            {reviewed.length === 0 ? (
              <p className="text-gray-500 text-sm">No reviewed requests</p>
            ) : (
              <div className="space-y-3">
                {reviewed.map((req) => (
                  <div
                    key={req.id}
                    className="bg-[#111111] border border-[#1e1e1e] rounded-xl p-4 opacity-70"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-white font-medium">{req.characterName}</span>
                          <span
                            className={`text-xs px-2 py-0.5 rounded ${
                              req.status === "Approved"
                                ? "bg-green-500/20 text-green-400"
                                : "bg-red-500/20 text-red-400"
                            }`}
                          >
                            {req.status}
                          </span>
                        </div>
                        <div className="text-gray-500 text-sm">
                          {req.currentRole} • {req.department}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
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
              Review FTP Application
            </h3>
            <div className="space-y-3 mb-4">
              <div>
                <span className="text-gray-500 text-sm">Character:</span>
                <span className="text-white ml-2">{selectedRequest.characterName}</span>
              </div>
              <div>
                <span className="text-gray-500 text-sm">Discord ID:</span>
                <span className="text-white ml-2">{selectedRequest.discordId}</span>
              </div>
              <div>
                <span className="text-gray-500 text-sm">Current Role:</span>
                <span className="text-white ml-2">{selectedRequest.currentRole}</span>
              </div>
              <div>
                <span className="text-gray-500 text-sm">Department:</span>
                <span className="text-white ml-2">{selectedRequest.department}</span>
              </div>
              {selectedRequest.previousExperience && (
                <div>
                  <span className="text-gray-500 text-sm">Experience:</span>
                  <span className="text-white ml-2">{selectedRequest.previousExperience}</span>
                </div>
              )}
            </div>
            <div className="mb-4">
              <label className="text-gray-400 text-sm">Review Note (optional)</label>
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
                onClick={() => { setSelectedRequest(null); setReviewNote(""); }}
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
