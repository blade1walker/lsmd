"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronDown, ChevronLeft, LogOut, Menu, Search, X } from "lucide-react";
import { activeHref, visibleSections } from "./nav";

const COLLAPSED_KEY = "admin-nav-collapsed";

/** Which sidebar categories this browser has folded away. A convenience only, so any storage error just means none. */
function readCollapsed(): Record<string, boolean> {
  try {
    return typeof window === "undefined" ? {} : JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? "{}");
  } catch {
    return {};
  }
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState(readCollapsed);

  function toggleSection(id: string) {
    const next = { ...collapsed, [id]: !collapsed[id] };
    setCollapsed(next);
    try {
      localStorage.setItem(COLLAPSED_KEY, JSON.stringify(next));
    } catch {
      // Not remembered across visits; the toggle still works.
    }
  }

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

  // UX only — the real boundary is the permission check on each API route.
  // These pages are static shells that hold no data until those calls return.
  const sections = visibleSections(!!session.user.isSuperAdmin, session.user.permissions ?? []);
  const active = activeHref(pathname, sections);
  const needle = query.trim().toLowerCase();
  const shown = needle
    ? sections
        .map((s) => ({
          ...s,
          items: s.label.toLowerCase().includes(needle) ? s.items : s.items.filter((i) => i.label.toLowerCase().includes(needle)),
        }))
        .filter((s) => s.items.length > 0)
    : sections;

  if (sections.length === 0) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <h1 className="font-[family-name:var(--font-oswald)] text-xl font-bold text-white uppercase">
            No panel access
          </h1>
          <p className="text-gray-500 text-sm mt-2">
            {session.user.name ?? "Your account"} is signed in as{" "}
            <span className="text-gray-300">{session.user.adminRole ?? "EMS Member"}</span>, which has
            no admin sections assigned. Ask an administrator if you need access.
          </p>
          <Link href="/" className="inline-block mt-4 text-sm text-[#dc2626] hover:underline">
            Back to Website
          </Link>
        </div>
      </div>
    );
  }

  const sidebarContent = (
    <>
      <div className="p-4 border-b border-[#1e1e28]">
        <Link href="/" className="-my-1.5 flex items-center gap-2 py-1.5 text-gray-400 hover:text-white text-sm">
          <ChevronLeft className="w-4 h-4" />
          Back to Website
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

      <div className="px-3 pt-3">
        <label className="relative block">
          <span className="sr-only">Search the admin menu</span>
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search menu…"
            className="w-full rounded-lg bg-[#0a0a0f] border border-[#1e1e28] pl-8 pr-8 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-[#dc2626]/60"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </label>
      </div>

      <nav className="flex-1 p-2 overflow-y-auto" aria-label="Admin sections">
        {shown.length === 0 && <p className="px-3 py-4 text-sm text-gray-500">Nothing matches “{query}”.</p>}
        {shown.map((section) => {
          // A search shows every match; otherwise a folded section stays folded unless it holds the open page.
          const open = !!needle || !collapsed[section.id] || section.items.some((i) => i.href === active);
          return (
            <div key={section.id} className="mb-2">
              <button
                type="button"
                onClick={() => toggleSection(section.id)}
                aria-expanded={open}
                className="w-full flex items-center justify-between px-3 pt-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500 hover:text-gray-300"
              >
                <span>{section.label}</span>
                <span className="flex items-center gap-1.5">
                  {!open && <span className="text-gray-600 normal-case tracking-normal">{section.items.length}</span>}
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "" : "-rotate-90"}`} />
                </span>
              </button>
              {open &&
                section.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    aria-current={item.href === active ? "page" : undefined}
                    className={`flex items-center gap-3 px-3 py-2.5 lg:py-2 rounded-lg text-sm transition-colors mb-0.5 ${
                      item.href === active
                        ? "bg-[#dc2626]/10 text-[#dc2626]"
                        : "text-gray-400 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    <item.icon className="w-4 h-4 shrink-0" />
                    {item.label}
                  </Link>
                ))}
            </div>
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
      {/* Phone and tablet header bar. The sidebar is fixed from lg up: on a
          tablet in portrait it would take a third of the screen. */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-[#111118] border-b border-[#1e1e28] pl-[max(0.5rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-[calc(0.25rem+env(safe-area-inset-top))] pb-1 flex items-center">
        <button
          onClick={() => setSidebarOpen(true)}
          aria-label="Open menu"
          aria-expanded={sidebarOpen}
          className="p-2.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5"
        >
          <Menu className="w-6 h-6" />
        </button>
        <span className="ml-1.5 font-[family-name:var(--font-oswald)] text-white font-semibold">
          Admin Panel
        </span>
      </div>

      {/* Backdrop */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/60"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - mobile: slide-in overlay, desktop: fixed */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 max-w-[85vw] bg-[#111118] border-r border-[#1e1e28] flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {sidebarContent}
      </aside>

      {/* min-w-0: a flex item will not shrink below its widest child, so
          without it one wide table pushes the whole page sideways on a phone
          instead of scrolling inside its own box. */}
      <main className="flex-1 min-w-0 px-4 pb-8 pt-[calc(4.5rem+env(safe-area-inset-top))] sm:px-6 lg:ml-64 lg:p-8 lg:pt-[calc(2rem+env(safe-area-inset-top))]">{children}</main>
    </div>
  );
}
