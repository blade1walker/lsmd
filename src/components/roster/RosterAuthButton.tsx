"use client";

import { signIn, signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { UserNotificationBell } from "@/components/UserNotificationBell";
import type { RosterViewer } from "@/lib/roster-shared";

/**
 * Sign-in in the corner of the roster. Signing in is what unlocks the
 * member-only columns, so it returns to the roster rather than the panel.
 */
export function RosterAuthButton({ viewer }: { viewer: RosterViewer }) {
  if (!viewer.signedIn) {
    return (
      <button
        type="button"
        onClick={() => signIn("discord", { callbackUrl: "/" })}
        className="fixed right-4 top-4 z-40 inline-flex items-center gap-2 rounded-lg bg-[#5865F2] px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-black/40 transition-colors hover:bg-[#4752C4]"
      >
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M20.317 4.37a19.79 19.79 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.865-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.74 19.74 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.058a.082.082 0 00.031.056 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.1 13.1 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.3 12.3 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.84 19.84 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
        </svg>
        Login with Discord
      </button>
    );
  }

  return (
    <div className="fixed right-4 top-4 z-40 flex items-center gap-1 rounded-lg border border-[#26262f] bg-[#0e0e14]/95 py-1 pl-3 pr-1 shadow-lg shadow-black/40 backdrop-blur">
      <span className="max-w-[160px] truncate text-xs font-semibold text-gray-200">{viewer.name ?? "Signed in"}</span>
      <UserNotificationBell />
      <button
        type="button"
        onClick={() => signOut({ callbackUrl: "/" })}
        title="Sign out"
        className="rounded-md p-2 text-gray-500 transition-colors hover:bg-white/10 hover:text-white"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  );
}
