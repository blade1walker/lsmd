"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Bell } from "lucide-react";

/** A promotion announcement, as /api/user/notifications returns it. */
interface PromotionNotice {
  id: string;
  memberName: string;
  fromRank: string;
  toRank: string;
  promotedBy: string;
  isRead: boolean;
}

/** Panel width and the gap it keeps from the screen edges. */
const PANEL_WIDTH = 320;
const EDGE = 12;

export function UserNotificationBell() {
  const [notifications, setNotifications] = useState<PromotionNotice[]>([]);
  // Where the panel opens, from the bell's position; null while closed.
  const [panel, setPanel] = useState<{ top: number; right: number; width: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  useEffect(() => {
    fetch("/api/user/notifications")
      .then((res) => res.json())
      .then((data) => setNotifications(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!panel) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPanel(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panel]);

  // The bell sits inside blurred headers, and a backdrop-filter makes `fixed`
  // relative to that box instead of the screen, so the panel is rendered at
  // the page root and placed under the bell, kept inside the screen.
  const toggle = () => {
    if (panel || !buttonRef.current) return setPanel(null);
    const rect = buttonRef.current.getBoundingClientRect();
    const width = Math.min(PANEL_WIDTH, window.innerWidth - 2 * EDGE);
    const right = Math.min(Math.max(window.innerWidth - rect.right, EDGE), window.innerWidth - width - EDGE);
    setPanel({ top: rect.bottom + 8, right, width });
  };

  const markAllRead = async () => {
    await fetch("/api/user/notifications/read", { method: "POST" });
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={toggle}
        aria-label="Notifications"
        aria-expanded={!!panel}
        className="relative p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </button>

      {panel &&
        createPortal(
          <>
            <div className="fixed inset-0 z-50" onClick={() => setPanel(null)} aria-hidden />
            <div
              style={{ top: panel.top, right: panel.right, width: panel.width }}
              className="fixed bg-[#111111] border border-[#1e1e1e] rounded-xl shadow-xl overflow-hidden z-50 animate-fade-up [--fade-up-y:-10px]"
            >
              <div className="p-4 border-b border-[#1e1e1e] flex items-center justify-between">
                <h3 className="font-semibold text-white text-sm">Notifications</h3>
                {unreadCount > 0 && (
                  <button onClick={markAllRead} className="text-xs text-red-500 hover:underline">
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-[min(20rem,60dvh)] overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-4 text-center text-gray-500 text-sm">No notifications</div>
                ) : (
                  notifications.slice(0, 10).map((notif) => (
                    <div
                      key={notif.id}
                      className={`p-4 border-b border-[#1e1e1e] ${!notif.isRead ? "bg-red-600/5" : ""}`}
                    >
                      <div className="text-sm text-white">
                        <span className="font-semibold">{notif.memberName}</span> was promoted from{" "}
                        <span className="text-gray-400">{notif.fromRank}</span> to{" "}
                        <span className="text-red-500">{notif.toRank}</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">by {notif.promotedBy}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>,
          document.body
        )}
    </div>
  );
}
