"use client";

import { useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import {
  Users,
  UserCheck,
  Clock,
  AlertTriangle,
  UserPlus,
  TrendingUp,
  Shield,
  Activity,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface DashboardData {
  stats: {
    totalMembers: number;
    activeMembers: number;
    reserveMembers: number;
    loaMembers: number;
    totalPending: number;
    totalClockEntries: number;
    pendingBreakdown: {
      loas: number;
      removals: number;
      inactivity: number;
      onboarding: number;
      ftp: number;
      recruits: number;
    };
  };
  recentPromotions: Array<{
    id: string;
    memberName: string;
    callSign: string | null;
    fromRank: string;
    toRank: string;
    promotedBy: string;
    createdAt: string;
  }>;
  membersByRank: Array<{ rank: string; count: number }>;
  membersByActivity: Array<{ activity: string; count: number }>;
  topClockers: Array<{
    member: { name: string; callSign: string | null } | null;
    hours: number;
  }>;
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  delay,
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  color: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="bg-[#111118] border border-[#1e1e28] rounded-xl p-5"
    >
      <div className="flex items-center justify-between mb-3">
        <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="text-2xl font-bold text-white font-[family-name:var(--font-oswald)]">
        {value}
      </div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </motion.div>
  );
}

const ACTIVITY_COLORS: Record<string, string> = {
  Active: "#22c55e",
  Reserve: "#eab308",
  LOA: "#dc2626",
};

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/admin/dashboard");
        const json = await res.json();
        setData(json);
      } catch (err) {
        console.error("Failed to load dashboard:", err);
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div>
        <div className="mb-8">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-16 text-gray-500">Failed to load dashboard</div>
    );
  }

  const { stats, recentPromotions, membersByRank, membersByActivity, topClockers } = data;

  const activityChartData = membersByActivity.map((a) => ({
    name: a.activity,
    value: a.count,
  }));

  const rankChartData = membersByRank.map((r) => ({
    rank: r.rank,
    count: r.count,
  }));

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-[family-name:var(--font-oswald)] text-2xl font-bold text-white uppercase">
          Dashboard
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Overview of department operations
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Total Personnel"
          value={stats.totalMembers}
          icon={Users}
          color="bg-red-600/10 text-red-500"
          delay={0}
        />
        <StatCard
          label="Active Members"
          value={stats.activeMembers}
          icon={UserCheck}
          color="bg-green-500/10 text-green-500"
          delay={0.05}
        />
        <StatCard
          label="On LOA"
          value={stats.loaMembers}
          icon={Clock}
          color="bg-yellow-500/10 text-yellow-500"
          delay={0.1}
        />
        <StatCard
          label="Pending Reviews"
          value={stats.totalPending}
          icon={AlertTriangle}
          color="bg-orange-500/10 text-orange-500"
          delay={0.15}
        />
      </div>

      {/* Pending Breakdown */}
      {stats.totalPending > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-[#111118] border border-[#1e1e28] rounded-xl p-6 mb-8"
        >
          <h2 className="font-[family-name:var(--font-oswald)] text-lg font-bold text-white uppercase mb-4">
            Pending Reviews
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { label: "LOA Requests", count: stats.pendingBreakdown.loas },
              { label: "Removals", count: stats.pendingBreakdown.removals },
              { label: "Inactivity", count: stats.pendingBreakdown.inactivity },
              { label: "Onboarding", count: stats.pendingBreakdown.onboarding },
              { label: "FTP", count: stats.pendingBreakdown.ftp },
              { label: "Recruits", count: stats.pendingBreakdown.recruits },
            ].map((item) => (
              <div
                key={item.label}
                className="text-center p-3 bg-[#0a0a0f] rounded-lg"
              >
                <div className="text-xl font-bold text-white font-[family-name:var(--font-oswald)]">
                  {item.count}
                </div>
                <div className="text-xs text-gray-500 mt-1">{item.label}</div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Activity Pie Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-[#111118] border border-[#1e1e28] rounded-xl p-6"
        >
          <h2 className="font-[family-name:var(--font-oswald)] text-lg font-bold text-white uppercase mb-4">
            Members by Activity
          </h2>
          {activityChartData.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">
              No activity data
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={activityChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={4}
                  dataKey="value"
                  stroke="none"
                >
                  {activityChartData.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={ACTIVITY_COLORS[entry.name] ?? "#6b7280"}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1e1e28",
                    border: "1px solid #2a2a38",
                    borderRadius: 8,
                    color: "#fff",
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: 12, color: "#9ca3af" }}
                  formatter={(value) => (
                    <span className="text-gray-400">{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </motion.div>

        {/* Rank Bar Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-[#111118] border border-[#1e1e28] rounded-xl p-6"
        >
          <h2 className="font-[family-name:var(--font-oswald)] text-lg font-bold text-white uppercase mb-4">
            Members by Rank
          </h2>
          {rankChartData.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">
              No rank data
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={rankChartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <XAxis
                  dataKey="rank"
                  tick={{ fill: "#9ca3af", fontSize: 11 }}
                  axisLine={{ stroke: "#1e1e28" }}
                  tickLine={false}
                  angle={-35}
                  textAnchor="end"
                  height={60}
                />
                <YAxis
                  tick={{ fill: "#9ca3af", fontSize: 11 }}
                  axisLine={{ stroke: "#1e1e28" }}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1e1e28",
                    border: "1px solid #2a2a38",
                    borderRadius: 8,
                    color: "#fff",
                  }}
                />
                <Bar
                  dataKey="count"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={40}
                >
                  {rankChartData.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={`rgba(220, 38, 38, ${0.6 + (index / rankChartData.length) * 0.4})`}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Promotions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="bg-[#111118] border border-[#1e1e28] rounded-xl p-6"
        >
          <h2 className="font-[family-name:var(--font-oswald)] text-lg font-bold text-white uppercase mb-4">
            Recent Promotions
          </h2>
          {recentPromotions.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">
              No recent promotions
            </div>
          ) : (
            <div className="space-y-3">
              {recentPromotions.map((promo) => (
                <div
                  key={promo.id}
                  className="flex items-center gap-3 p-3 bg-[#0a0a0f] rounded-lg"
                >
                  <div className="w-8 h-8 rounded-full bg-red-600/10 flex items-center justify-center">
                    <TrendingUp className="w-4 h-4 text-red-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white font-medium truncate">
                      {promo.memberName}
                      {promo.callSign && (
                        <span className="text-gray-500 ml-1 font-[family-name:var(--font-mono)]">
                          #{promo.callSign}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">
                      {promo.fromRank} → {promo.toRank}
                    </div>
                  </div>
                  <div className="text-xs text-gray-600">
                    {new Date(promo.createdAt).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Top Clock Hours */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-[#111118] border border-[#1e1e28] rounded-xl p-6"
        >
          <h2 className="font-[family-name:var(--font-oswald)] text-lg font-bold text-white uppercase mb-4">
            Top Clock Hours
          </h2>
          {topClockers.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">
              No clock entries yet
            </div>
          ) : (
            <div className="space-y-3">
              {topClockers.map((entry, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-3 bg-[#0a0a0f] rounded-lg"
                >
                  <div className="w-8 h-8 rounded-full bg-red-600/10 flex items-center justify-center text-red-500 font-bold text-sm">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white font-medium truncate">
                      {entry.member?.name}
                    </div>
                    <div className="text-xs text-gray-500 font-[family-name:var(--font-mono)]">
                      #{entry.member?.callSign}
                    </div>
                  </div>
                  <div className="text-sm font-bold text-red-500 font-[family-name:var(--font-oswald)]">
                    {entry.hours}h
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="bg-[#111118] border border-[#1e1e28] rounded-xl p-6"
        >
          <h2 className="font-[family-name:var(--font-oswald)] text-lg font-bold text-white uppercase mb-4">
            Quick Actions
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Roster", href: "/admin/roster", icon: Users, color: "text-blue-400" },
              { label: "Onboarding", href: "/admin/onboarding", icon: UserPlus, color: "text-green-400" },
              { label: "HR", href: "/admin/hr", icon: Shield, color: "text-yellow-400" },
              { label: "Training", href: "/admin/training", icon: Activity, color: "text-purple-400" },
            ].map((action) => (
              <a
                key={action.label}
                href={action.href}
                className="flex items-center gap-3 p-4 bg-[#0a0a0f] rounded-lg hover:bg-white/5 transition-colors group"
              >
                <action.icon className={`w-5 h-5 ${action.color}`} />
                <span className="text-sm text-gray-300 group-hover:text-white transition-colors">
                  {action.label}
                </span>
              </a>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
