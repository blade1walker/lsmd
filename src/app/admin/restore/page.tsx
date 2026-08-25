"use client";

import { useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import { RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface DeletionLog {
  id: string;
  entityType: string;
  entityId: string;
  entityLabel: string;
  deletedBy: string;
  deletedAt: string;
  expiresAt: string;
}

export default function AdminRestorePage() {
  const [logs, setLogs] = useState<DeletionLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    try {
      const res = await fetch("/api/admin/deleted");
      const data = await res.json();
      setLogs(data);
    } catch (error) {
      toast.error("Failed to load deletion logs");
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleRestore = async (logId: string) => {
    try {
      const res = await fetch(`/api/admin/deleted?logId=${logId}`, { method: "POST" });
      if (!res.ok) throw new Error("Failed");
      toast.success("Item restored");
      fetchLogs();
    } catch (error) {
      toast.error("Failed to restore item");
    }
  };

  const handleDismiss = async (logId: string) => {
    try {
      const res = await fetch(`/api/admin/deleted?logId=${logId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      toast.success("Log dismissed");
      fetchLogs();
    } catch (error) {
      toast.error("Failed to dismiss log");
    }
  };

  if (loading) {
    return (
      <div>
        <div className="mb-8">
          <Skeleton className="h-8 w-56 mb-2" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-[family-name:var(--font-oswald)] text-2xl font-bold text-white uppercase">
          Restore Deleted Items
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Items are retained for 7 days. Super Admin only.
        </p>
      </div>

      {logs.length === 0 ? (
        <div className="text-center py-16 bg-[#111111] border border-[#1e1e1e] rounded-xl">
          <div className="text-gray-500 text-lg mb-2">No deleted items</div>
          <div className="text-gray-600 text-sm">
            Deleted items will appear here for restoration
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {logs.map((log, index) => {
            const expiresAt = new Date(log.expiresAt);
            const isExpired = expiresAt < new Date();

            return (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`bg-[#111111] border border-[#1e1e1e] rounded-xl p-4 flex items-center gap-4 ${
                  isExpired ? "opacity-50" : ""
                }`}
              >
                <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-red-400" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-white font-medium text-sm">
                    {log.entityLabel}
                  </div>
                  <div className="text-xs text-gray-500">
                    {log.entityType} • Deleted by {log.deletedBy} •{" "}
                    {new Date(log.deletedAt).toLocaleDateString()}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs text-gray-500">
                    Expires: {expiresAt.toLocaleDateString()}
                  </div>
                  {isExpired && (
                    <div className="text-xs text-red-400">Expired</div>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRestore(log.id)}
                    disabled={isExpired}
                    className="text-gray-400 hover:text-green-400"
                  >
                    <RotateCcw className="w-4 h-4 mr-1" />
                    Restore
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDismiss(log.id)}
                    className="text-gray-400 hover:text-red-400"
                  >
                    Dismiss
                  </Button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
