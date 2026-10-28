"use client";

import { useRef, useState } from "react";
import { Check, Copy, ImagePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fetchJson, errorMessage } from "@/lib/fetch-json";

export interface MediaItem {
  id: string;
  url: string;
  originalName: string;
  alt: string | null;
  size: number;
  mimeType: string;
  uploadedBy: string;
  createdAt: string;
}

const ACCEPT = "image/png,image/jpeg,image/webp,image/gif";

function formatSize(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Uploads one image and returns its address on the site. */
async function uploadImage(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const saved = await fetchJson<{ url: string }>("/api/boss/media", { method: "POST", body: form });
  return saved.url;
}

/** A button that opens the file chooser and uploads what is picked. */
function UploadButton({ onUploaded, label = "Upload image" }: { onUploaded: (url: string) => void; label?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      onUploaded(await uploadImage(file));
      toast.success(`${file.name} uploaded`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <>
      <input ref={input} type="file" accept={ACCEPT} className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
      <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => input.current?.click()}>
        <ImagePlus className="mr-1.5 h-4 w-4" />
        {busy ? "Uploading…" : label}
      </Button>
    </>
  );
}

/** Choose a picture for a content field: one from the library, or a new upload. */
export function ImagePicker({
  open,
  onOpenChange,
  media,
  current,
  onPick,
  onUploaded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  media: MediaItem[];
  current: string;
  onPick: (url: string) => void;
  onUploaded: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Choose an image</DialogTitle>
          <DialogDescription>PNG, JPEG, WebP or GIF, up to 5 MB.</DialogDescription>
        </DialogHeader>
        <div className="mt-4">
          <UploadButton
            onUploaded={(url) => {
              onUploaded();
              onPick(url);
              onOpenChange(false);
            }}
            label="Upload a new image"
          />
        </div>
        {media.length === 0 ? (
          <p className="mt-6 text-sm text-gray-500">The library is empty — upload the first image.</p>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {media.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  onPick(m.url);
                  onOpenChange(false);
                }}
                className={`group relative overflow-hidden rounded-lg border bg-[#0a0a0f] text-left transition-colors ${
                  m.url === current ? "border-red-500" : "border-[#1e1e28] hover:border-white/30"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.url} alt={m.alt ?? ""} className="aspect-square w-full object-contain" />
                <span className="block truncate px-2 py-1.5 text-xs text-gray-400">{m.originalName}</span>
                {m.url === current && (
                  <span className="absolute right-1.5 top-1.5 rounded-full bg-red-600 p-1">
                    <Check className="h-3 w-3 text-white" />
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Every uploaded image, with its link and who uploaded it. */
export function MediaLibrary({
  media,
  canDelete,
  reload,
}: {
  media: MediaItem[];
  canDelete: boolean;
  reload: () => Promise<void>;
}) {
  const [deleting, setDeleting] = useState<string | null>(null);

  const remove = async (item: MediaItem) => {
    if (!confirm(`Delete ${item.originalName}? This cannot be undone.`)) return;
    setDeleting(item.id);
    try {
      await fetchJson(`/api/boss/media/${item.id}`, { method: "DELETE" });
      toast.success("Image deleted");
      await reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setDeleting(null);
    }
  };

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(new URL(url, window.location.origin).toString());
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy the link");
    }
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-500">
          Logos, banners and pictures for the website. PNG, JPEG, WebP or GIF, up to 5 MB. An image the website uses
          cannot be deleted until something else replaces it.
        </p>
        <UploadButton onUploaded={() => void reload()} />
      </div>
      {media.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#26262f] p-10 text-center text-sm text-gray-500">
          No images yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {media.map((m) => (
            <div key={m.id} className="overflow-hidden rounded-xl border border-[#1e1e28] bg-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.url} alt={m.alt ?? ""} className="aspect-video w-full bg-[#0a0a0f] object-contain" />
              <div className="space-y-2 p-3">
                <div className="truncate text-sm font-medium text-white" title={m.originalName}>
                  {m.originalName}
                </div>
                <div className="text-xs text-gray-500">
                  {formatSize(m.size)} · {m.uploadedBy} · {new Date(m.createdAt).toLocaleDateString()}
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => copy(m.url)}>
                    <Copy className="mr-1.5 h-3.5 w-3.5" />
                    Copy link
                  </Button>
                  {canDelete && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={deleting === m.id}
                      onClick={() => remove(m)}
                      className="text-red-400 hover:text-red-300"
                    >
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                      Delete
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
