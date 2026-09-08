"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { fetchJson, fetchList, errorMessage } from "@/lib/fetch-json";
import { toast } from "sonner";
import { ArrowLeft, Search, UserCheck } from "lucide-react";

interface UsableForm {
  id: string;
  name: string;
  description: string | null;
  status: string;
  documentType: { id: string; name: string; category: string; numberPrefix: string };
  versions: { id: string; version: string; published: boolean }[];
}

interface RosterSection {
  members: {
    id: string;
    name: string;
    rank: string;
    callSign?: string | null;
    stateId?: string | null;
    dept: string;
  }[];
}

type Patient = RosterSection["members"][number];

/**
 * Create Document: pick the form, name the patient, start the draft.
 *
 * The patient can be a roster member — whose details are pulled in — or a plain
 * name and State ID, because most patients are civilians the EMS roster has
 * never heard of.
 */
export default function NewMedicalDocumentPage() {
  const router = useRouter();

  const [forms, setForms] = useState<UsableForm[]>([]);
  const [members, setMembers] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formId, setFormId] = useState("");
  const [patientQuery, setPatientQuery] = useState("");
  const [selected, setSelected] = useState<Patient | null>(null);
  const [manualName, setManualName] = useState("");
  const [manualStateId, setManualStateId] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [formList, sections] = await Promise.all([
        fetchList<UsableForm>("/api/medical/forms?usable=1"),
        fetchList<RosterSection>("/api/members"),
      ]);
      setForms(formList);
      setMembers(sections.flatMap((s) => s.members ?? []));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const matches = useMemo(() => {
    const q = patientQuery.trim().toLowerCase();
    if (!q) return [];
    return members
      .filter((m) =>
        [m.name, m.callSign, m.stateId, m.rank].some((v) => v && v.toLowerCase().includes(q))
      )
      .slice(0, 8);
  }, [patientQuery, members]);

  const byType = useMemo(() => {
    const groups = new Map<string, UsableForm[]>();
    for (const form of forms) {
      const key = form.documentType.name;
      groups.set(key, [...(groups.get(key) ?? []), form]);
    }
    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [forms]);

  const patientName = selected?.name ?? manualName.trim();

  const create = async () => {
    if (!formId || !patientName) return;
    setCreating(true);
    try {
      const created = await fetchJson<{ id: string }>("/api/medical/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formId,
          patientMemberId: selected?.id ?? null,
          patientName,
          patientStateId: selected?.stateId ?? (manualStateId.trim() || null),
        }),
      });
      router.push(`/admin/medical/${created.id}`);
    } catch (err) {
      toast.error(errorMessage(err));
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (error) return <ErrorState title="Failed to start a document" message={error} onRetry={load} />;

  return (
    <div className="max-w-3xl">
      <Link
        href="/admin/medical"
        className="inline-flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Medical Documentation
      </Link>

      <h1 className="font-[family-name:var(--font-oswald)] text-2xl font-bold text-white uppercase mb-6">
        Create Document
      </h1>

      {forms.length === 0 ? (
        <div className="rounded-xl border border-yellow-600/30 bg-yellow-600/5 p-4 text-sm text-yellow-300">
          No published forms are available yet. Medical Command builds and publishes forms in the{" "}
          <Link href="/admin/medical/forms" className="underline">
            Form Builder
          </Link>
          .
        </div>
      ) : (
        <div className="space-y-6">
          <section className="rounded-xl border border-[#1e1e28] bg-card p-4">
            <h2 className="text-white text-sm font-semibold mb-1">1 · Choose the document</h2>
            <p className="text-gray-600 text-xs mb-3">
              Only published forms appear here — each one is pinned to the version you start it on.
            </p>
            <div className="space-y-4">
              {byType.map(([typeName, typeForms]) => (
                <div key={typeName}>
                  <div className="text-[11px] uppercase tracking-wide text-gray-500 mb-2">{typeName}</div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {typeForms.map((form) => {
                      const live = form.versions.find((v) => v.published);
                      const on = formId === form.id;
                      return (
                        <button
                          key={form.id}
                          type="button"
                          onClick={() => setFormId(form.id)}
                          className={`text-left rounded-lg border p-3 transition-colors ${
                            on
                              ? "border-red-600/60 bg-red-600/10"
                              : "border-[#1e1e28] bg-[#111118] hover:border-[#33333f]"
                          }`}
                        >
                          <div className="text-white text-sm">{form.name}</div>
                          <div className="text-gray-600 text-xs mt-0.5">
                            {form.documentType.numberPrefix} · v{live?.version ?? "—"}
                          </div>
                          {form.description && (
                            <div className="text-gray-500 text-xs mt-1 line-clamp-2">{form.description}</div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-[#1e1e28] bg-card p-4">
            <h2 className="text-white text-sm font-semibold mb-1">2 · Identify the patient</h2>
            <p className="text-gray-600 text-xs mb-3">
              Search the roster to pull in their details, or type the name of anyone who isn&apos;t on it.
            </p>

            {selected ? (
              <div className="flex items-center justify-between rounded-lg border border-green-600/40 bg-green-600/10 px-3 py-2">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-green-400" />
                  <div>
                    <div className="text-white text-sm">{selected.name}</div>
                    <div className="text-gray-500 text-xs">
                      {selected.rank}
                      {selected.callSign && ` · ${selected.callSign}`}
                      {selected.stateId && ` · State ID ${selected.stateId}`}
                    </div>
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setSelected(null)}>
                  Change
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="w-4 h-4 text-gray-600 absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input
                    value={patientQuery}
                    onChange={(e) => setPatientQuery(e.target.value)}
                    placeholder="Search roster by name, call sign or State ID"
                    className="pl-9"
                  />
                </div>
                {matches.length > 0 && (
                  <div className="rounded-lg border border-[#1e1e28] divide-y divide-[#1e1e28]">
                    {matches.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setSelected(m);
                          setPatientQuery("");
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-white/5"
                      >
                        <div className="text-white text-sm">{m.name}</div>
                        <div className="text-gray-500 text-xs">
                          {m.rank}
                          {m.callSign && ` · ${m.callSign}`}
                          {m.stateId && ` · State ID ${m.stateId}`}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                <div className="pt-2 border-t border-[#1e1e28]">
                  <div className="text-gray-500 text-xs mb-2">Not on the roster?</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Patient name</Label>
                      <Input
                        value={manualName}
                        onChange={(e) => setManualName(e.target.value)}
                        placeholder="Full name"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">State ID</Label>
                      <Input
                        value={manualStateId}
                        onChange={(e) => setManualStateId(e.target.value)}
                        placeholder="e.g. 12345"
                        className="mt-1"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>

          <div className="flex items-center gap-3">
            <Button onClick={create} disabled={creating || !formId || !patientName}>
              {creating ? "Starting…" : "Start document"}
            </Button>
            {!formId && <span className="text-gray-600 text-xs">Choose a document first.</span>}
            {formId && !patientName && (
              <span className="text-gray-600 text-xs">Name the patient to continue.</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
