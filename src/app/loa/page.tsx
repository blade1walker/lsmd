"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar, Search, CheckCircle } from "lucide-react";
import Link from "next/link";

interface Member {
  id: string;
  name: string;
  callSign?: string | null;
  rank: string;
}

export default function LOARequestPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Member | null>(null);
  const [reason, setReason] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    fetch("/api/members")
      .then((r) => r.json())
      .then((data) => {
        const all = Array.isArray(data)
          ? data.flatMap((s: any) => s.members ?? [])
          : [];
        setMembers(all);
      })
      .catch(() => {})
      .finally(() => setFetching(false));
  }, []);

  const filtered = members.filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.callSign?.toLowerCase().includes(search.toLowerCase())
  );

  const handleSubmit = async () => {
    if (!selected || !reason || !startDate || !endDate) return;
    setLoading(true);
    try {
      const res = await fetch("/api/loa/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId: selected.id,
          reason,
          startDate,
          endDate,
          createdBy: "self",
        }),
      });
      if (res.ok) {
        setSubmitted(true);
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h1 className="font-[family-name:var(--font-oswald)] text-2xl font-bold text-white mb-2">
            LOA Request Submitted
          </h1>
          <p className="text-gray-400 mb-6">
            Your LOA request has been submitted for review. An admin will process it shortly.
          </p>
          <Link href="/">
            <Button variant="outline" className="border-[#1e1e1e] text-gray-400">
              Back to Roster
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <header className="border-b border-[#1e1e1e]">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="text-sm text-gray-400 hover:text-white">
            ← Back to Roster
          </Link>
          <span className="font-[family-name:var(--font-oswald)] text-white font-semibold text-sm">
            LSMD
          </span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-12">
        <div className="flex items-center gap-2 mb-2">
          <Calendar className="w-5 h-5 text-[#eab308]" />
          <h1 className="font-[family-name:var(--font-oswald)] text-2xl font-bold text-white uppercase">
            Request LOA
          </h1>
        </div>
        <p className="text-gray-500 text-sm mb-8">
          Submit a Leave of Absence request. An admin will review and approve it.
        </p>

        {!selected ? (
          <div>
            <Label className="text-gray-400 text-sm">Search your name or call sign</Label>
            <div className="relative mt-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <Input
                placeholder="Type to search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 bg-[#111111] border-[#1e1e1e]"
              />
            </div>
            {fetching && (
              <div className="text-center py-8 text-gray-500 text-sm">Loading members...</div>
            )}
            {filtered.length > 0 && (
              <div className="mt-4 bg-[#111111] border border-[#1e1e1e] rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                {filtered.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setSelected(m)}
                    className="w-full text-left px-4 py-3 hover:bg-white/5 border-b border-[#1e1e1e] last:border-0 flex items-center justify-between"
                  >
                    <div>
                      <span className="text-white text-sm">{m.name}</span>
                      {m.callSign && (
                        <span className="text-gray-500 text-sm ml-2">({m.callSign})</span>
                      )}
                    </div>
                    <span className="text-gray-500 text-xs">{m.rank}</span>
                  </button>
                ))}
              </div>
            )}
            {search && !fetching && filtered.length === 0 && (
              <div className="text-center py-8 text-gray-500 text-sm">
                No members found. Contact an admin.
              </div>
            )}
          </div>
        ) : (
          <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <div className="text-white font-semibold">{selected.name}</div>
                <div className="text-gray-500 text-sm">
                  {selected.callSign && `(${selected.callSign}) `}{selected.rank}
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
                Change
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <Label className="text-gray-400 text-sm">Reason for LOA</Label>
                <Input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Enter reason..."
                  className="mt-1 bg-[#0a0a0a] border-[#1e1e1e]"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-400 text-sm">Start Date</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="mt-1 bg-[#0a0a0a] border-[#1e1e1e]"
                  />
                </div>
                <div>
                  <Label className="text-gray-400 text-sm">End Date</Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="mt-1 bg-[#0a0a0a] border-[#1e1e1e]"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setSelected(null)}
                  className="flex-1 border-[#1e1e1e] text-gray-400"
                >
                  Back
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={loading || !reason || !startDate || !endDate}
                  className="flex-1 bg-[#eab308] text-black hover:bg-[#ca8a04]"
                >
                  {loading ? "Submitting..." : "Submit Request"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
