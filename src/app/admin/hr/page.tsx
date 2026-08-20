"use client";

import { useState, useEffect, useCallback } from "react";
import { Check, X, Clock, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LOA {
  id: string;
  reason: string;
  startDate: string;
  endDate: string;
  status: string;
  notes: string | null;
  createdBy: string | null;
  member: {
    name: string;
    callSign: string | null;
    rank: string;
  };
}

interface RemovalRequest {
  id: string;
  memberName: string;
  memberRank: string;
  requestedBy: string;
  reason: string;
  status: string;
  isPTDCase: boolean;
}

interface InactivityRequest {
  id: string;
  submittedBy: string;
  reason: string;
  status: string;
  member: {
    name: string;
    callSign: string | null;
    rank: string;
  };
}

export default function AdminHrPage() {
  const [loas, setLoas] = useState<LOA[]>([]);
  const [removals, setRemovals] = useState<RemovalRequest[]>([]);
  const [inactivities, setInactivities] = useState<InactivityRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [loaRes, removalRes, inactRes] = await Promise.all([
        fetch("/api/loa"),
        fetch("/api/removal-requests"),
        fetch("/api/inactivity-requests"),
      ]);
      setLoas(await loaRes.json());
      setRemovals(await removalRes.json());
      setInactivities(await inactRes.json());
    } catch (error) {
      console.error("Error fetching data:", error);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleLoaAction = async (id: string, status: string) => {
    await fetch(`/api/loa/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    fetchData();
  };

  const handleRemovalAction = async (id: string, status: string) => {
    await fetch(`/api/removal-requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, reviewedBy: "Admin" }),
    });
    fetchData();
  };

  const handleInactivityAction = async (id: string, status: string) => {
    await fetch(`/api/inactivity-requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    fetchData();
  };

  const pendingLoas = loas.filter((l) => l.status === "Pending");
  const activeLoas = loas.filter((l) => l.status === "Active" || l.status === "Approved");
  const otherLoas = loas.filter((l) => l.status !== "Pending" && l.status !== "Active" && l.status !== "Approved");

  const statusColor = (status: string) => {
    switch (status) {
      case "Pending": return "bg-yellow-500/10 text-yellow-400";
      case "Active":
      case "Approved":
      case "Approved": return "bg-green-500/10 text-green-400";
      case "Declined":
      case "Rejected": return "bg-red-500/10 text-red-400";
      case "Expired":
      case "Cancelled": return "bg-gray-500/10 text-gray-400";
      default: return "bg-gray-500/10 text-gray-400";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading HR data...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-[family-name:var(--font-oswald)] text-2xl font-bold text-white uppercase">
          HR Management
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Manage LOA, removal requests, and inactivity requests
        </p>
      </div>

      <div className="space-y-8">
        {/* Pending LOA Requests */}
        <div className="bg-[#111111] border border-yellow-500/20 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[#1e1e1e] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-yellow-400" />
              <h2 className="font-[family-name:var(--font-oswald)] text-lg font-bold text-white uppercase">
                Pending LOA Requests
              </h2>
            </div>
            {pendingLoas.length > 0 && (
              <span className="px-2 py-0.5 bg-yellow-500/10 text-yellow-400 text-xs rounded-full">
                {pendingLoas.length} pending
              </span>
            )}
          </div>
          <div className="divide-y divide-[#1e1e1e]">
            {pendingLoas.length === 0 ? (
              <div className="px-6 py-8 text-center text-gray-500">
                No pending LOA requests
              </div>
            ) : (
              pendingLoas.map((loa) => (
                <div key={loa.id} className="px-6 py-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-sm font-medium">
                      {loa.member.name}
                    </div>
                    <div className="text-xs text-gray-500">
                      {loa.member.rank} {loa.member.callSign && `• ${loa.member.callSign}`}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">{loa.reason}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {new Date(loa.startDate).toLocaleDateString()} - {new Date(loa.endDate).toLocaleDateString()}
                      {loa.createdBy && loa.createdBy !== "self" && ` • Requested by ${loa.createdBy}`}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleLoaAction(loa.id, "Approved")}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      <Check className="w-4 h-4 mr-1" /> Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleLoaAction(loa.id, "Declined")}
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    >
                      <X className="w-4 h-4 mr-1" /> Decline
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Active LOAs */}
        <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[#1e1e1e] flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <h2 className="font-[family-name:var(--font-oswald)] text-lg font-bold text-white uppercase">
              Active LOAs
            </h2>
          </div>
          <div className="divide-y divide-[#1e1e1e]">
            {activeLoas.length === 0 ? (
              <div className="px-6 py-8 text-center text-gray-500">No active LOAs</div>
            ) : (
              activeLoas.map((loa) => (
                <div key={loa.id} className="px-6 py-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-sm font-medium">{loa.member.name}</div>
                    <div className="text-xs text-gray-500">
                      {loa.member.rank} {loa.member.callSign && `• ${loa.member.callSign}`}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">{loa.reason}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {new Date(loa.startDate).toLocaleDateString()} - {new Date(loa.endDate).toLocaleDateString()}
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${statusColor(loa.status)}`}>{loa.status}</span>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => handleLoaAction(loa.id, "Expired")} className="text-gray-400 hover:text-yellow-400">
                      <Clock className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleLoaAction(loa.id, "Cancelled")} className="text-gray-400 hover:text-red-400">
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Past LOAs */}
        {otherLoas.length > 0 && (
          <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[#1e1e1e]">
              <h2 className="font-[family-name:var(--font-oswald)] text-lg font-bold text-white uppercase">
                Past LOAs
              </h2>
            </div>
            <div className="divide-y divide-[#1e1e1e]">
              {otherLoas.map((loa) => (
                <div key={loa.id} className="px-6 py-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-sm font-medium">{loa.member.name}</div>
                    <div className="text-xs text-gray-500">
                      {loa.member.rank} {loa.member.callSign && `• ${loa.member.callSign}`}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {new Date(loa.startDate).toLocaleDateString()} - {new Date(loa.endDate).toLocaleDateString()}
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${statusColor(loa.status)}`}>{loa.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Removal Requests */}
        <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[#1e1e1e]">
            <h2 className="font-[family-name:var(--font-oswald)] text-lg font-bold text-white uppercase">
              Removal Requests
            </h2>
          </div>
          <div className="divide-y divide-[#1e1e1e]">
            {removals.length === 0 ? (
              <div className="px-6 py-8 text-center text-gray-500">No removal requests</div>
            ) : (
              removals.map((removal) => (
                <div key={removal.id} className="px-6 py-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-sm font-medium">{removal.memberName}</div>
                    <div className="text-xs text-gray-500">
                      {removal.memberRank} • Requested by {removal.requestedBy}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">{removal.reason}</div>
                    {removal.isPTDCase && (
                      <span className="inline-block mt-1 px-2 py-0.5 bg-[#eab308]/10 text-[#eab308] text-xs rounded">
                        PTD Case
                      </span>
                    )}
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${statusColor(removal.status)}`}>{removal.status}</span>
                  {removal.status === "Pending" && (
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => handleRemovalAction(removal.id, "Approved")} className="text-gray-400 hover:text-green-400">
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleRemovalAction(removal.id, "Rejected")} className="text-gray-400 hover:text-red-400">
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Inactivity Requests */}
        <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[#1e1e1e]">
            <h2 className="font-[family-name:var(--font-oswald)] text-lg font-bold text-white uppercase">
              Inactivity Requests
            </h2>
          </div>
          <div className="divide-y divide-[#1e1e1e]">
            {inactivities.length === 0 ? (
              <div className="px-6 py-8 text-center text-gray-500">No inactivity requests</div>
            ) : (
              inactivities.map((req) => (
                <div key={req.id} className="px-6 py-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-sm font-medium">{req.member.name}</div>
                    <div className="text-xs text-gray-500">
                      {req.member.rank} • Submitted by {req.submittedBy}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">{req.reason}</div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${statusColor(req.status)}`}>{req.status}</span>
                  {req.status === "Pending" && (
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => handleInactivityAction(req.id, "Approved")} className="text-gray-400 hover:text-green-400">
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleInactivityAction(req.id, "Rejected")} className="text-gray-400 hover:text-red-400">
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
