"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { ErrorState } from "@/components/ui/error-state";
import { fetchList, errorMessage } from "@/lib/fetch-json";
import { ArrowRight, Search, TrendingUp, X } from "lucide-react";

interface PromotionRecord {
  id: string;
  memberId: string | null;
  memberName: string;
  callSign: string | null;
  fromRank: string;
  toRank: string;
  direction: "Promotion" | "Demotion";
  promotedBy: string;
  promotedAt: string;
}

type DirectionFilter = "all" | "Promotion" | "Demotion";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/** Groups by memberId, falling back to the name for a row with none. */
function employeeKey(r: PromotionRecord) {
  return r.memberId ?? `name:${r.memberName}`;
}

function DirectionBadge({ direction }: { direction: PromotionRecord["direction"] }) {
  return direction === "Promotion" ? (
    <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-emerald-500/10 text-emerald-400">
      Promotion
    </span>
  ) : (
    <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-orange-500/10 text-orange-400">
      Demotion
    </span>
  );
}

export default function AdminPromotionsPage() {
  const [records, setRecords] = useState<PromotionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [direction, setDirection] = useState<DirectionFilter>("all");
  const [employee, setEmployee] = useState("");

  const fetchData = useCallback(async () => {
    setError(null);
    try {
      setRecords(await fetchList<PromotionRecord>("/api/promotions"));
    } catch (err) {
      setError(errorMessage(err));
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // One entry per employee. Records arrive newest first, so the name kept is
  // the most recent one — a renamed member shows under their current name.
  const employees = useMemo(() => {
    const byKey = new Map<string, { key: string; name: string; count: number }>();
    for (const r of records) {
      const key = employeeKey(r);
      const existing = byKey.get(key);
      if (existing) existing.count++;
      else byKey.set(key, { key, name: r.memberName, count: 1 });
    }
    return [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [records]);

  const filtered = useMemo(() => {
    const terms = search.toLowerCase().split(" ").map((t) => t.trim()).filter(Boolean);
    return records.filter((r) => {
      if (employee && employeeKey(r) !== employee) return false;
      if (direction !== "all" && r.direction !== direction) return false;
      if (terms.length === 0) return true;
      const text = [r.memberName, r.callSign, r.fromRank, r.toRank, r.promotedBy].filter(Boolean).join(" ").toLowerCase();
      return terms.every((t) => text.includes(t));
    });
  }, [records, search, direction, employee]);

  const selectedEmployee = employees.find((e) => e.key === employee) ?? null;
  // Oldest first, so the timeline reads as a career from the joining rank up.
  const timeline = useMemo(
    () => (employee ? records.filter((r) => employeeKey(r) === employee).reverse() : []),
    [records, employee]
  );

  const promotionsThisMonth = useMemo(() => {
    const now = new Date();
    return records.filter((r) => {
      const d = new Date(r.promotedAt);
      return r.direction === "Promotion" && d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }).length;
  }, [records]);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="text-gray-500">Loading promotion history...</div></div>;
  }

  if (error) {
    return <ErrorState title="Failed to load promotion history" message={error} onRetry={fetchData} />;
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-[family-name:var(--font-oswald)] text-2xl font-bold text-white uppercase flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-[#dc2626]" />
          Promotion History
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Every rank change made on the roster, recorded automatically and kept permanently.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {[
          { label: "Rank changes recorded", value: records.length },
          { label: "Promotions this month", value: promotionsThisMonth },
          { label: "Employees with history", value: employees.length },
        ].map((tile) => (
          <div key={tile.label} className="bg-[#111111] border border-[#1e1e1e] rounded-xl p-4">
            <div className="text-xs uppercase tracking-wider text-gray-500">{tile.label}</div>
            <div className="font-[family-name:var(--font-oswald)] text-2xl font-bold text-white mt-1">{tile.value}</div>
          </div>
        ))}
      </div>

      {selectedEmployee && (
        <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl p-5 mb-6">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <div className="text-xs uppercase tracking-wider text-gray-500">Career history</div>
              <div className="text-white font-semibold text-lg">{selectedEmployee.name}</div>
            </div>
            <button onClick={() => setEmployee("")} className="p-1 text-gray-500 hover:text-white" title="Show everyone">
              <X className="w-4 h-4" />
            </button>
          </div>
          <ol className="space-y-2">
            {timeline.map((r, i) => (
              <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <span className="w-6 text-right font-[family-name:var(--font-mono)] text-xs text-gray-600">{i + 1}.</span>
                <span className="text-gray-500 w-28 shrink-0">{formatDate(r.promotedAt)}</span>
                <span className="text-gray-400">{r.fromRank}</span>
                <ArrowRight className="w-3.5 h-3.5 text-gray-600" />
                <span className="text-white">{r.toRank}</span>
                <DirectionBadge direction={r.direction} />
                <span className="text-gray-600 text-xs">by {r.promotedBy}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl overflow-hidden">
        <div className="p-3 border-b border-[#1e1e1e] flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-48 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, rank or promoted by..."
              className="pl-8 h-9 text-sm"
            />
          </div>
          <select
            value={employee}
            onChange={(e) => setEmployee(e.target.value)}
            className="h-9 rounded-md border border-[#1e1e1e] bg-[#0a0a0a] px-3 text-sm text-white"
            style={{ colorScheme: "dark" }}
          >
            <option value="">All employees</option>
            {employees.map((e) => (
              <option key={e.key} value={e.key}>
                {e.name} ({e.count})
              </option>
            ))}
          </select>
          <select
            value={direction}
            onChange={(e) => setDirection(e.target.value as DirectionFilter)}
            className="h-9 rounded-md border border-[#1e1e1e] bg-[#0a0a0a] px-3 text-sm text-white"
            style={{ colorScheme: "dark" }}
          >
            <option value="all">Promotions &amp; demotions</option>
            <option value="Promotion">Promotions only</option>
            <option value="Demotion">Demotions only</option>
          </select>
        </div>

        {records.length === 0 ? (
          <p className="p-6 text-sm text-gray-500">
            No rank changes recorded yet. Promotions made on the roster appear here automatically.
          </p>
        ) : filtered.length === 0 ? (
          <p className="p-6 text-sm text-gray-500">No records match these filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1e1e1e]">
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">Employee Name</th>
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">Previous Role</th>
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">New Role</th>
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">Promotion Date</th>
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">Promoted By</th>
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">Type</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-b border-[#1e1e1e]/50 hover:bg-white/5">
                    <td className="py-3 px-4">
                      <button
                        onClick={() => setEmployee(employeeKey(r))}
                        className="text-white hover:text-[#dc2626] text-left"
                        title="Show this employee's full history"
                      >
                        {r.memberName}
                      </button>
                      {r.callSign && (
                        <span className="ml-2 font-[family-name:var(--font-mono)] text-xs text-gray-500">{r.callSign}</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-gray-400">{r.fromRank}</td>
                    <td className="py-3 px-4 text-white">{r.toRank}</td>
                    <td className="py-3 px-4 text-gray-400">{formatDate(r.promotedAt)}</td>
                    <td className="py-3 px-4 text-gray-400">{r.promotedBy}</td>
                    <td className="py-3 px-4"><DirectionBadge direction={r.direction} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
