"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, Save, Send, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { fetchJson, errorMessage } from "@/lib/fetch-json";
import type { ContentFieldState, ContentValue, SiteNoticeView } from "@/lib/site-content";
import { ContentEditor, editErrors, type Edits } from "./ContentEditor";
import { NoticesEditor } from "./NoticesEditor";
import { MediaLibrary, type MediaItem } from "./MediaLibrary";

interface BossData {
  fields: ContentFieldState[];
  notices: SiteNoticeView[];
  media: MediaItem[];
  canPublish: boolean;
}

const TABS = [
  { id: "content", label: "Website text" },
  { id: "notices", label: "Notices" },
  { id: "media", label: "Media library" },
] as const;

type Tab = (typeof TABS)[number]["id"];

const json = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

/**
 * The Boss Menu: the public website's words, pictures, contact details,
 * section switches and notices, changed here without a code change or deploy.
 *
 * Edits are saved as drafts, checked in preview (the real site, showing the
 * drafts, to this browser only) and then published, which puts them live on
 * the next page load.
 */
export default function BossMenuPage() {
  const [data, setData] = useState<BossData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("content");
  const [edits, setEdits] = useState<Edits>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await fetchJson<BossData>("/api/boss"));
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);

  useEffect(() => {
    // Deferred so the first render is not followed by a synchronous state change.
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const dirty = Object.keys(edits).length > 0;
  const errors = useMemo(() => editErrors(edits), [edits]);
  const pending = data?.fields.filter((f) => f.pending).length ?? 0;

  // Leaving with unsaved edits loses them, so the browser asks first.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const edit = (key: string, value: ContentValue) => {
    const saved = data?.fields.find((f) => f.key === key)?.value;
    setEdits((current) => {
      const next = { ...current };
      if (value === saved) delete next[key];
      else next[key] = value;
      return next;
    });
  };

  const act = async (action: () => Promise<string>) => {
    setBusy(true);
    try {
      toast.success(await action());
      await load();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const saveDrafts = () =>
    act(async () => {
      const { saved } = await fetchJson<{ saved: string[] }>("/api/boss/content", {
        ...json({ values: edits }),
        method: "PATCH",
      });
      setEdits({});
      return `${saved.length} change${saved.length === 1 ? "" : "s"} saved as a draft`;
    });

  const publish = () =>
    act(async () => {
      const { published } = await fetchJson<{ published: string[] }>("/api/boss/content/publish", json({}));
      return published.length ? `${published.length} change${published.length === 1 ? "" : "s"} now live` : "Nothing to publish";
    });

  const discard = (keys?: string[]) => {
    if (!keys && !confirm(`Throw away all ${pending} unpublished change${pending === 1 ? "" : "s"}?`)) return;
    void act(async () => {
      const { discarded } = await fetchJson<{ discarded: string[] }>("/api/boss/content/discard", json({ keys }));
      return discarded.length ? "Draft discarded" : "Nothing to discard";
    });
  };

  if (error && !data) {
    return <ErrorState title="Failed to load the Boss Menu" message={error} onRetry={load} />;
  }
  if (!data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-12 w-full max-w-3xl" />
        <Skeleton className="h-96 w-full max-w-3xl" />
      </div>
    );
  }

  const draftNotices = data.notices.filter((n) => n.status === "Draft").length;

  return (
    <div className="max-w-4xl pb-24">
      <div className="mb-6">
        <h1 className="font-[family-name:var(--font-oswald)] text-2xl font-bold uppercase text-white">Boss Menu</h1>
        <p className="mt-1 text-sm text-gray-500">
          The public website&apos;s words, pictures, contact details and notices. Changes are saved as drafts — preview
          them on the real site, then publish. No deploy or restart needed.
        </p>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-[#1e1e28] bg-card px-4 py-3">
        <div className="mr-auto text-sm">
          {pending > 0 ? (
            <span className="text-amber-300">
              {pending} unpublished change{pending === 1 ? "" : "s"}
            </span>
          ) : (
            <span className="text-gray-500">Everything saved is live.</span>
          )}
          {draftNotices > 0 && (
            <span className="text-gray-500">
              {" "}
              · {draftNotices} draft notice{draftNotices === 1 ? "" : "s"}
            </span>
          )}
        </div>
        <a
          href="/api/boss/preview?on=1"
          target="_blank"
          rel="noreferrer"
          title={dirty ? "Save first to include your latest edits" : "Opens the site showing your drafts — only to you"}
          className="inline-flex h-8 items-center rounded-md border border-input px-3 text-xs font-medium transition-colors hover:bg-accent/10 hover:text-accent"
        >
          <Eye className="mr-1.5 h-4 w-4" />
          Preview site
        </a>
        {pending > 0 && (
          <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => discard()}>
            <Undo2 className="mr-1.5 h-4 w-4" />
            Discard all
          </Button>
        )}
        {data.canPublish && (
          <Button
            type="button"
            size="sm"
            disabled={busy || pending === 0 || dirty}
            title={dirty ? "Save your edits first" : undefined}
            onClick={publish}
          >
            <Send className="mr-1.5 h-4 w-4" />
            Publish{pending > 0 ? ` ${pending}` : ""}
          </Button>
        )}
      </div>

      {!data.canPublish && (
        <p className="-mt-3 mb-6 text-xs text-gray-500">
          You can save drafts and preview them. Someone with the content.publish permission puts them live.
        </p>
      )}

      <div role="tablist" className="mb-6 flex gap-1 border-b border-[#1e1e28]">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === t.id ? "border-red-500 text-white" : "border-transparent text-gray-500 hover:text-gray-300"
            }`}
          >
            {t.label}
            {t.id === "media" && <span className="ml-1.5 text-xs text-gray-600">{data.media.length}</span>}
            {t.id === "notices" && <span className="ml-1.5 text-xs text-gray-600">{data.notices.length}</span>}
          </button>
        ))}
      </div>

      {tab === "content" && (
        <ContentEditor
          fields={data.fields}
          media={data.media}
          edits={edits}
          errors={errors}
          onEdit={edit}
          onDiscardDraft={(key) => discard([key])}
          onMediaChanged={() => void load()}
        />
      )}
      {tab === "notices" && <NoticesEditor notices={data.notices} canPublish={data.canPublish} reload={load} />}
      {tab === "media" && <MediaLibrary media={data.media} canDelete={data.canPublish} reload={load} />}

      {dirty && tab === "content" && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#1e1e28] bg-[#0a0a0f]/95 backdrop-blur md:left-64">
          <div className="flex max-w-4xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6 md:box-content md:px-8">
            <span className="mr-auto text-sm text-gray-300">
              {Object.keys(edits).length} unsaved edit{Object.keys(edits).length === 1 ? "" : "s"}
              {Object.keys(errors).length > 0 && <span className="text-red-400"> · fix the fields marked in red</span>}
            </span>
            <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => setEdits({})}>
              Undo edits
            </Button>
            <Button type="button" size="sm" disabled={busy || Object.keys(errors).length > 0} onClick={saveDrafts}>
              <Save className="mr-1.5 h-4 w-4" />
              Save as draft
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
