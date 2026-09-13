"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { RosterBannerStrip } from "@/components/roster/RosterBannerStrip";
import { fetchJson, errorMessage } from "@/lib/fetch-json";
import { toast } from "sonner";

interface Banner {
  active: boolean;
  label: string;
  highlight: string;
  message: string;
  updatedBy: string | null;
  updatedAt: string;
}

export default function RosterBannerPage() {
  const [banner, setBanner] = useState<Banner | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setBanner(await fetchJson<Banner>("/api/roster-banner"));
      setDirty(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const edit = (patch: Partial<Banner>) => {
    if (!banner) return;
    setBanner({ ...banner, ...patch });
    setDirty(true);
  };

  const save = async () => {
    if (!banner) return;
    setSaving(true);
    try {
      const saved = await fetchJson<Banner>("/api/roster-banner", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          active: banner.active,
          label: banner.label,
          highlight: banner.highlight,
          message: banner.message,
        }),
      });
      setBanner(saved);
      setDirty(false);
      toast.success(saved.active ? "Banner is live on the roster" : "Banner saved (hidden)");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-64 w-full max-w-2xl" />
      </div>
    );
  }
  if (error || !banner) {
    return <ErrorState title="Failed to load the roster banner" message={error ?? "Not found"} onRetry={load} />;
  }

  const empty = ![banner.label, banner.highlight, banner.message].some((v) => v.trim());

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="font-[family-name:var(--font-oswald)] text-2xl font-bold uppercase text-white">Roster Banner</h1>
        <p className="mt-1 text-sm text-gray-500">
          The spotlight strip under the header of the public roster — department news, an event, or a shout-out.
        </p>
      </div>

      <div className="mb-4 overflow-hidden rounded-xl border border-[#1e1e28]">
        <div className="border-b border-[#1e1e28] bg-[#0a0a0f] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500">
          Preview {banner.active ? "· live" : "· hidden"}
        </div>
        {empty ? (
          <p className="bg-[#0c0c12] px-4 py-4 text-center text-sm text-gray-600">Fill in the fields below to see the strip.</p>
        ) : (
          <div className={banner.active ? "" : "opacity-50"}>
            <RosterBannerStrip banner={banner} />
          </div>
        )}
      </div>

      <div className="space-y-4 rounded-xl border border-[#1e1e28] bg-card p-5">
        <label className="flex items-center gap-3 text-sm text-gray-300">
          <input
            type="checkbox"
            checked={banner.active}
            onChange={(e) => edit({ active: e.target.checked })}
            className="h-4 w-4 accent-red-600"
          />
          Show the banner on the public roster
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Label</Label>
            <Input
              value={banner.label}
              maxLength={60}
              onChange={(e) => edit({ label: e.target.value })}
              placeholder="e.g. Medic of the Month"
              className="mt-1"
            />
          </div>
          <div>
            <Label>Highlight</Label>
            <Input
              value={banner.highlight}
              maxLength={80}
              onChange={(e) => edit({ highlight: e.target.value })}
              placeholder="e.g. a member's name"
              className="mt-1"
            />
          </div>
        </div>

        <div>
          <Label>Message</Label>
          <Textarea
            value={banner.message}
            maxLength={240}
            rows={2}
            onChange={(e) => edit({ message: e.target.value })}
            placeholder="e.g. 140 hours on duty this month and never once late to a call."
            className="mt-1"
          />
          <p className="mt-1 text-xs text-gray-600">{banner.message.length}/240</p>
        </div>

        <div className="flex items-center gap-4">
          <Button onClick={save} disabled={saving || !dirty}>
            {saving ? "Saving…" : "Save banner"}
          </Button>
          {banner.updatedBy && (
            <span className="text-xs text-gray-600">
              Last changed by {banner.updatedBy} · {new Date(banner.updatedAt).toLocaleString()}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
