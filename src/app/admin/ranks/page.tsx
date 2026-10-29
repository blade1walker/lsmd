"use client";

import { useState, useEffect, useCallback } from "react";
import { ArrowDown, ArrowUp, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import RankInsignia from "@/components/roster/RankInsignia";
import {
  DEFAULT_RANK_COLOR,
  RANK_LAYOUTS,
  RANK_MAX_COUNT,
  RANK_SHAPES,
  applyRankOverrides,
  type RankDef,
} from "@/lib/constants";
import { fetchJson, errorMessage } from "@/lib/fetch-json";
import { toast } from "sonner";

const SHAPE_LABELS: Record<string, string> = {
  none: "None",
  pip: "Pips",
  chevron: "Chevrons",
  bar: "Bars",
  star: "Stars",
};
const LAYOUT_LABELS: Record<string, string> = {
  row: "In a row",
  stack: "Stacked",
  pyramid: "Pyramid",
};
const SWATCHES = ["#dc2626", "#f59e0b", "#eab308", "#d1d5db", "#3b82f6", "#22c55e", "#a855f7", "#ffffff"];

const selectClass =
  "h-8 rounded-md border border-[#1e1e28] bg-[#0a0a0f] px-2 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-red-600";

interface RanksResponse {
  ranks: RankDef[];
  defaults: RankDef[];
}

const toOverrides = (ranks: RankDef[]) =>
  ranks.map((r, position) => ({
    name: r.name,
    position,
    shape: r.shape,
    count: r.count,
    color: r.color === DEFAULT_RANK_COLOR ? null : r.color,
    layout: r.layout,
  }));

export default function RanksPage() {
  const [ranks, setRanks] = useState<RankDef[]>([]);
  const [defaults, setDefaults] = useState<RankDef[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await fetchJson<RanksResponse>("/api/admin/ranks");
      setRanks(data.ranks);
      setDefaults(data.defaults);
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

  const edit = (name: string, patch: Partial<RankDef>) => {
    setRanks((list) => list.map((r) => (r.name === name ? { ...r, ...patch } : r)));
    setDirty(true);
  };

  const move = (index: number, by: -1 | 1) => {
    const to = index + by;
    if (to < 0 || to >= ranks.length) return;
    const next = [...ranks];
    [next[index], next[to]] = [next[to], next[index]];
    setRanks(next);
    setDirty(true);
  };

  const applySaved = (saved: RankDef[]) => {
    setRanks(saved);
    setDirty(false);
    // Badges elsewhere on this page (and the sidebar) follow at once.
    applyRankOverrides(toOverrides(saved));
  };

  const save = async () => {
    setSaving(true);
    try {
      const data = await fetchJson<{ ranks: RankDef[] }>("/api/admin/ranks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ranks: toOverrides(ranks) }),
      });
      applySaved(data.ranks);
      toast.success("Ranks saved — the whole site uses the new order and insignia");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }
    setConfirmReset(false);
    setSaving(true);
    try {
      const data = await fetchJson<{ ranks: RankDef[] }>("/api/admin/ranks", { method: "DELETE" });
      applySaved(data.ranks);
      toast.success("Every rank is back to its original position and insignia");
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
        <Skeleton className="h-96 w-full max-w-4xl" />
      </div>
    );
  }
  if (error) {
    return <ErrorState title="Failed to load ranks" message={error} onRetry={load} />;
  }

  const orderChanged = ranks.some((r, i) => defaults[i]?.name !== r.name);

  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <h1 className="font-[family-name:var(--font-oswald)] text-2xl font-bold uppercase text-white">
          Ranks &amp; Insignia
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          The rank ladder, highest first. Move a rank up or down to change who outranks whom, and set how each
          rank&apos;s insignia looks on the roster.
        </p>
      </div>

      <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-xs text-amber-200/90">
        The order is used everywhere a rank is compared: roster sorting, promote and demote, minimum ranks on tests and
        departments, and promotion interviews. Members keep their rank name — only its place in the ladder changes.
      </div>

      <div className="overflow-hidden rounded-xl border border-[#1e1e28] bg-card">
        <div className="hidden grid-cols-[3rem_4.5rem_1fr_8rem_4.5rem_11rem_8rem] items-center gap-3 border-b border-[#1e1e28] bg-[#0a0a0f] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500 md:grid">
          <span>Order</span>
          <span>Badge</span>
          <span>Rank</span>
          <span>Shape</span>
          <span>Count</span>
          <span>Color</span>
          <span>Arrangement</span>
        </div>

        {ranks.map((r, i) => (
          <div
            key={r.name}
            className="grid grid-cols-[3rem_4.5rem_1fr] items-center gap-3 border-b border-[#1e1e28] px-4 py-3 last:border-b-0 md:grid-cols-[3rem_4.5rem_1fr_8rem_4.5rem_11rem_8rem]"
          >
            <div className="flex flex-col items-center">
              <button
                type="button"
                onClick={() => move(i, -1)}
                disabled={i === 0}
                className="rounded p-1 text-gray-500 hover:text-white disabled:opacity-20"
                aria-label={`Move ${r.name} up`}
              >
                <ArrowUp className="h-4 w-4" />
              </button>
              <span className="font-mono text-xs text-gray-500">{i + 1}</span>
              <button
                type="button"
                onClick={() => move(i, 1)}
                disabled={i === ranks.length - 1}
                className="rounded p-1 text-gray-500 hover:text-white disabled:opacity-20"
                aria-label={`Move ${r.name} down`}
              >
                <ArrowDown className="h-4 w-4" />
              </button>
            </div>

            <div className="flex h-12 items-center justify-center rounded-md bg-[#0a0a0f]">
              <RankInsignia shape={r.shape} count={r.count} color={r.color} layout={r.layout} size={22} />
              {(r.shape === "none" || r.count === 0) && <span className="text-[10px] text-gray-600">none</span>}
            </div>

            <div>
              <p className="text-sm font-medium text-white">{r.name}</p>
              <p className="text-xs text-gray-500">{r.tier}</p>
            </div>

            <div className="col-span-3 flex flex-wrap items-center gap-3 md:contents">
              <select
                value={r.shape}
                onChange={(e) => edit(r.name, { shape: e.target.value as RankDef["shape"] })}
                className={selectClass}
                aria-label={`${r.name} insignia shape`}
              >
                {RANK_SHAPES.map((s) => (
                  <option key={s} value={s}>
                    {SHAPE_LABELS[s]}
                  </option>
                ))}
              </select>

              <select
                value={r.count}
                onChange={(e) => edit(r.name, { count: Number(e.target.value) })}
                disabled={r.shape === "none"}
                className={selectClass}
                aria-label={`${r.name} insignia count`}
              >
                {Array.from({ length: RANK_MAX_COUNT + 1 }, (_, n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>

              <div className="flex items-center gap-1.5">
                <input
                  type="color"
                  value={r.color}
                  onChange={(e) => edit(r.name, { color: e.target.value })}
                  className="h-7 w-7 cursor-pointer rounded border border-[#1e1e28] bg-transparent p-0"
                  aria-label={`${r.name} insignia color`}
                />
                {SWATCHES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => edit(r.name, { color: c })}
                    className={`h-4 w-4 rounded-full border ${
                      r.color.toLowerCase() === c ? "border-white" : "border-transparent"
                    }`}
                    style={{ backgroundColor: c }}
                    aria-label={`Use ${c}`}
                    title={c}
                  />
                ))}
              </div>

              <select
                value={r.layout}
                onChange={(e) => edit(r.name, { layout: e.target.value as RankDef["layout"] })}
                disabled={r.shape === "none" || r.count < 2}
                className={selectClass}
                aria-label={`${r.name} insignia arrangement`}
              >
                {RANK_LAYOUTS.map((l) => (
                  <option key={l} value={l} disabled={l === "pyramid" && r.count < 3}>
                    {LAYOUT_LABELS[l]}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button onClick={save} disabled={saving || !dirty}>
          {saving ? "Saving…" : "Save ranks"}
        </Button>
        <Button variant="outline" onClick={load} disabled={saving || !dirty}>
          Discard changes
        </Button>
        <Button
          variant="ghost"
          onClick={reset}
          onBlur={() => setConfirmReset(false)}
          disabled={saving}
          className={confirmReset ? "text-red-400" : "text-gray-400"}
        >
          <RotateCcw className="mr-1.5 h-4 w-4" />
          {confirmReset ? "Click again to reset everything" : "Reset to defaults"}
        </Button>
        {orderChanged && <span className="text-xs text-amber-300/80">The order differs from the original ladder.</span>}
      </div>
    </div>
  );
}
