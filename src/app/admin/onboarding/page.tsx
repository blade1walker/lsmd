"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, X, UserPlus } from "lucide-react";
import { RANK_NAMES } from "@/lib/constants";

interface OnboardingRequest {
  id: string;
  name: string;
  discordId: string;
  stateId: string | null;
  steamId: string | null;
  reason: string | null;
  status: string;
  assignedRank: string | null;
  reviewedBy: string | null;
  createdAt: string;
}

export default function AdminOnboardingPage() {
  const [requests, setRequests] = useState<OnboardingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [rank, setRank] = useState("Medical Intern");

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/onboarding");
      const data = await res.json();
      setRequests(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleApprove = async (id: string) => {
    await fetch(`/api/onboarding/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "Approved",
        assignedRank: rank,
        reviewedBy: "Admin",
      }),
    });
    setReviewingId(null);
    fetchData();
  };

  const handleDecline = async (id: string) => {
    await fetch(`/api/onboarding/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "Declined", reviewedBy: "Admin" }),
    });
    fetchData();
  };

  const pending = requests.filter((r) => r.status === "Pending");
  const reviewed = requests.filter((r) => r.status !== "Pending");

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-[family-name:var(--font-oswald)] text-2xl font-bold text-white uppercase">
          Onboarding Requests
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Review and approve new member applications
        </p>
      </div>

      {/* Pending Requests */}
      <div className="bg-[#111111] border border-yellow-500/20 rounded-xl overflow-hidden mb-8">
        <div className="px-6 py-4 border-b border-[#1e1e1e] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-yellow-400" />
            <h2 className="font-[family-name:var(--font-oswald)] text-lg font-bold text-white uppercase">
              Pending Applications
            </h2>
          </div>
          {pending.length > 0 && (
            <span className="px-2 py-0.5 bg-yellow-500/10 text-yellow-400 text-xs rounded-full">
              {pending.length} pending
            </span>
          )}
        </div>
        <div className="divide-y divide-[#1e1e1e]">
          {pending.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">No pending applications</div>
          ) : (
            pending.map((req) => (
              <div key={req.id} className="px-6 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="text-white font-medium">{req.name}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      Discord: {req.discordId}
                      {req.stateId && ` • State ID: ${req.stateId}`}
                      {req.steamId && ` • Steam: ${req.steamId}`}
                    </div>
                    {req.reason && (
                      <div className="text-xs text-gray-400 mt-2 italic">"{req.reason}"</div>
                    )}
                    <div className="text-xs text-gray-500 mt-1">
                      Applied {new Date(req.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex gap-2 items-start">
                    {reviewingId === req.id ? (
                      <div className="flex items-center gap-2">
                        <select
                          value={rank}
                          onChange={(e) => setRank(e.target.value)}
                          className="h-9 rounded-md border border-[#1e1e1e] bg-black text-white px-3 text-sm"
                          style={{ colorScheme: "dark" }}
                        >
                          {RANK_NAMES.map((r) => (
                            <option key={r} value={r} className="bg-black text-white">{r}</option>
                          ))}
                        </select>
                        <Button size="sm" onClick={() => handleApprove(req.id)} className="bg-green-600 hover:bg-green-700 text-white">
                          <Check className="w-4 h-4 mr-1" /> Confirm
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setReviewingId(null)} className="text-gray-400">
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <>
                        <Button size="sm" onClick={() => setReviewingId(req.id)} className="bg-green-600 hover:bg-green-700 text-white">
                          <Check className="w-4 h-4 mr-1" /> Approve
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDecline(req.id)} className="text-red-400 hover:text-red-300 hover:bg-red-500/10">
                          <X className="w-4 h-4 mr-1" /> Decline
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Reviewed */}
      {reviewed.length > 0 && (
        <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[#1e1e1e]">
            <h2 className="font-[family-name:var(--font-oswald)] text-lg font-bold text-white uppercase">
              Reviewed Applications
            </h2>
          </div>
          <div className="divide-y divide-[#1e1e1e]">
            {reviewed.map((req) => (
              <div key={req.id} className="px-6 py-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="text-white text-sm font-medium">{req.name}</div>
                  <div className="text-xs text-gray-500">Discord: {req.discordId}</div>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs ${
                  req.status === "Approved"
                    ? "bg-green-500/10 text-green-400"
                    : "bg-red-500/10 text-red-400"
                }`}>
                  {req.status}
                </span>
                {req.assignedRank && (
                  <span className="text-xs text-[#eab308]">→ {req.assignedRank}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
