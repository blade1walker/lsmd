"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fetchJson, errorMessage } from "@/lib/fetch-json";
import { NOTICE_LIMITS, NOTICE_TONES, type NoticeTone, type SiteNoticeView } from "@/lib/site-content";

interface Draft {
  title: string;
  body: string;
  tone: NoticeTone;
  linkUrl: string;
  linkLabel: string;
}

const EMPTY: Draft = { title: "", body: "", tone: "info", linkUrl: "", linkLabel: "" };

const json = (body: unknown): RequestInit => ({
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

/**
 * Announcements at the top of the home page. A new notice starts as a draft,
 * visible only in preview, until someone with the publish permission puts it
 * live; unpublishing takes it down again without losing it.
 */
export function NoticesEditor({
  notices,
  canPublish,
  reload,
}: {
  notices: SiteNoticeView[];
  canPublish: boolean;
  reload: () => Promise<void>;
}) {
  const [editing, setEditing] = useState<{ id: string | null; draft: Draft } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (id: string, action: () => Promise<unknown>, done: string) => {
    setBusy(id);
    try {
      await action();
      toast.success(done);
      await reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    if (!editing) return;
    const { id, draft } = editing;
    await run(
      id ?? "new",
      () =>
        id
          ? fetchJson(`/api/boss/notices/${id}`, { method: "PATCH", ...json(draft) })
          : fetchJson("/api/boss/notices", { method: "POST", ...json(draft) }),
      id ? "Notice saved" : "Notice created as a draft"
    );
    setEditing(null);
  };

  const setStatus = (n: SiteNoticeView, status: "Published" | "Draft") =>
    run(
      n.id,
      () => fetchJson(`/api/boss/notices/${n.id}`, { method: "PATCH", ...json({ status }) }),
      status === "Published" ? "Notice is live" : "Notice taken down"
    );

  const remove = (n: SiteNoticeView) => {
    if (!confirm(`Delete "${n.title}"? This cannot be undone.`)) return;
    void run(n.id, () => fetchJson(`/api/boss/notices/${n.id}`, { method: "DELETE" }), "Notice deleted");
  };

  /** Swaps a notice with its neighbour. */
  const move = (index: number, by: -1 | 1) => {
    const a = notices[index];
    const b = notices[index + by];
    if (!a || !b) return;
    void run(
      a.id,
      async () => {
        await fetchJson(`/api/boss/notices/${a.id}`, { method: "PATCH", ...json({ order: b.order }) });
        await fetchJson(`/api/boss/notices/${b.id}`, { method: "PATCH", ...json({ order: a.order }) });
      },
      "Order saved"
    );
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-500">
          Shown at the top of the home page, in this order. Drafts appear only in preview.
        </p>
        <Button type="button" onClick={() => setEditing({ id: null, draft: EMPTY })}>
          <Plus className="mr-1.5 h-4 w-4" />
          New notice
        </Button>
      </div>

      {notices.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#26262f] p-10 text-center text-sm text-gray-500">
          No notices. Add one for an event, a recruitment drive or server news.
        </div>
      ) : (
        <ol className="space-y-3">
          {notices.map((n, i) => {
            const tone = NOTICE_TONES[n.tone];
            const live = n.status === "Published";
            const locked = live && !canPublish;
            return (
              <li key={n.id} className="rounded-xl border border-[#1e1e28] bg-card p-4">
                <div className="flex flex-wrap items-start gap-3">
                  <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${tone.dot}`} title={tone.label} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-white">{n.title}</span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                          live ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300"
                        }`}
                      >
                        {live ? "Live" : "Draft"}
                      </span>
                    </div>
                    {n.body && <p className="mt-1 line-clamp-3 whitespace-pre-line text-sm text-gray-400">{n.body}</p>}
                    {n.linkUrl && (
                      <p className="mt-1 truncate text-xs text-gray-500">
                        {n.linkLabel || "Find out more"} → {n.linkUrl}
                      </p>
                    )}
                    <p className="mt-2 text-xs text-gray-600">
                      {n.updatedBy ? `Last changed by ${n.updatedBy} · ` : ""}
                      {new Date(n.updatedAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    <IconButton label="Move up" disabled={i === 0 || busy !== null} onClick={() => move(i, -1)}>
                      <ArrowUp className="h-4 w-4" />
                    </IconButton>
                    <IconButton
                      label="Move down"
                      disabled={i === notices.length - 1 || busy !== null}
                      onClick={() => move(i, 1)}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </IconButton>
                    <IconButton
                      label={locked ? "Live notices can only be edited by someone who can publish" : "Edit"}
                      disabled={locked || busy !== null}
                      onClick={() =>
                        setEditing({
                          id: n.id,
                          draft: {
                            title: n.title,
                            body: n.body,
                            tone: n.tone,
                            linkUrl: n.linkUrl ?? "",
                            linkLabel: n.linkLabel ?? "",
                          },
                        })
                      }
                    >
                      <Pencil className="h-4 w-4" />
                    </IconButton>
                    {canPublish && (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={busy !== null}
                          onClick={() => setStatus(n, live ? "Draft" : "Published")}
                        >
                          {live ? <EyeOff className="mr-1.5 h-4 w-4" /> : <Eye className="mr-1.5 h-4 w-4" />}
                          {live ? "Unpublish" : "Publish"}
                        </Button>
                        <IconButton label="Delete" disabled={busy !== null} onClick={() => remove(n)} danger>
                          <Trash2 className="h-4 w-4" />
                        </IconButton>
                      </>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        {editing && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing.id ? "Edit notice" : "New notice"}</DialogTitle>
            </DialogHeader>
            <NoticeForm draft={editing.draft} onChange={(draft) => setEditing({ ...editing, draft })} />
            <DialogFooter className="mt-6 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button type="button" onClick={save} disabled={busy !== null || !editing.draft.title.trim()}>
                {editing.id ? "Save" : "Create draft"}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}

function NoticeForm({ draft, onChange }: { draft: Draft; onChange: (draft: Draft) => void }) {
  const set = (patch: Partial<Draft>) => onChange({ ...draft, ...patch });
  return (
    <div className="mt-4 space-y-4">
      <div>
        <Label htmlFor="notice-title">Title</Label>
        <Input
          id="notice-title"
          value={draft.title}
          maxLength={NOTICE_LIMITS.title}
          onChange={(e) => set({ title: e.target.value })}
          placeholder="e.g. Recruitment drive this weekend"
          className="mt-1"
        />
      </div>
      <div>
        <Label htmlFor="notice-body">Text</Label>
        <Textarea
          id="notice-body"
          value={draft.body}
          maxLength={NOTICE_LIMITS.body}
          rows={4}
          onChange={(e) => set({ body: e.target.value })}
          className="mt-1"
        />
        <p className="mt-1 text-xs text-gray-600">
          {draft.body.length}/{NOTICE_LIMITS.body}
        </p>
      </div>
      <div>
        <Label htmlFor="notice-tone">Style</Label>
        <Select
          id="notice-tone"
          value={draft.tone}
          onChange={(e) => set({ tone: e.target.value as NoticeTone })}
          className="mt-1"
        >
          {Object.entries(NOTICE_TONES).map(([value, tone]) => (
            <option key={value} value={value}>
              {tone.label}
            </option>
          ))}
        </Select>
      </div>
      <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        <div>
          <Label htmlFor="notice-link">Link (optional)</Label>
          <Input
            id="notice-link"
            value={draft.linkUrl}
            inputMode="url"
            onChange={(e) => set({ linkUrl: e.target.value })}
            placeholder="https://… or /onboarding"
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="notice-link-label">Link text</Label>
          <Input
            id="notice-link-label"
            value={draft.linkLabel}
            maxLength={NOTICE_LIMITS.linkLabel}
            onChange={(e) => set({ linkLabel: e.target.value })}
            placeholder="Find out more"
            className="mt-1"
          />
        </div>
      </div>
    </div>
  );
}

function IconButton({
  label,
  disabled,
  onClick,
  danger,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`rounded-md p-2 transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-30 ${
        danger ? "text-red-400 hover:text-red-300" : "text-gray-400 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}
