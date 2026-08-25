"use client";

import { useState, useEffect } from "react";

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

export default function AdminAuditPage() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const limit = 50;

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const res = await fetch(`/api/admin/audit?limit=${limit}&offset=${offset}`);
        const data = await res.json();
        setLogs(data.logs);
        setTotal(data.total);
      } catch (err) {
        console.error("Failed to fetch audit logs:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, [offset]);

  const totalPages = Math.ceil(total / limit);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="text-gray-500">Loading audit logs...</div></div>;
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-[family-name:var(--font-oswald)] text-2xl font-bold text-white uppercase">
          Audit Log
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Track all admin actions ({total} total entries)
        </p>
      </div>

      <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1e1e1e]">
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Action</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Entity</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Label</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Performed By</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    No audit entries found
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="border-b border-[#1e1e1e] hover:bg-white/5">
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-xs bg-white/5 text-gray-300 font-medium">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-400">{log.entityType}</td>
                    <td className="py-3 px-4 text-sm text-white">{log.entityLabel || log.entityId}</td>
                    <td className="py-3 px-4 text-sm text-gray-400">{log.performedBy}</td>
                    <td className="py-3 px-4 text-sm text-gray-500">
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
