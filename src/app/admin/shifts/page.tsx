"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { toast } from "sonner";
import { CalendarClock, ClipboardList, Loader2, Trash2 } from "lucide-react";
import { fetchJson, fetchList, errorMessage } from "@/lib/fetch-json";
import { SHIFT_PERMISSIONS } from "@/lib/constants";
import { SHIFT_SLOTS } from "@/lib/shifts";

interface RosterMember {
  id: string;
  name: string;
  callSign?: string | null;
  rank: string;
}

interface RosterSection {
  members: RosterMember[];
}

interface Signup {
  memberId: string;
  primarySlot: number;
  secondarySlot: number;
  updatedAt: string;
  member: RosterMember;
}

const TABS = ["submit", "schedule"] as const;
type Tab = (typeof TABS)[number];

const selectClass =
  "w-full h-10 rounded-md border border-[#1e1e1e] bg-[#0a0a0a] px-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#dc2626]";

export default function AdminShiftsPage() {
  const { data: session } = useSession();
  const [tab, setTab] = useState<Tab>("submit");
  const [roster, setRoster] = useState<RosterMember[]>([]);
  const [signups, setSignups] = useState<Signup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [memberId, setMemberId] = useState("");
  const [primarySlot, setPrimarySlot] = useState("");
  const [secondarySlot, setSecondarySlot] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [clearingId, setClearingId] = useState<string | null>(null);

  const permissions = session?.user?.permissions ?? [];
  const isSuperAdmin = session?.user?.isSuperAdmin ?? false;
  const canManage = isSuperAdmin || SHIFT_PERMISSIONS.manage.some((p) => permissions.includes(p));

  const load = useCallback(async () => {
    setError(null);
    try {
      const [sections, signupList] = await Promise.all([
        fetchList<RosterSection>("/api/members"),
        fetchList<Signup>("/api/shifts"),
      ]);
      setRoster(
        sections
          .flatMap((s) => s.members)
          .sort((a, b) => a.name.localeCompare(b.name))
      );
      setSignups(signupList);
    } catch (err) {
      setError(errorMessage(err));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Picking a name that already has a pick loads it, so resubmitting reads as
  // an edit rather than starting blank every time.
  useEffect(() => {
    if (!memberId) {
      setPrimarySlot("");
      setSecondarySlot("");
      return;
    }
    const existing = signups.find((s) => s.memberId === memberId);
    setPrimarySlot(existing ? String(existing.primarySlot) : "");
    setSecondarySlot(existing ? String(existing.secondarySlot) : "");
  }, [memberId, signups]);

  const schedule = useMemo(() => {
    return SHIFT_SLOTS.map((label, slot) => ({
      slot,
      label,
      primary: signups
        .filter((s) => s.primarySlot === slot)
        .map((s) => s.member)
        .sort((a, b) => a.name.localeCompare(b.name)),
      secondary: signups
        .filter((s) => s.secondarySlot === slot)
        .map((s) => s.member)
        .sort((a, b) => a.name.localeCompare(b.name)),
    }));
  }, [signups]);

  const submit = async () => {
    if (!memberId || primarySlot === "" || secondarySlot === "") return;
    setSubmitting(true);
    try {
      await fetchJson("/api/shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId,
          primarySlot: Number(primarySlot),
          secondarySlot: Number(secondarySlot),
        }),
      });
      toast.success("Shift saved");
      await load();
      setTab("schedule");
    } catch (err) {
      toast.error(errorMessage(err));
    }
    setSubmitting(false);
  };

  const clearSignup = async (id: string) => {
    setClearingId(id);
    try {
      await fetchJson(`/api/shifts/${id}`, { method: "DELETE" });
      toast.success("Signup cleared");
      await load();
    } catch (err) {
      toast.error(errorMessage(err));
    }
    setClearingId(null);
  };

  if (loading) {
    return (
      <div>
        <Skeleton className="h-8 w-48 mb-2" />
        <Skeleton className="h-4 w-80 mb-8" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  if (error) {
    return <ErrorState title="Failed to load shifts" message={error} onRetry={load} />;
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-[family-name:var(--font-oswald)] text-2xl font-bold text-white uppercase">
          Shifts
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Submit a primary and secondary shift, and see who is covering each 2-hour block.
        </p>
      </div>

      <div className="flex gap-1 mb-6">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              tab === t
                ? "bg-[#dc2626]/10 text-white border border-[#dc2626]/40"
                : "text-gray-500 hover:text-white hover:bg-white/5 border border-transparent"
            }`}
          >
            {t === "submit" ? <ClipboardList className="w-4 h-4" /> : <CalendarClock className="w-4 h-4" />}
            {t === "submit" ? "Submit Shift" : "Schedule"}
          </button>
        ))}
      </div>

      {tab === "submit" && (
        <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl p-6 max-w-xl">
          <div className="space-y-4">
            <div>
              <Label className="text-gray-400 text-sm">Name</Label>
              <select
                value={memberId}
                onChange={(e) => setMemberId(e.target.value)}
                className={`mt-1 ${selectClass}`}
              >
                <option value="">Select your name…</option>
                {roster.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                    {m.callSign ? ` (${m.callSign})` : ""} — {m.rank}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label className="text-gray-400 text-sm">Primary shift</Label>
              <select
                value={primarySlot}
                onChange={(e) => setPrimarySlot(e.target.value)}
                className={`mt-1 ${selectClass}`}
              >
                <option value="">Select a time…</option>
                {SHIFT_SLOTS.map((label, i) => (
                  <option key={i} value={i}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label className="text-gray-400 text-sm">Secondary shift</Label>
              <select
                value={secondarySlot}
                onChange={(e) => setSecondarySlot(e.target.value)}
                className={`mt-1 ${selectClass}`}
              >
                <option value="">Select a time…</option>
                {SHIFT_SLOTS.map((label, i) => (
                  <option key={i} value={i}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <Button
              onClick={submit}
              disabled={!memberId || primarySlot === "" || secondarySlot === "" || submitting}
              className="w-full bg-[#dc2626] text-black hover:bg-[#b91c1c] mt-2"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Shift"}
            </Button>
          </div>
        </div>
      )}

      {tab === "schedule" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {schedule.map(({ slot, label, primary, secondary }) => (
            <div key={slot} className="bg-[#111111] border border-[#1e1e1e] rounded-xl p-4">
              <div className="text-white font-[family-name:var(--font-oswald)] font-semibold uppercase text-sm mb-3">
                {label}
              </div>

              <div className="mb-3">
                <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Primary</div>
                {primary.length === 0 ? (
                  <p className="text-gray-600 text-sm">Unassigned</p>
                ) : (
                  <ul className="space-y-1">
                    {primary.map((m) => (
                      <ShiftRow key={m.id} member={m} canManage={canManage} clearing={clearingId === m.id} onClear={() => clearSignup(m.id)} />
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Secondary</div>
                {secondary.length === 0 ? (
                  <p className="text-gray-600 text-sm">Unassigned</p>
                ) : (
                  <ul className="space-y-1">
                    {secondary.map((m) => (
                      <ShiftRow key={m.id} member={m} canManage={canManage} clearing={clearingId === m.id} onClear={() => clearSignup(m.id)} />
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ShiftRow({
  member,
  canManage,
  clearing,
  onClear,
}: {
  member: RosterMember;
  canManage: boolean;
  clearing: boolean;
  onClear: () => void;
}) {
  return (
    <li className="flex items-center justify-between gap-2 text-sm text-gray-200">
      <span className="truncate">
        {member.name}
        {member.callSign ? <span className="text-gray-600"> · {member.callSign}</span> : null}
      </span>
      {canManage && (
        <button
          onClick={onClear}
          disabled={clearing}
          className="text-gray-600 hover:text-red-400 shrink-0"
          title="Clear this member's shift signup"
        >
          {clearing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
        </button>
      )}
    </li>
  );
}
