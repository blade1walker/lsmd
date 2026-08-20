"use client";

import { useState, useEffect } from "react";
import { Bell } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function UserNotificationBell() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  useEffect(() => {
    fetch("/api/user/notifications")
      .then((res) => res.json())
      .then((data) => setNotifications(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  const markAllRead = async () => {
    await fetch("/api/user/notifications/read", { method: "POST" });
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#eab308] text-black text-xs font-bold rounded-full flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute right-0 top-full mt-2 w-80 bg-[#111111] border border-[#1e1e1e] rounded-xl shadow-xl overflow-hidden z-50"
          >
            <div className="p-4 border-b border-[#1e1e1e] flex items-center justify-between">
              <h3 className="font-semibold text-white text-sm">Notifications</h3>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-xs text-[#eab308] hover:underline"
                >
                  Mark all read
                </button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-4 text-center text-gray-500 text-sm">
                  No notifications
                </div>
              ) : (
                notifications.slice(0, 10).map((notif) => (
                  <div
                    key={notif.id}
                    className={`p-4 border-b border-[#1e1e1e] ${
                      !notif.isRead ? "bg-[#eab308]/5" : ""
                    }`}
                  >
                    <div className="text-sm text-white">
                      <span className="font-semibold">{notif.memberName}</span>{" "}
                      was promoted from{" "}
                      <span className="text-gray-400">{notif.fromRank}</span> to{" "}
                      <span className="text-[#eab308]">{notif.toRank}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      by {notif.promotedBy}
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
