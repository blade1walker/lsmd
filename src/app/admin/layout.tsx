"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  Users,
  UserPlus,
  GraduationCap,
  FileText,
  Radio,
  Settings,
  Trash2,
  Shield,
  Clock,
  Heart,
  Bell,
  LogOut,
  Mail,
  BookOpen,
  ChevronLeft,
  MessageSquare,
  Menu,
} from "lucide-react";

const navItems = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/roster", label: "Roster", icon: Users },
  { href: "/admin/onboarding", label: "Onboarding", icon: UserPlus },
  { href: "/admin/recruit", label: "Recruit", icon: Mail },
  { href: "/admin/ftp", label: "FTP", icon: BookOpen },
  { href: "/admin/training", label: "Training", icon: GraduationCap },
  { href: "/admin/sop", label: "SOP", icon: FileText },
  { href: "/admin/radio-codes", label: "Radio Codes", icon: Radio },
  { href: "/admin/templates", label: "Templates", icon: Settings },
  { href: "/admin/restore", label: "Restore", icon: Trash2 },
  { href: "/admin/roles", label: "Roles", icon: Shield },
  { href: "/admin/clock-log", label: "Clock Log", icon: Clock },
  { href: "/admin/hr", label: "HR", icon: Heart },
  { href: "/admin/signoffs", label: "Sign-offs", icon: GraduationCap },
  { href: "/admin/notification-settings", label: "Notify Settings", icon: Settings },
  { href: "/admin/notifications", label: "Notifications", icon: Bell },
  { href: "/admin/messaging", label: "Bot Messaging", icon: MessageSquare },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isLoginPage = pathname === "/admin/login";

  if (isLoginPage) {
    return <>{children}</>;
  }

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!session) {
    router.push("/admin/login");
    return null;
  }

  const sidebarContent = (
    <>
      <div className="p-4 border-b border-[#1e1e28]">
        <Link href="/" className="flex items-center gap-2 text-gray-400 hover:text-white text-sm">
          <ChevronLeft className="w-4 h-4" />
          Back to Roster
        </Link>
      </div>

      <div className="p-4 border-b border-[#1e1e28]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#dc2626] to-[#b91c1c] flex items-center justify-center">
            <span className="font-[family-name:var(--font-oswald)] text-black font-bold text-lg">
              N
            </span>
          </div>
          <div>
            <div className="font-[family-name:var(--font-oswald)] text-white font-semibold">
              Admin Panel
            </div>
            <div className="text-xs text-gray-500">
              {session.user.adminRole ?? "Super Admin"}
            </div>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-2 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors mb-1 ${
                isActive
                  ? "bg-[#dc2626]/10 text-[#dc2626]"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-[#1e1e28]">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-[#1e1e28] flex items-center justify-center text-xs text-gray-400">
            {session.user.name?.[0] ?? "A"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm text-white truncate">
              {session.user.name ?? "Admin"}
            </div>
            <div className="text-xs text-gray-500 truncate">
              {session.user.discordId}
            </div>
          </div>
        </div>
        <button
          onClick={() => router.push("/api/auth/signout")}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex">
      {/* Mobile header bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-[#111118] border-b border-[#1e1e28] px-4 py-3 flex items-center">
        <button
          onClick={() => setSidebarOpen(true)}
          className="text-gray-400 hover:text-white"
        >
          <Menu className="w-6 h-6" />
        </button>
        <span className="ml-3 font-[family-name:var(--font-oswald)] text-white font-semibold">
          Admin Panel
        </span>
      </div>

      {/* Backdrop */}
      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/60"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - mobile: slide-in overlay, desktop: fixed */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#111118] border-r border-[#1e1e28] flex flex-col transition-transform duration-200 ease-in-out md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {sidebarContent}
      </aside>

      <main className="flex-1 md:ml-64 pt-14 md:pt-0 p-8">{children}</main>
    </div>
  );
}
