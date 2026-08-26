"use client";

import { useState, useEffect, useCallback } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ErrorState } from "@/components/ui/error-state";
import { fetchList, errorMessage } from "@/lib/fetch-json";

interface SignOffDefinition {
  id: string;
  name: string;
  order: number;
  status: string;
}

interface FTOSignOffRecord {
  id: string;
  ftoMemberId: string;
  signOffDefinitionId: string;
  completedAt: string;
  completedBy: string | null;
  notes: string | null;
  ftoMember: {
    name: string;
    callSign: string;
  };
  signOffDefinition: {
    name: string;
  };
}

export default function AdminSignoffsPage() {
  const [definitions, setDefinitions] = useState<SignOffDefinition[]>([]);
  const [records, setRecords] = useState<FTOSignOffRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [newDefinition, setNewDefinition] = useState("");
  const [activeTab, setActiveTab] = useState<"definitions" | "records">("definitions");

  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setError(null);
    try {
      const [defList, recList] = await Promise.all([
        fetchList<SignOffDefinition>("/api/signoffs"),
        fetchList<FTOSignOffRecord>("/api/signoffs/records"),
      ]);
      setDefinitions(defList);
      setRecords(recList);
    } catch (err) {
      setError(errorMessage(err));
      setDefinitions([]);
      setRecords([]);
      toast.error("Failed to load sign-offs");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAddDefinition = async () => {
    if (!newDefinition) return;
    try {
      const res = await fetch("/api/signoffs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newDefinition,
          order: definitions.length,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      setNewDefinition("");
      toast.success("Sign-off type added");
      fetchData();
    } catch (error) {
      toast.error("Failed to add sign-off type");
    }
  };

  const handleDeleteDefinition = async (id: string) => {
    try {
      const res = await fetch(`/api/signoffs/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      toast.success("Sign-off type removed");
      fetchData();
    } catch (error) {
      toast.error("Failed to delete sign-off type");
    }
  };

  if (loading) {
    return (
      <div>
        <div className="mb-8">
          <Skeleton className="h-8 w-40 mb-2" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-10 w-48 mb-6" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  if (error) {
    return <ErrorState title="Failed to load sign-offs" message={error} onRetry={fetchData} />;
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-[family-name:var(--font-oswald)] text-2xl font-bold text-white uppercase">
          FTO Sign-offs
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Manage sign-off definitions and completion records
        </p>
      </div>

      <div className="flex gap-2 mb-6">
        <Button
          variant={activeTab === "definitions" ? "default" : "outline"}
          onClick={() => setActiveTab("definitions")}
          className={
            activeTab === "definitions"
              ? "bg-[#dc2626] text-black"
              : "border-[#1e1e1e] text-gray-400"
          }
        >
          Definitions
        </Button>
        <Button
          variant={activeTab === "records" ? "default" : "outline"}
          onClick={() => setActiveTab("records")}
          className={
            activeTab === "records"
              ? "bg-[#dc2626] text-black"
              : "border-[#1e1e1e] text-gray-400"
          }
        >
          Records
        </Button>
      </div>

      {activeTab === "definitions" && (
        <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl p-6">
          <div className="flex gap-2 mb-6">
            <Input
              value={newDefinition}
              onChange={(e) => setNewDefinition(e.target.value)}
              placeholder="New sign-off type..."
              className="bg-[#0a0a0a] border-[#1e1e1e]"
              onKeyDown={(e) => e.key === "Enter" && handleAddDefinition()}
            />
            <Button
              onClick={handleAddDefinition}
              disabled={!newDefinition}
              className="bg-[#dc2626] text-black hover:bg-[#b91c1c]"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add
            </Button>
          </div>

          <div className="space-y-2">
            {definitions.map((def) => (
              <div
                key={def.id}
                className="flex items-center justify-between p-3 bg-[#0a0a0a] rounded-lg"
              >
                <div>
                  <span className="text-white text-sm">{def.name}</span>
                  <span className="ml-2 text-xs text-gray-500">
                    ({def.status})
                  </span>
                </div>
                <button
                  onClick={() => handleDeleteDefinition(def.id)}
                  className="p-1 text-gray-600 hover:text-red-400"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "records" && (
        <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#1e1e1e]">
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">
                    FTO
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">
                    Sign-off Type
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">
                    Completed By
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody>
                {records.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-6 py-8 text-center text-gray-500"
                    >
                      No sign-off records
                    </td>
                  </tr>
                ) : (
                  records.map((record) => (
                    <tr
                      key={record.id}
                      className="border-b border-[#1e1e1e] hover:bg-white/5"
                    >
                      <td className="py-3 px-4">
                        <div className="text-white text-sm">
                          {record.ftoMember.name}
                        </div>
                        <div className="text-xs text-gray-500 font-[family-name:var(--font-mono)]">
                          {record.ftoMember.callSign}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-400">
                        {record.signOffDefinition.name}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-400">
                        {record.completedBy ?? "N/A"}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-400">
                        {new Date(record.completedAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
