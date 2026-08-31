"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { toast } from "sonner";
import {
  Send,
  Search,
  MessageSquare,
  Loader2,
  User,
  RefreshCw,
  Plus,
  Webhook,
  ScrollText,
  AlertTriangle,
  X,
} from "lucide-react";
import { fetchJson, fetchList, errorMessage } from "@/lib/fetch-json";

const MAX_LENGTH = 2000;

interface ThreadSummary {
  id: string;
  discordId: string;
  username: string | null;
  memberName: string | null;
  lastMessageAt: string;
  lastMessage: { direction: string; content: string; sentAt: string; ok: boolean } | null;
  hasUnread: boolean;
}

interface DirectMessage {
  id: string;
  direction: string;
  content: string;
  event: string;
  sentBy: string | null;
  ok: boolean;
  error: string | null;
  sentAt: string;
}

interface ThreadDetail {
  discordId: string;
  username: string | null;
  memberName: string | null;
  messages: DirectMessage[];
  syncError: string | null;
}

interface WebhookTarget {
  value: string;
  label: string;
  configured: boolean;
  borrowsFrom: string | null;
}

interface Delivery {
  id: string;
  event: string;
  channel: string;
  target: string | null;
  ok: boolean;
  status: number | null;
  error: string | null;
  preview: string;
  createdAt: string;
}

const TABS = ["conversations", "channel", "log"] as const;
type Tab = (typeof TABS)[number];

const TAB_LABELS: Record<Tab, string> = {
  conversations: "Conversations",
  channel: "Post to Channel",
  log: "Delivery Log",
};

const TAB_ICONS: Record<Tab, React.ComponentType<{ className?: string }>> = {
  conversations: MessageSquare,
  channel: Webhook,
  log: ScrollText,
};

/** "14:32" for today, "12 Sep 14:32" otherwise — a transcript reads better without full dates. */
function stamp(value: string): string {
  const date = new Date(value);
  const today = new Date();
  const sameDay =
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();
  const time = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return sameDay ? time : `${date.toLocaleDateString([], { day: "numeric", month: "short" })} ${time}`;
}

function threadName(thread: { username: string | null; memberName: string | null; discordId: string }) {
  return thread.memberName || thread.username || thread.discordId;
}

export default function MessagingPage() {
  const [tab, setTab] = useState<Tab>("conversations");

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-[family-name:var(--font-oswald)] text-white font-bold uppercase">
          Bot Messaging
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Everything the bot says — read the conversations, reply through it, post to a channel, and
          check what actually went out.
        </p>
      </div>

      <div className="flex gap-1 mb-6 bg-[#111111] border border-[#1e1e1e] rounded-xl p-1 w-fit">
        {TABS.map((t) => {
          const Icon = TAB_ICONS[t];
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === t ? "bg-[#dc2626] text-black" : "text-gray-400 hover:text-white"
              }`}
            >
              <Icon className="w-4 h-4" />
              {TAB_LABELS[t]}
            </button>
          );
        })}
      </div>

      {tab === "conversations" && <ConversationsTab />}
      {tab === "channel" && <ChannelTab />}
      {tab === "log" && <DeliveryLogTab />}
    </div>
  );
}

/* ---------------------------------------------------------------------- */

function ConversationsTab() {
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [thread, setThread] = useState<ThreadDetail | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const [newId, setNewId] = useState("");
  const [opening, setOpening] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const transcriptRef = useRef<HTMLDivElement>(null);

  const loadThreads = useCallback(async () => {
    setError(null);
    try {
      setThreads(await fetchList<ThreadSummary>("/api/messaging/threads"));
    } catch (err) {
      setError(errorMessage(err));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadThreads();
  }, [loadThreads]);

  /** `sync` pulls fresh history from Discord first — that is how replies arrive. */
  const openThread = useCallback(async (discordId: string, sync: boolean) => {
    if (sync) setSyncing(true);
    else setThreadLoading(true);
    try {
      const detail = await fetchJson<ThreadDetail>(
        `/api/messaging/threads/${discordId}${sync ? "?sync=1" : ""}`
      );
      setThread(detail);
    } catch (err) {
      toast.error(errorMessage(err));
    }
    setThreadLoading(false);
    setSyncing(false);
  }, []);

  // Opening a conversation shows the stored transcript immediately, then pulls
  // anything new from Discord behind it.
  useEffect(() => {
    if (!selectedId) {
      setThread(null);
      return;
    }
    setThread(null);
    setDraft("");
    openThread(selectedId, false).then(() => openThread(selectedId, true).then(loadThreads));
  }, [selectedId, openThread, loadThreads]);

  useEffect(() => {
    const el = transcriptRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [thread]);

  /** Pulls replies across the recently active conversations, not just the open one. */
  const refreshAll = async () => {
    setRefreshing(true);
    try {
      const res = await fetchJson<{ checked: number; added: number; failed: number }>(
        "/api/messaging/sync",
        { method: "POST" }
      );
      await loadThreads();
      if (selectedId) await openThread(selectedId, false);
      toast.success(
        res.added > 0
          ? `${res.added} new message${res.added === 1 ? "" : "s"} across ${res.checked} conversations`
          : `No new replies in ${res.checked} conversations`
      );
      if (res.failed > 0) toast.error(`${res.failed} conversation(s) could not be read`);
    } catch (err) {
      toast.error(errorMessage(err));
    }
    setRefreshing(false);
  };

  const startThread = async () => {
    const id = newId.trim();
    if (!id) return;
    setOpening(true);
    try {
      await fetchJson("/api/messaging/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discordId: id }),
      });
      setNewId("");
      await loadThreads();
      setSelectedId(id);
    } catch (err) {
      toast.error(errorMessage(err));
    }
    setOpening(false);
  };

  const send = async () => {
    if (!selectedId || !draft.trim()) return;
    setSending(true);
    try {
      const res = await fetchJson<{ ok: boolean; detail: string; messages: DirectMessage[] }>(
        `/api/messaging/threads/${selectedId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: draft.trim() }),
        }
      );
      setThread((prev) => (prev ? { ...prev, messages: res.messages } : prev));
      setDraft("");
      loadThreads();
    } catch (err) {
      // A refused send is still written to the transcript, so reload it either way.
      toast.error(errorMessage(err));
      openThread(selectedId, false);
      setDraft("");
    }
    setSending(false);
  };

  const query = search.trim().toLowerCase();
  const visible = query
    ? threads.filter((t) =>
        [t.username, t.memberName, t.discordId, t.lastMessage?.content]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query)
      )
    : threads;

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-[20rem_1fr] gap-6">
        <Skeleton className="h-96 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  if (error) {
    return <ErrorState title="Failed to load conversations" message={error} onRetry={loadThreads} />;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[20rem_1fr] gap-6 items-start">
      {/* Thread list */}
      <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl p-3">
        <div className="relative mb-3">
          <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversations..."
            className="pl-9 bg-[#0a0a0a] border-[#1e1e1e]"
          />
        </div>

        <Button
          variant="outline"
          onClick={refreshAll}
          disabled={refreshing}
          className="w-full mb-3 border-[#1e1e1e] text-gray-400"
          title="Pull new replies across recent conversations"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Checking for replies" : "Check for replies"}
        </Button>

        <div className="flex gap-2 mb-3">
          <Input
            value={newId}
            onChange={(e) => setNewId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && startThread()}
            placeholder="Discord user ID"
            className="bg-[#0a0a0a] border-[#1e1e1e]"
          />
          <Button
            onClick={startThread}
            disabled={!newId.trim() || opening}
            className="bg-[#dc2626] text-black hover:bg-[#b91c1c] shrink-0"
            title="Start a conversation"
          >
            {opening ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          </Button>
        </div>

        <div className="space-y-1 max-h-[32rem] overflow-y-auto">
          {visible.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelectedId(t.discordId)}
              className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                t.discordId === selectedId
                  ? "bg-[#dc2626]/10"
                  : "hover:bg-white/5"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-white truncate">{threadName(t)}</span>
                <span className="flex items-center gap-1.5 shrink-0">
                  {t.hasUnread && <span className="w-2 h-2 rounded-full bg-[#dc2626]" />}
                  <span className="text-[11px] text-gray-600">{stamp(t.lastMessageAt)}</span>
                </span>
              </div>
              {t.lastMessage && (
                <div className="text-xs text-gray-500 truncate mt-0.5">
                  {t.lastMessage.direction === "out" ? "Bot: " : ""}
                  {t.lastMessage.content}
                </div>
              )}
            </button>
          ))}
          {visible.length === 0 && (
            <p className="text-gray-600 text-sm px-2 py-4">
              {query ? "No conversations match." : "No conversations yet."}
            </p>
          )}
        </div>
      </div>

      {/* Transcript */}
      {!selectedId ? (
        <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl p-12 text-center">
          <MessageSquare className="w-10 h-10 text-gray-700 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">
            Pick a conversation, or open one with a Discord user ID.
          </p>
        </div>
      ) : (
        <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl flex flex-col">
          <div className="flex items-center justify-between gap-3 p-4 border-b border-[#1e1e1e]">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-full bg-[#5865F2] flex items-center justify-center shrink-0">
                <User className="w-4 h-4 text-white" />
              </div>
              <div className="min-w-0">
                <div className="text-white text-sm font-medium truncate">
                  {thread ? threadName(thread) : selectedId}
                </div>
                <div className="text-gray-500 text-xs truncate">{selectedId}</div>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => openThread(selectedId, true).then(loadThreads)}
              disabled={syncing}
              className="border-[#1e1e1e] text-gray-400 shrink-0"
              title="Pull new replies from Discord"
            >
              <RefreshCw className={`w-4 h-4 mr-1.5 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing" : "Sync"}
            </Button>
          </div>

          {thread?.syncError && (
            <div className="mx-4 mt-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-200 flex gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-yellow-400" />
              <span>Showing the stored transcript — {thread.syncError}</span>
            </div>
          )}

          <div ref={transcriptRef} className="p-4 space-y-3 h-[26rem] overflow-y-auto">
            {threadLoading && !thread ? (
              <div className="space-y-3">
                <Skeleton className="h-12 w-2/3 rounded-lg" />
                <Skeleton className="h-12 w-1/2 rounded-lg ml-auto" />
              </div>
            ) : thread && thread.messages.length > 0 ? (
              thread.messages.map((m) => {
                const outbound = m.direction === "out";
                return (
                  <div key={m.id} className={`flex ${outbound ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[75%] rounded-xl px-3 py-2 ${
                        !m.ok
                          ? "bg-red-500/10 border border-red-500/30"
                          : outbound
                            ? "bg-[#dc2626]/15 border border-[#dc2626]/25"
                            : "bg-[#0a0a0a] border border-[#1e1e1e]"
                      }`}
                    >
                      <div className="text-sm text-gray-100 whitespace-pre-wrap break-words">
                        {m.content}
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-[10px] text-gray-500">
                        <span>{stamp(m.sentAt)}</span>
                        {outbound && m.event !== "manual.dm" && m.event !== "discord" && (
                          <span className="px-1 rounded bg-white/5">{m.event}</span>
                        )}
                        {m.sentBy && <span>by {m.sentBy}</span>}
                        {!m.ok && <span className="text-red-400">{m.error ?? "Failed"}</span>}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-gray-600 text-sm text-center py-12">
                Nothing sent to this person yet.
              </p>
            )}
          </div>

          <div className="p-4 border-t border-[#1e1e1e]">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, MAX_LENGTH))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) send();
              }}
              placeholder="Write as the bot… (**bold**, *italic*, `code`. Ctrl+Enter to send)"
              rows={3}
              className="w-full bg-[#0a0a0a] border border-[#1e1e1e] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#dc2626] resize-none"
            />
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-gray-600">
                {draft.length}/{MAX_LENGTH}
              </span>
              <Button
                onClick={send}
                disabled={sending || !draft.trim()}
                className="bg-[#dc2626] text-black hover:bg-[#b91c1c]"
              >
                {sending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                Send DM
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */

function ChannelTab() {
  const [targets, setTargets] = useState<WebhookTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState("");
  const [customUrl, setCustomUrl] = useState("");
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchJson<{ channels: WebhookTarget[]; departments: WebhookTarget[] }>(
          "/api/messaging/webhook"
        );
        const all = [...data.channels, ...data.departments];
        setTargets(all);
        setTarget(all.find((t) => t.configured)?.value ?? "custom");
      } catch (err) {
        toast.error(errorMessage(err));
      }
      setLoading(false);
    })();
  }, []);

  const post = async () => {
    setSending(true);
    try {
      const res = await fetchJson<{ ok: boolean; target: string }>("/api/messaging/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target, url: customUrl, content: content.trim() }),
      });
      toast.success(`Posted to ${res.target}`);
      setContent("");
    } catch (err) {
      toast.error(errorMessage(err));
    }
    setSending(false);
  };

  if (loading) return <Skeleton className="h-80 rounded-xl" />;

  const selected = targets.find((t) => t.value === target);

  return (
    <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl p-6 space-y-4 max-w-2xl">
      <div>
        <Label className="text-gray-400 text-sm">Channel</Label>
        <select
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          className="mt-1 w-full h-9 bg-[#0a0a0a] border border-[#1e1e1e] rounded-md px-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#dc2626]"
        >
          {targets.map((t) => (
            <option key={t.value} value={t.value} disabled={!t.configured}>
              {t.label}
              {t.configured ? "" : " — no URL configured"}
            </option>
          ))}
          <option value="custom">Custom webhook URL…</option>
        </select>
        {selected?.borrowsFrom && (
          <p className="text-gray-600 text-xs mt-1">
            No URL of its own — this posts on the {selected.borrowsFrom} channel.
          </p>
        )}
      </div>

      {target === "custom" && (
        <div>
          <Label className="text-gray-400 text-sm">Webhook URL</Label>
          <Input
            value={customUrl}
            onChange={(e) => setCustomUrl(e.target.value)}
            placeholder="https://discord.com/api/webhooks/..."
            className="mt-1 bg-[#0a0a0a] border-[#1e1e1e]"
          />
          <p className="text-gray-600 text-xs mt-1">
            Not saved — used for this post only. Set a channel&apos;s permanent URL in Notify
            Settings.
          </p>
        </div>
      )}

      <div>
        <Label className="text-gray-400 text-sm">Message</Label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value.slice(0, MAX_LENGTH))}
          placeholder="Posts as the bot. Supports **bold**, *italic*, `code`, and <@discordId> mentions."
          rows={6}
          className="mt-1 w-full bg-[#0a0a0a] border border-[#1e1e1e] rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#dc2626] resize-none"
        />
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-600">
          {content.length}/{MAX_LENGTH}
        </span>
        <Button
          onClick={post}
          disabled={sending || !content.trim() || (target === "custom" && !customUrl.trim())}
          className="bg-[#dc2626] text-black hover:bg-[#b91c1c]"
        >
          {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
          Post to channel
        </Button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */

function DeliveryLogTab() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [channel, setChannel] = useState("");
  const [failedOnly, setFailedOnly] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ limit: "200" });
    if (search.trim()) params.set("q", search.trim());
    if (channel) params.set("channel", channel);
    if (failedOnly) params.set("failed", "1");
    try {
      setDeliveries(
        await fetchList<Delivery>(`/api/admin/notification-settings/deliveries?${params}`)
      );
    } catch (err) {
      toast.error(errorMessage(err));
    }
    setLoading(false);
  }, [search, channel, failedOnly]);

  // Debounced so typing in the box does not fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  return (
    <div>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-56">
          <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search event, recipient or message..."
            className="pl-9 pr-9 bg-[#111111] border-[#1e1e1e]"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-white"
              title="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <select
          value={channel}
          onChange={(e) => setChannel(e.target.value)}
          className="h-9 rounded-md border border-[#1e1e1e] bg-[#111111] px-3 text-sm text-white"
        >
          <option value="">All transports</option>
          <option value="dm">Direct messages</option>
          <option value="webhook">Channel posts</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-400">
          <input
            type="checkbox"
            checked={failedOnly}
            onChange={(e) => setFailedOnly(e.target.checked)}
            className="h-4 w-4 accent-[#dc2626]"
          />
          Failures only
        </label>
      </div>

      {loading ? (
        <Skeleton className="h-72 rounded-xl" />
      ) : deliveries.length === 0 ? (
        <p className="text-gray-500 text-sm">Nothing logged yet.</p>
      ) : (
        <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1e1e1e]">
                <th className="text-left py-3 px-4 text-gray-500 font-medium">When</th>
                <th className="text-left py-3 px-4 text-gray-500 font-medium">Event</th>
                <th className="text-left py-3 px-4 text-gray-500 font-medium">Via</th>
                <th className="text-left py-3 px-4 text-gray-500 font-medium">To</th>
                <th className="text-left py-3 px-4 text-gray-500 font-medium">Message</th>
                <th className="text-left py-3 px-4 text-gray-500 font-medium">Result</th>
              </tr>
            </thead>
            <tbody>
              {deliveries.map((d) => (
                <tr key={d.id} className="border-b border-[#1e1e1e]/50 hover:bg-white/5">
                  <td className="py-2.5 px-4 text-gray-500 text-xs whitespace-nowrap">
                    {new Date(d.createdAt).toLocaleString()}
                  </td>
                  <td className="py-2.5 px-4 text-gray-300 text-xs">{d.event}</td>
                  <td className="py-2.5 px-4 text-gray-400 text-xs">
                    {d.channel === "dm" ? "DM" : "Channel"}
                  </td>
                  <td className="py-2.5 px-4 text-gray-400 text-xs">{d.target ?? "—"}</td>
                  <td className="py-2.5 px-4 text-gray-400 text-xs max-w-sm truncate" title={d.preview}>
                    {d.preview || "—"}
                  </td>
                  <td className="py-2.5 px-4">
                    {d.ok ? (
                      <span className="text-xs px-2 py-0.5 rounded bg-green-500/20 text-green-400">
                        Sent
                      </span>
                    ) : (
                      <span
                        className="text-xs px-2 py-0.5 rounded bg-red-500/20 text-red-400"
                        title={d.error ?? ""}
                      >
                        Failed
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
