"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { cn } from "@/lib/utils";

interface NavLink {
  href: string;
  label: string;
  permission?: string;
}

const navLinks: NavLink[] = [
  { href: "/admin/roster", label: "Roster", permission: "roster.view" },
  { href: "/admin/training", label: "Training", permission: "training.view" },
  { href: "/admin/sop", label: "SOP Editor", permission: "sop.edit" },
  { href: "/admin/radio-codes", label: "Radio Codes", permission: "radio.edit" },
  { href: "/admin/templates", label: "Templates", permission: "templates" },
  { href: "/admin/clock-log", label: "Clock Log", permission: "clock.view" },
  { href: "/admin/hr", label: "HR", permission: "hr.view" },
  { href: "/admin/signoffs", label: "Sign-offs", permission: "training.signoff.manage" },
  { href: "/admin/notifications", label: "Notifications", permission: "notifications" },
  { href: "/admin/restore", label: "Restore", permission: "roster.delete" },
  { href: "/admin/roles", label: "Roles", permission: "roster.delete" },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [unreadCount, setUnreadCount] = useState(0);
  const permissions = (session?.user as Record<string, unknown>)?.permissions as string[] ?? [];
  const isSuperAdmin = (session?.user as Record<string, unknown>)?.isSuperAdmin as boolean;

  React.useEffect(() => {
    fetch("/api/user/notifications")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setUnreadCount(data.filter((n: { isRead: boolean }) => !n.isRead).length);
        }
      })
      .catch(() => {});
  }, []);

  const filteredLinks = navLinks.filter((link) => {
    if (isSuperAdmin) return true;
    if (!link.permission) return true;
    return permissions.includes(link.permission);
  });

  function usePathnameCompat() {
    if (typeof window !== "undefined") {
      return window.location.pathname;
    }
    return "";
  }

  const currentPath = usePathnameCompat();

  return (
    <aside className="w-56 bg-sidebar border-r border-sidebar-border flex flex-col h-screen sticky top-0">
      <div className="p-4 border-b border-sidebar-border">
        <Link href="/admin/roster" className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center">
            <span className="font-[family-name:var(--font-oswald)] text-white font-bold text-sm">N</span>
          </div>
          <div>
            <div className="font-[family-name:var(--font-oswald)] text-white font-semibold text-sm tracking-wide">
              EMS ADMIN
            </div>
            <div className="text-gray-500 text-xs">Nexus Universe</div>
          </div>
        </Link>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {filteredLinks.map((link) => {
          const isActive = currentPath === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors relative",
                isActive
                  ? "bg-gold/10 text-gold"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              )}
            >
              {link.label}
              {link.label === "Notifications" && unreadCount > 0 && (
                <span className="absolute right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-sidebar-border">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 rounded-full bg-gold/20 flex items-center justify-center text-gold text-xs font-bold">
            {((session?.user as Record<string, unknown>)?.discordName as string)?.[0] ?? "A"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm text-white truncate">
              {(session?.user as Record<string, unknown>)?.discordName as string ?? "Admin"}
            </div>
            <div className="text-xs text-gray-500 truncate">
              {(session?.user as Record<string, unknown>)?.adminRole as string ?? "Super Admin"}
            </div>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/admin/login" })}
            className="text-gray-500 hover:text-white text-xs"
          >
            Logout
          </button>
        </div>
      </div>
    </aside>
  );
}
