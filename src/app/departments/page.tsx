"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession, signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle,
  Clock,
  ExternalLink,
  Building2,
  Lock,
} from "lucide-react";
import { fetchJson, fetchList, errorMessage } from "@/lib/fetch-json";
import { isRankAtLeast } from "@/lib/constants";
import { departmentTag, questionOptions } from "@/lib/departments";
import { DepartmentMark } from "@/components/DepartmentMark";

interface Question {
  id: string;
  label: string;
  type: string;
  options: unknown;
  placeholder: string | null;
  required: boolean;
  order: number;
}

interface Department {
  id: string;
  name: string;
  tag: string | null;
  color: string;
  description: string | null;
  documentLink: string | null;
  openForApplications: boolean;
  minRank: string | null;
  order: number;
  questions: Question[];
  joined: boolean;
  joinedRole?: string | null;
  pending: boolean;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <header className="border-b border-[#1e1e1e]">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="text-sm text-gray-400 hover:text-white">
            ← Back to Roster
          </Link>
          <span className="font-[family-name:var(--font-oswald)] text-white font-semibold text-sm">
            EMS
          </span>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-12">{children}</main>
    </div>
  );
}

export default function DepartmentsPage() {
  const { data: session, status } = useSession();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selected, setSelected] = useState<Department | null>(null);
  const [answers, setAnswers] = useState<Record<string, string | boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submittedTo, setSubmittedTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setDepartments(await fetchList<Department>("/api/departments"));
    } catch (err) {
      setLoadError(errorMessage(err));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (status !== "loading") load();
  }, [status, load]);

  const rank = session?.user?.memberRank ?? null;

  // Mirrors the server rule so an ineligible member is told before filling the
  // form rather than after submitting it. The API check is the one that counts.
  const eligibility = useCallback(
    (dept: Department) => {
      if (!dept.openForApplications) return { ok: false, reason: "Applications are closed." };
      if (dept.joined) return { ok: false, reason: "You are already in this department." };
      if (dept.pending) return { ok: false, reason: "You already have an application awaiting review." };
      if (!rank) return { ok: false, reason: "Your Discord account is not linked to a roster member." };
      if (dept.minRank && !isRankAtLeast(rank, dept.minRank)) {
        return { ok: false, reason: `Open to ${dept.minRank} and above — you are ${rank}.` };
      }
      return { ok: true, reason: "" };
    },
    [rank]
  );

  const openForm = (dept: Department) => {
    setSelected(dept);
    setError(null);
    setAnswers(
      Object.fromEntries(
        dept.questions.map((q) => [q.id, q.type === "checkbox" ? false : ""])
      )
    );
  };

  const handleSubmit = async () => {
    if (!selected) return;
    setSubmitting(true);
    setError(null);
    try {
      await fetchJson(`/api/departments/${selected.id}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      setSubmittedTo(selected.name);
      setSelected(null);
      load();
    } catch (err) {
      setError(errorMessage(err));
    }
    setSubmitting(false);
  };

  const missingRequired = useMemo(() => {
    if (!selected) return false;
    return selected.questions.some((q) => {
      if (!q.required) return false;
      const value = answers[q.id];
      return q.type === "checkbox" ? value !== true : !String(value ?? "").trim();
    });
  }, [selected, answers]);

  if (status === "loading") {
    return <div className="min-h-screen bg-[#0a0a0a]" />;
  }

  if (!session) {
    return (
      <Shell>
        <div className="text-center py-16">
          <Building2 className="w-12 h-12 text-[#dc2626] mx-auto mb-4" />
          <h1 className="font-[family-name:var(--font-oswald)] text-2xl font-bold text-white mb-2 uppercase">
            Join a Department
          </h1>
          <p className="text-gray-500 mb-6">
            Sign in with Discord to apply. Your name and rank are read from the roster.
          </p>
          <Button onClick={() => signIn("discord")} className="bg-[#5865F2] hover:bg-[#4752C4]">
            Sign in with Discord
          </Button>
        </div>
      </Shell>
    );
  }

  if (submittedTo) {
    return (
      <Shell>
        <div className="text-center py-16">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h1 className="font-[family-name:var(--font-oswald)] text-2xl font-bold text-white mb-2">
            Application Submitted
          </h1>
          <p className="text-gray-400 mb-6">
            Your application to {submittedTo} has been sent. You will be notified once it is reviewed.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Button
              variant="outline"
              className="border-[#1e1e1e] text-gray-400"
              onClick={() => setSubmittedTo(null)}
            >
              Apply to another
            </Button>
            <Link href="/">
              <Button className="bg-[#dc2626] text-black hover:bg-[#b91c1c]">Back to Roster</Button>
            </Link>
          </div>
        </div>
      </Shell>
    );
  }

  // ---- One department's form -------------------------------------------
  if (selected) {
    const check = eligibility(selected);
    return (
      <Shell>
        <button
          onClick={() => setSelected(null)}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-white mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          All departments
        </button>

        <div className="flex items-center gap-2 mb-2">
          <span
            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold"
            style={{
              color: selected.color,
              backgroundColor: `${selected.color}1a`,
              border: `1px solid ${selected.color}33`,
            }}
          >
            {departmentTag(selected)}
          </span>
          <h1 className="font-[family-name:var(--font-oswald)] text-2xl font-bold text-white uppercase">
            {selected.name}
          </h1>
        </div>
        {selected.description && (
          <p className="text-gray-500 text-sm mb-6 whitespace-pre-wrap">{selected.description}</p>
        )}

        {!check.ok && (
          <div className="mb-6 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-200 flex gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 text-yellow-400" />
            <span>{check.reason}</span>
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300 flex gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 text-red-400" />
            <span className="break-words">{error}</span>
          </div>
        )}

        <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Applicant</span>
              <div className="text-white mt-0.5">{session.user.name ?? "—"}</div>
            </div>
            <div>
              <span className="text-gray-500">Rank</span>
              <div className={`mt-0.5 ${check.ok ? "text-white" : "text-yellow-300"}`}>
                {rank ?? "No roster entry"}
              </div>
            </div>
          </div>

          {selected.questions.length === 0 && (
            <p className="text-gray-500 text-sm">
              This department asks no questions — submit to register your interest.
            </p>
          )}

          {selected.questions.map((question) => {
            const value = answers[question.id];
            const shared =
              "w-full bg-[#0a0a0a] border border-[#1e1e1e] rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#dc2626] disabled:opacity-50";
            return (
              <div key={question.id}>
                <Label className="text-gray-400 text-sm">
                  {question.label}
                  {question.required && <span className="text-red-500 ml-1">*</span>}
                </Label>

                {question.type === "textarea" && (
                  <textarea
                    value={String(value ?? "")}
                    onChange={(e) => setAnswers((p) => ({ ...p, [question.id]: e.target.value }))}
                    placeholder={question.placeholder ?? ""}
                    rows={4}
                    disabled={!check.ok}
                    className={`mt-1 resize-none ${shared}`}
                  />
                )}

                {question.type === "text" && (
                  <Input
                    value={String(value ?? "")}
                    onChange={(e) => setAnswers((p) => ({ ...p, [question.id]: e.target.value }))}
                    placeholder={question.placeholder ?? ""}
                    disabled={!check.ok}
                    className="mt-1 bg-[#0a0a0a] border-[#1e1e1e]"
                  />
                )}

                {question.type === "select" && (
                  <select
                    value={String(value ?? "")}
                    onChange={(e) => setAnswers((p) => ({ ...p, [question.id]: e.target.value }))}
                    disabled={!check.ok}
                    className={`mt-1 h-9 ${shared}`}
                  >
                    <option value="">Select an option…</option>
                    {questionOptions(question).map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                )}

                {question.type === "checkbox" && (
                  <label className="mt-1 flex items-center gap-2 text-sm text-gray-300">
                    <input
                      type="checkbox"
                      checked={value === true}
                      onChange={(e) => setAnswers((p) => ({ ...p, [question.id]: e.target.checked }))}
                      disabled={!check.ok}
                      className="h-4 w-4 accent-[#dc2626]"
                    />
                    {question.placeholder ?? "Yes"}
                  </label>
                )}
              </div>
            );
          })}

          <Button
            onClick={handleSubmit}
            disabled={submitting || !check.ok || missingRequired}
            className="w-full bg-[#dc2626] text-black hover:bg-[#b91c1c]"
          >
            {submitting ? "Submitting..." : "Submit Application"}
          </Button>
          {missingRequired && check.ok && (
            <p className="text-xs text-gray-600 text-center">
              Answer every question marked * to submit.
            </p>
          )}
        </div>
      </Shell>
    );
  }

  // ---- The list --------------------------------------------------------
  return (
    <Shell>
      <div className="flex items-center gap-2 mb-2">
        <Building2 className="w-5 h-5 text-[#dc2626]" />
        <h1 className="font-[family-name:var(--font-oswald)] text-2xl font-bold text-white uppercase">
          Join a Department
        </h1>
      </div>
      <p className="text-gray-500 text-sm mb-8">
        Pick a department to see its application form. Your name, rank and department are taken from
        your roster entry.
      </p>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : loadError ? (
        <ErrorState title="Failed to load departments" message={loadError} onRetry={load} />
      ) : departments.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          No departments have been set up yet.
        </div>
      ) : (
        <div className="space-y-3">
          {departments.map((dept) => {
            const check = eligibility(dept);
            return (
              <div
                key={dept.id}
                className="bg-[#111111] border border-[#1e1e1e] rounded-xl p-5 flex items-start justify-between gap-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold"
                      style={{
                        color: dept.color,
                        backgroundColor: `${dept.color}1a`,
                        border: `1px solid ${dept.color}33`,
                      }}
                    >
                      {departmentTag(dept)}
                    </span>
                    <span className="text-white font-medium">{dept.name}</span>
                    {dept.joined && (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                        <DepartmentMark role={dept.joinedRole} size={13} color={dept.color} />
                        {dept.joinedRole ?? "Member"}
                      </span>
                    )}
                    {dept.pending && (
                      <span className="inline-flex items-center gap-1 text-xs text-yellow-400">
                        <Clock className="w-3 h-3" /> Pending review
                      </span>
                    )}
                    {!dept.openForApplications && (
                      <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                        <Lock className="w-3 h-3" /> Closed
                      </span>
                    )}
                  </div>
                  {dept.description && (
                    <p className="text-gray-500 text-sm mt-1.5 line-clamp-2">{dept.description}</p>
                  )}
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-600">
                    <span>
                      {dept.minRank ? `${dept.minRank} and above` : "Open to all ranks"}
                    </span>
                    <span>
                      {dept.questions.length} question{dept.questions.length === 1 ? "" : "s"}
                    </span>
                    {dept.documentLink && (
                      <a
                        href={dept.documentLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-red-400 hover:text-red-300"
                      >
                        <ExternalLink className="w-3 h-3" /> Docs
                      </a>
                    )}
                  </div>
                </div>

                <Button
                  onClick={() => openForm(dept)}
                  disabled={!check.ok}
                  title={check.ok ? undefined : check.reason}
                  className="shrink-0 bg-[#dc2626] text-black hover:bg-[#b91c1c]"
                >
                  Apply
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </Shell>
  );
}
