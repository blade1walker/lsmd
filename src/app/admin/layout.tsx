"use client";

import { useSession } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
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
} from "lucide-react";

const navItems = [
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
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  const isLoginPage = pathname === "/admin/login";

  if (isLoginPage) {
    return <>{children}</>;
  }

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!session) {
    router.push("/admin/login");
    return null;
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex">
      <aside className="w-64 bg-[#111111] border-r border-[#1e1e1e] flex flex-col fixed h-full">
        <div className="p-4 border-b border-[#1e1e1e]">
          <Link href="/" className="flex items-center gap-2 text-gray-400 hover:text-white text-sm">
            <ChevronLeft className="w-4 h-4" />
            Back to Roster
          </Link>
        </div>

        <div className="p-4 border-b border-[#1e1e1e]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#eab308] to-[#ca8a04] flex items-center justify-center">
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
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors mb-1 ${
                  isActive
                    ? "bg-[#eab308]/10 text-[#eab308]"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-[#1e1e1e]">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-[#1e1e1e] flex items-center justify-center text-xs text-gray-400">
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
      </aside>

      <main className="flex-1 ml-64 p-8">{children}</main>
    </div>
  );
}
