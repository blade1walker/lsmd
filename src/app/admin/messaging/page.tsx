"use client";

import { useState } from "react";
import { Send, Search, MessageSquare, CheckCircle, XCircle, Loader2, User } from "lucide-react";

export default function MessagingPage() {
  const [discordId, setDiscordId] = useState("");
  const [user, setUser] = useState<any>(null);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ success: boolean; error?: string } | null>(null);
  const [history, setHistory] = useState<{ id: string; username: string; message: string; time: string; success: boolean }[]>([]);

  const searchUser = async () => {
    if (!discordId.trim()) return;
    setSearching(true);
    setResult(null);
    try {
      const res = await fetch("/api/discord/user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: discordId.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
      } else {
        setUser(null);
        setResult({ success: false, error: "User not found" });
      }
    } catch {
      setUser(null);
      setResult({ success: false, error: "Failed to look up user" });
    }
    setSearching(false);
  };

  const sendMessage = async () => {
    if (!discordId.trim() || !message.trim()) return;
    setSending(true);
    setResult(null);
    try {
      const res = await fetch("/api/discord/dm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discordId: discordId.trim(), message: message.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult({ success: true });
        setHistory((prev) => [
          { id: Date.now().toString(), username: user?.username || discordId, message: message.trim(), time: new Date().toLocaleTimeString(), success: true },
          ...prev,
        ]);
        setMessage("");
      } else {
        setResult({ success: false, error: data.error || "Failed to send" });
        setHistory((prev) => [
          { id: Date.now().toString(), username: user?.username || discordId, message: message.trim(), time: new Date().toLocaleTimeString(), success: false },
          ...prev,
        ]);
      }
    } catch {
      setResult({ success: false, error: "Network error" });
    }
    setSending(false);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-[family-name:var(--font-oswald)] text-white font-bold">Bot Messaging</h1>
        <p className="text-gray-400 text-sm mt-1">Send direct messages to Discord users through the bot</p>
      </div>

      <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl p-6 space-y-4">
        <label className="text-sm font-medium text-gray-300">Discord User ID</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={discordId}
            onChange={(e) => { setDiscordId(e.target.value); setUser(null); setResult(null); }}
            onKeyDown={(e) => e.key === "Enter" && searchUser()}
            placeholder="Enter Discord ID (e.g. 123456789012345678)"
            className="flex-1 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#eab308] transition-colors"
          />
          <button
            onClick={searchUser}
            disabled={searching || !discordId.trim()}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#1e1e1e] hover:bg-[#2a2a2a] text-gray-300 rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Look up
          </button>
        </div>

        {user && (
          <div className="flex items-center gap-3 p-3 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg">
            {user.avatar ? (
              <img
                src={`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64`}
                alt=""
                className="w-10 h-10 rounded-full"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-[#5865F2] flex items-center justify-center">
                <User className="w-5 h-5 text-white" />
              </div>
            )}
            <div>
              <div className="text-white font-medium">{user.globalName || user.username}</div>
              <div className="text-gray-400 text-sm">@{user.username} • {user.id}</div>
            </div>
          </div>
        )}

        {result && !user && (
          <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${result.success ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
            {result.success ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
            {result.success ? "Message sent!" : result.error}
          </div>
        )}
      </div>

      <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl p-6 space-y-4">
        <label className="text-sm font-medium text-gray-300">Message</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type your message here... (supports **bold**, *italic*, `code`)"
          rows={5}
          className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-[#eab308] transition-colors resize-none"
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">{message.length}/2000</span>
          <button
            onClick={sendMessage}
            disabled={sending || !discordId.trim() || !message.trim()}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#eab308] hover:bg-[#ca8a04] text-black font-medium rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Send DM
          </button>
        </div>
      </div>

      {result && result.success && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-400" />
          <span className="text-green-400 text-sm">Message sent successfully to @{user?.username || discordId}</span>
        </div>
      )}

      {history.length > 0 && (
        <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl p-6 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-300">
            <MessageSquare className="w-4 h-4" />
            Recent Messages
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {history.map((h) => (
              <div key={h.id} className={`p-3 rounded-lg text-sm border ${h.success ? "bg-[#0a0a0a] border-[#2a2a2a]" : "bg-red-500/5 border-red-500/10"}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-gray-400">@{h.username}</span>
                  <span className="text-gray-600 text-xs">{h.time}</span>
                </div>
                <div className="text-gray-300 truncate">{h.message}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
