"use client";

import { useState, useEffect, useCallback } from "react";
import { ErrorState } from "@/components/ui/error-state";
import { fetchJson, errorMessage } from "@/lib/fetch-json";

interface AuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  entityLabel: string;
  details: Record<string, unknown>;
  performedBy: string;
  createdAt: string;
}

const ACTION_COLORS: Record<string, string> = {
  create: "bg-green-500/10 text-green-400",
  update: "bg-blue-500/10 text-blue-400",
  delete: "bg-red-500/10 text-red-400",
  approve: "bg-green-500/10 text-green-400",
  decline: "bg-red-500/10 text-red-400",
};

function detailsSummary(details: Record<string, unknown>): string | null {
  const parts = Object.entries(details)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => `${k}: ${v}`);
  return parts.length ? parts.join(", ") : null;
}

export default function AdminAuditPage() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [entityType, setEntityType] = useState("");
  const limit = 50;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
      if (entityType) params.set("entityType", entityType);
      const data = await fetchJson<{ logs: AuditEntry[]; total: number }>(`/api/admin/audit?${params}`);
      setLogs(data.logs ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      console.error("Failed to fetch audit logs:", err);
      setError(errorMessage(err));
      setLogs([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [offset, entityType]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const totalPages = Math.ceil(total / limit);
  const entityTypes = ["Member", "AdminRole", "AdminUser", "LOA", "RemovalRequest", "InactivityRequest", "OnboardingRequest", "FTPRequest", "RecruitRequest", "DepartmentApplication", "DepartmentMembership"];

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="text-gray-500">Loading audit logs...</div></div>;
  }

  if (error) {
    return <ErrorState title="Failed to load audit log" message={error} onRetry={fetchLogs} />;
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-[family-name:var(--font-oswald)] text-2xl font-bold text-white uppercase">
          Audit Log
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Who changed what ({total} total entries)
        </p>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <select
          value={entityType}
          onChange={(e) => { setEntityType(e.target.value); setOffset(0); }}
          className="h-9 rounded-md border border-[#1e1e1e] bg-[#111111] px-3 py-1 text-sm text-white"
        >
          <option value="">All Types</option>
          {entityTypes.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        {entityType && (
          <button
            onClick={() => { setEntityType(""); setOffset(0); }}
            className="px-3 py-1 text-sm rounded bg-white/5 text-gray-400 hover:bg-white/10"
          >
            Clear Filter
          </button>
        )}
      </div>

      <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1e1e1e]">
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Action</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Entity</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Label</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Details</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Performed By</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    No audit entries found
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="border-b border-[#1e1e1e] hover:bg-white/5">
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${ACTION_COLORS[log.action] ?? "bg-white/5 text-gray-300"}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-400">{log.entityType}</td>
                    <td className="py-3 px-4 text-sm text-white">{log.entityLabel || log.entityId}</td>
                    <td className="py-3 px-4 text-xs text-gray-500 max-w-xs truncate" title={detailsSummary(log.details) ?? undefined}>
                      {detailsSummary(log.details) ?? "—"}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-400">{log.performedBy}</td>
                    <td className="py-3 px-4 text-sm text-gray-500 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[#1e1e1e]">
            <span className="text-sm text-gray-500">
              Page {Math.floor(offset / limit) + 1} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setOffset((p) => Math.max(0, p - limit))}
                disabled={offset === 0}
                className="px-3 py-1 text-sm rounded bg-white/5 text-gray-400 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => setOffset((p) => Math.min((totalPages - 1) * limit, p + limit))}
                disabled={offset + limit >= total}
                className="px-3 py-1 text-sm rounded bg-white/5 text-gray-400 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
