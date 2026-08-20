"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Check, X, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LOA {
  id: string;
  reason: string;
  startDate: string;
  endDate: string;
  status: string;
  notes: string | null;
  member: {
    name: string;
    callSign: string;
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
    callSign: string;
    rank: string;
  };
}

export default function AdminHrPage() {
  const [loas, setLoas] = useState<LOA[]>([]);
  const [removals, setRemovals] = useState<RemovalRequest[]>([]);
  const [inactivities, setInactivities] = useState<InactivityRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
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
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleLoaAction = async (id: string, status: string) => {
    try {
      await fetch(`/api/loa/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      fetchData();
    } catch (error) {
      console.error("Error updating LOA:", error);
    }
  };

  const handleRemovalAction = async (id: string, status: string) => {
    try {
      await fetch(`/api/removal-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, reviewedBy: "Admin" }),
      });
      fetchData();
    } catch (error) {
      console.error("Error updating removal request:", error);
    }
  };

  const handleInactivityAction = async (id: string, status: string) => {
    try {
      await fetch(`/api/inactivity-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      fetchData();
    } catch (error) {
      console.error("Error updating inactivity request:", error);
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
        <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[#1e1e1e]">
            <h2 className="font-[family-name:var(--font-oswald)] text-lg font-bold text-white uppercase">
              Leave of Absence
            </h2>
          </div>
          <div className="divide-y divide-[#1e1e1e]">
            {loas.length === 0 ? (
              <div className="px-6 py-8 text-center text-gray-500">
                No LOA requests
              </div>
            ) : (
              loas.map((loa) => (
                <div
                  key={loa.id}
                  className="px-6 py-4 flex items-center gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-sm font-medium">
                      {loa.member.name}
                    </div>
                    <div className="text-xs text-gray-500">
                      {loa.member.rank} • {loa.member.callSign}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {loa.reason}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {new Date(loa.startDate).toLocaleDateString()} -{" "}
                      {new Date(loa.endDate).toLocaleDateString()}
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs ${
                      loa.status === "Active"
                        ? "bg-green-500/10 text-green-400"
                        : loa.status === "Expired"
                        ? "bg-gray-500/10 text-gray-400"
                        : "bg-red-500/10 text-red-400"
                    }`}
                  >
                    {loa.status}
                  </span>
                  {loa.status === "Active" && (
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleLoaAction(loa.id, "Expired")}
                        className="text-gray-400 hover:text-yellow-400"
                      >
                        <Clock className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleLoaAction(loa.id, "Cancelled")}
                        className="text-gray-400 hover:text-red-400"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[#1e1e1e]">
            <h2 className="font-[family-name:var(--font-oswald)] text-lg font-bold text-white uppercase">
              Removal Requests
            </h2>
          </div>
          <div className="divide-y divide-[#1e1e1e]">
            {removals.length === 0 ? (
              <div className="px-6 py-8 text-center text-gray-500">
                No removal requests
              </div>
            ) : (
              removals.map((removal) => (
                <div
                  key={removal.id}
                  className="px-6 py-4 flex items-center gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-sm font-medium">
                      {removal.memberName}
                    </div>
                    <div className="text-xs text-gray-500">
                      {removal.memberRank} • Requested by {removal.requestedBy}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {removal.reason}
                    </div>
                    {removal.isPTDCase && (
                      <span className="inline-block mt-1 px-2 py-0.5 bg-[#eab308]/10 text-[#eab308] text-xs rounded">
                        PTD Case
                      </span>
                    )}
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs ${
                      removal.status === "Pending"
                        ? "bg-yellow-500/10 text-yellow-400"
                        : removal.status === "Approved"
                        ? "bg-green-500/10 text-green-400"
                        : "bg-red-500/10 text-red-400"
                    }`}
                  >
                    {removal.status}
                  </span>
                  {removal.status === "Pending" && (
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          handleRemovalAction(removal.id, "Approved")
                        }
                        className="text-gray-400 hover:text-green-400"
                      >
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          handleRemovalAction(removal.id, "Rejected")
                        }
                        className="text-gray-400 hover:text-red-400"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[#1e1e1e]">
            <h2 className="font-[family-name:var(--font-oswald)] text-lg font-bold text-white uppercase">
              Inactivity Requests
            </h2>
          </div>
          <div className="divide-y divide-[#1e1e1e]">
            {inactivities.length === 0 ? (
              <div className="px-6 py-8 text-center text-gray-500">
                No inactivity requests
              </div>
            ) : (
              inactivities.map((req) => (
                <div
                  key={req.id}
                  className="px-6 py-4 flex items-center gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-sm font-medium">
                      {req.member.name}
                    </div>
                    <div className="text-xs text-gray-500">
                      {req.member.rank} • Submitted by {req.submittedBy}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {req.reason}
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs ${
                      req.status === "Pending"
                        ? "bg-yellow-500/10 text-yellow-400"
                        : req.status === "Approved"
                        ? "bg-green-500/10 text-green-400"
                        : "bg-red-500/10 text-red-400"
                    }`}
                  >
                    {req.status}
                  </span>
                  {req.status === "Pending" && (
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          handleInactivityAction(req.id, "Approved")
                        }
                        className="text-gray-400 hover:text-green-400"
                      >
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          handleInactivityAction(req.id, "Rejected")
                        }
                        className="text-gray-400 hover:text-red-400"
                      >
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
