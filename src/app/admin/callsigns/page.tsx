"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorState } from "@/components/ui/error-state";
import { fetchJson, fetchList, errorMessage } from "@/lib/fetch-json";
import { Radio, Search } from "lucide-react";
import { toast } from "sonner";

interface Member {
  id: string;
  name: string;
  callSign: string | null;
  rank: string;
  dept: string;
  discordId: string | null;
}

interface Section {
  members: Member[];
}

export default function AdminCallsignsPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setError(null);
    try {
      const sections = await fetchList<Section>("/api/members");
      setMembers(sections.flatMap((s) => s.members ?? []));
    } catch (err) {
      setError(errorMessage(err));
      setMembers([]);
      toast.error("Failed to load roster");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        (m.callSign && m.callSign.toLowerCase().includes(q)) ||
        m.rank.toLowerCase().includes(q)
    );
  }, [members, search]);

  const selected = members.find((m) => m.id === selectedId) ?? null;
  const isDirty = !!selected && draft !== (selected.callSign ?? "");

  const selectMember = (m: Member) => {
    setSelectedId(m.id);
    setDraft(m.callSign ?? "");
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const updated = await fetchJson<Member>(`/api/members/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callSign: draft || null }),
      });
      setMembers((prev) => prev.map((m) => (m.id === updated.id ? { ...m, callSign: updated.callSign } : m)));
      toast.success(
        updated.discordId
          ? `Call sign updated — ${updated.name} has been notified`
          : `Call sign updated for ${updated.name}`
      );
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="text-gray-500">Loading roster...</div></div>;
  }

  if (error) {
    return <ErrorState title="Failed to load roster" message={error} onRetry={fetchData} />;
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-[family-name:var(--font-oswald)] text-2xl font-bold text-white uppercase flex items-center gap-2">
          <Radio className="w-6 h-6 text-[#dc2626]" />
          Call Signs
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Reassign a roster member&apos;s call sign. They&apos;re notified via webhook when it changes.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl overflow-hidden">
          <div className="p-3 border-b border-[#1e1e1e]">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, call sign, or rank..."
                className="pl-8 h-9 text-sm"
              />
            </div>
          </div>
          <div className="max-h-[60vh] overflow-y-auto divide-y divide-[#1e1e1e]/50">
            {filtered.length === 0 ? (
              <p className="p-4 text-sm text-gray-600">No members match this search.</p>
            ) : (
              filtered.map((m) => (
                <button
                  key={m.id}
                  onClick={() => selectMember(m)}
                  className={`w-full flex items-center justify-between gap-3 px-4 py-3 text-left transition-colors ${
                    m.id === selectedId ? "bg-red-600/10" : "hover:bg-white/5"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-white text-sm font-medium truncate">{m.name}</div>
                    <div className="text-gray-500 text-xs truncate">{m.rank} • {m.dept}</div>
                  </div>
                  <span className="font-[family-name:var(--font-mono)] text-gray-400 text-xs shrink-0">
                    {m.callSign ?? "—"}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl p-6">
          {!selected ? (
            <div className="text-center py-16 text-gray-600 text-sm">
              Select a roster member to update their call sign.
            </div>
          ) : (
            <>
              <div className="mb-6">
                <div className="text-white font-medium">{selected.name}</div>
                <div className="text-gray-500 text-sm">{selected.rank} • {selected.dept}</div>
                {!selected.discordId && (
                  <p className="text-xs text-yellow-500 mt-2">
                    No linked Discord account — the update will apply, but no notification can be sent.
                  </p>
                )}
              </div>
              <Label htmlFor="callsign">Call Sign</Label>
              <Input
                id="callsign"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="e.g. 953"
                className="mt-1"
              />
              <Button
                onClick={handleSave}
                disabled={saving || !isDirty}
                className="mt-4 w-full bg-[#dc2626] text-black hover:bg-[#b91c1c]"
              >
                {saving ? "Saving..." : "Save Call Sign"}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
