"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface Notification {
  id: string;
  memberName: string;
  callSign?: string | null;
  fromRank: string;
  toRank: string;
  promotedBy: string;
  isRead: boolean;
  createdAt: string;
}

export default function AdminNotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      const data = await res.json();
      setNotifications(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleMarkRead = async (id: string) => {
    await fetch(`/api/notifications/${id}`, { method: "PATCH" });
    fetchData();
  };

  const handleMarkAllRead = async () => {
    await fetch("/api/user/notifications/read", { method: "POST" });
    fetchData();
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-[family-name:var(--font-oswald)] text-2xl font-bold text-white uppercase">
            Notifications
          </h1>
          <p className="text-gray-500 text-sm mt-1">{unreadCount} unread</p>
        </div>
        {unreadCount > 0 && (
          <Button variant="ghost" onClick={handleMarkAllRead}>Mark All Read</Button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-500">Loading...</div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-16 text-gray-500">No notifications</div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`p-4 rounded-xl border ${
                n.isRead ? "bg-card border-[#1e1e1e]" : "bg-gold/5 border-gold/20"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-white text-sm">
                    <span className="font-semibold">{n.memberName}</span>
                    {n.callSign && <span className="text-gray-500 ml-2">({n.callSign})</span>}
                    <span className="text-gray-400 mx-2">was promoted from</span>
                    <span className="text-gray-300">{n.fromRank}</span>
                    <span className="text-gray-400 mx-2">to</span>
                    <span className="text-gold">{n.toRank}</span>
                  </div>
                  <div className="text-gray-600 text-xs mt-1">
                    Promoted by {n.promotedBy} — {new Date(n.createdAt).toLocaleString()}
                  </div>
                </div>
                {!n.isRead && (
                  <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => handleMarkRead(n.id)}>
                    Mark Read
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
