"use client";

import { useState, useEffect, useCallback } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { fetchJson, errorMessage } from "@/lib/fetch-json";
import {
  GitCommit,
  GitBranch,
  Server,
  Activity,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  Clock,
  User,
  ShieldCheck,
  Radio,
  FileCode,
} from "lucide-react";

interface DeploymentInfo {
  status: "active" | "unknown";
  environment: string;
  deployedAt: string;
  source: "git" | "fallback";
  commit: {
    sha: string;
    shortSha: string;
    message: string;
    author?: string;
    date?: string;
    branch?: string;
    repo?: string;
    url?: string;
  };
  system: {
    nodeVersion: string;
    platform: string;
    uptimeSeconds: number;
  };
}

export default function DeploymentStatusPage() {
  const [data, setData] = useState<DeploymentInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDeployment = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const res = await fetchJson<DeploymentInfo>("/api/admin/deployment");
      setData(res);
    } catch (err) {
      console.error("Failed to load deployment info:", err);
      setError(errorMessage(err));
      setData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDeployment();
  }, [fetchDeployment]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <ErrorState
        title="Failed to load deployment info"
        message={error ?? "Could not retrieve the active deployment status."}
        onRetry={() => fetchDeployment(true)}
      />
    );
  }

  const { commit, system, environment, status, source } = data;

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-oswald)] text-2xl font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Radio className="w-6 h-6 text-[#dc2626]" />
            Active Deployment & Build Status
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Real-time telemetry showing which GitHub commit is deployed and actively serving traffic.
          </p>
        </div>
        <button
          onClick={() => fetchDeployment(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#111118] border border-[#1e1e28] text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-red-500" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Top Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Status Card */}
        <div className="bg-[#111118] border border-[#1e1e28] rounded-xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-gray-400 font-semibold">Deployment Status</div>
            <div className="text-xl font-bold text-white font-[family-name:var(--font-oswald)] flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              LIVE & ACTIVE
            </div>
            <div className="text-xs text-emerald-400/80 mt-0.5 capitalize">{environment} environment</div>
          </div>
        </div>

        {/* Git Branch Card */}
        <div className="bg-[#111118] border border-[#1e1e28] rounded-xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
            <GitBranch className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-gray-400 font-semibold">Git Branch</div>
            <div className="text-xl font-bold text-white font-[family-name:var(--font-oswald)]">
              {commit.branch || "main"}
            </div>
            <div className="text-xs text-gray-400 mt-0.5">{commit.repo || "blade1walker/lsmd"}</div>
          </div>
        </div>

        {/* Commit Hash Card */}
        <div className="bg-[#111118] border border-[#1e1e28] rounded-xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0">
            <GitCommit className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-gray-400 font-semibold">Active Commit</div>
            <div className="text-xl font-bold text-white font-[family-name:var(--font-oswald)] font-mono">
              {commit.shortSha}
            </div>
            {commit.url ? (
              <a
                href={commit.url}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-purple-400 hover:text-purple-300 inline-flex items-center gap-1 mt-0.5"
              >
                View on GitHub <ExternalLink className="w-3 h-3" />
              </a>
            ) : (
              <div className="text-xs text-gray-400 mt-0.5">Verified SHA</div>
            )}
          </div>
        </div>
      </div>

      {/* Main Commit Card */}
      <div className="bg-[#111118] border border-[#1e1e28] rounded-xl p-6">
        <h2 className="font-[family-name:var(--font-oswald)] text-lg font-bold text-white uppercase mb-4 flex items-center gap-2">
          <FileCode className="w-5 h-5 text-red-500" />
          Deployed Commit Details
        </h2>

        <div className="bg-[#0a0a0f] border border-[#1e1e28] rounded-lg p-5 space-y-4">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-wider text-gray-400 font-medium">Commit Message</div>
              <div className="text-base font-semibold text-white mt-1 break-words">
                {commit.message}
              </div>
            </div>
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-mono font-medium bg-purple-500/10 border border-purple-500/30 text-purple-300 shrink-0">
              {commit.shortSha}
            </span>
          </div>

          <div className="border-t border-[#1e1e28] pt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-xs text-gray-400 flex items-center gap-1.5 mb-1">
                <User className="w-3.5 h-3.5 text-gray-400" /> Author
              </div>
              <div className="text-gray-200 font-medium">{commit.author || "Unknown"}</div>
            </div>

            <div>
              <div className="text-xs text-gray-400 flex items-center gap-1.5 mb-1">
                <Clock className="w-3.5 h-3.5 text-gray-400" /> Commit Timestamp
              </div>
              <div className="text-gray-200 font-medium">{commit.date || "Unknown"}</div>
            </div>

            <div>
              <div className="text-xs text-gray-400 flex items-center gap-1.5 mb-1">
                <ShieldCheck className="w-3.5 h-3.5 text-gray-400" /> Source Telemetry
              </div>
              <div className="text-gray-200 font-medium capitalize">
                {source === "git" ? "Local Git Head" : "Repository Baseline"}
              </div>
            </div>
          </div>

          {commit.sha && (
            <div className="border-t border-[#1e1e28] pt-3 text-xs text-gray-400 font-mono break-all">
              <span className="text-gray-400 select-none mr-2">FULL SHA:</span>
              {commit.sha}
            </div>
          )}
        </div>
      </div>

      {/* System & Host Telemetry */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Host Details */}
        <div className="bg-[#111118] border border-[#1e1e28] rounded-xl p-6">
          <h2 className="font-[family-name:var(--font-oswald)] text-lg font-bold text-white uppercase mb-4 flex items-center gap-2">
            <Server className="w-5 h-5 text-blue-400" />
            Hosting & Environment
          </h2>

          <div className="bg-[#0a0a0f] border border-[#1e1e28] rounded-lg p-4 space-y-3 text-sm">
            <div className="flex justify-between py-1 border-b border-[#1e1e28]/60">
              <span className="text-gray-400">Platform</span>
              <span className="text-white font-medium">Node Server</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-gray-400">Environment Target</span>
              <span className="text-emerald-400 font-medium uppercase text-xs">{environment}</span>
            </div>
          </div>
        </div>

        {/* Node Runtime Telemetry */}
        <div className="bg-[#111118] border border-[#1e1e28] rounded-xl p-6">
          <h2 className="font-[family-name:var(--font-oswald)] text-lg font-bold text-white uppercase mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-400" />
            Runtime Telemetry
          </h2>

          <div className="bg-[#0a0a0f] border border-[#1e1e28] rounded-lg p-4 space-y-3 text-sm">
            <div className="flex justify-between py-1 border-b border-[#1e1e28]/60">
              <span className="text-gray-400">Node Engine</span>
              <span className="text-white font-mono text-xs">{system.nodeVersion}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-[#1e1e28]/60">
              <span className="text-gray-400">OS Architecture</span>
              <span className="text-white font-mono text-xs">{system.platform}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-gray-400">Process Uptime</span>
              <span className="text-white font-medium">{Math.floor(system.uptimeSeconds / 60)}m {system.uptimeSeconds % 60}s</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
