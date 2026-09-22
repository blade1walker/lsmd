"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ErrorState } from "@/components/ui/error-state";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ResultBadge, StatusBadge, ScoreBar, EligibilityBadge } from "@/components/interviews/InterviewUI";
import { fetchJson, errorMessage } from "@/lib/fetch-json";
import {
  CATEGORY_KEYS,
  DEFAULT_PROMOTION_SETTINGS,
  EVALUATION_CATEGORIES,
  FINAL_RESULTS,
  PANEL_ROLES,
  RECOMMENDATIONS,
  categoryFloor,
  evaluateThresholds,
  formatDuration,
  isScoringRole,
  isWaivable,
  scoreColor,
  type CategoryKey,
  type InterviewDetail,
  type InterviewResult,
  type PanelistRecord,
  type PromotionSettingsValues,
} from "@/lib/interviews";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  Gavel,
  History,
  MessageSquarePlus,
  Send,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";

function formatDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—";
}

function formatWhen(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function InterviewSessionPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session } = useSession();
  const myDiscordId = session?.user?.discordId ?? "";
  const permissions = useMemo(() => session?.user?.permissions ?? [], [session]);
  const isSuperAdmin = session?.user?.isSuperAdmin ?? false;
  const can = useCallback(
    (permission: string) => isSuperAdmin || permissions.includes(permission),
    [isSuperAdmin, permissions]
  );

  const [interview, setInterview] = useState<InterviewDetail | null>(null);
  const [settings, setSettings] = useState<PromotionSettingsValues>(DEFAULT_PROMOTION_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [finalizing, setFinalizing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setInterview(await fetchJson<InterviewDetail>(`/api/interviews/${params.id}`));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    fetchJson<PromotionSettingsValues>("/api/interviews/settings")
      .then(setSettings)
      .catch(() => {
        // Scores still render against the documented defaults.
      });
  }, []);

  const mySeat = useMemo(
    () => interview?.panel.find((p) => p.discordId === myDiscordId) ?? null,
    [interview, myDiscordId]
  );

  const isOngoing = interview?.status === "Ongoing";
  const canScore = Boolean(isOngoing && mySeat && isScoringRole(mySeat.role) && can("interviews.score"));
  const canFinalize = Boolean(
    isOngoing && (can("interviews.manage") || (mySeat?.role === "Lead Interviewer" && can("interviews.finalize")))
  );
  const canManagePanel = can("interviews.create") || can("interviews.manage");

  const verdict = useMemo(
    () => (interview ? evaluateThresholds(interview.scores, settings) : null),
    [interview, settings]
  );

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-gray-500">Loading the interview...</div>
      </div>
    );
  }

  if (error || !interview) {
    return (
      <div>
        <BackLink />
        <ErrorState title="Failed to load the interview" message={error ?? "Not found"} onRetry={load} />
      </div>
    );
  }

  const displayScore = interview.finalScore ?? interview.scores.finalScore;

  return (
    <div className="space-y-6">
      <BackLink />

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-[family-name:var(--font-mono)] text-sm text-blue-400">{interview.sessionId}</div>
          <h1 className="mt-1 flex flex-wrap items-center gap-3 font-[family-name:var(--font-oswald)] text-2xl font-bold uppercase text-white">
            <ClipboardCheck className="h-6 w-6 text-[#dc2626]" />
            {interview.memberName}
            <span className="text-base font-normal normal-case text-gray-500">
              {interview.currentRank} → {interview.targetRank}
            </span>
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={interview.status} />
            <ResultBadge result={interview.result} />
            {interview.eligibilityOverride && (
              <span className="inline-flex items-center gap-1 rounded border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider text-amber-400">
                <AlertTriangle className="h-3 w-3" />
                Eligibility overridden
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isOngoing && !mySeat && <JoinButton interviewId={interview.id} onJoined={setInterview} canScore={can("interviews.score")} />}
          {canFinalize && (
            <Button onClick={() => setFinalizing(true)}>
              <Gavel className="mr-2 h-4 w-4" />
              Finalize Result
            </Button>
          )}
          {can("interviews.manage") && !interview.rosterUpdated && (
            <DangerMenu interview={interview} onChanged={setInterview} onDeleted={() => router.push("/admin/interviews")} />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <EmployeeCard interview={interview} canWaive={can("interviews.manage")} onChanged={setInterview} />
          <PanelCard
            interview={interview}
            settings={settings}
            canManage={canManagePanel && isOngoing}
            onChanged={setInterview}
          />
          {canScore && mySeat && (
            <EvaluationForm interviewId={interview.id} seat={mySeat} settings={settings} onSaved={setInterview} />
          )}
          <SubmissionsCard interview={interview} settings={settings} />
          <NotesCard interview={interview} canAdd={Boolean(isOngoing && (mySeat || canManagePanel))} onAdded={setInterview} />
        </div>

        <div className="space-y-6">
          <ResultCard interview={interview} settings={settings} score={displayScore} verdict={verdict} />
          <TrainingCheckCard interview={interview} canVerify={canFinalize} onChanged={setInterview} />
          {(interview.result === "Failed" || interview.improvementNotes) && (
            <ImprovementCard interview={interview} canEdit={canFinalize || can("interviews.manage")} onChanged={setInterview} />
          )}
          <HistoryCard interview={interview} />
        </div>
      </div>

      {finalizing && verdict && (
        <FinalizeDialog
          interview={interview}
          settings={settings}
          verdict={verdict}
          onClose={() => setFinalizing(false)}
          onFinalized={(updated) => {
            setFinalizing(false);
            setInterview(updated);
          }}
        />
      )}
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/admin/interviews" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white">
      <ArrowLeft className="h-4 w-4" />
      Promotion &amp; Interview
    </Link>
  );
}

function Card({
  title,
  icon: Icon,
  action,
  children,
}: {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-[#1e1e1e] bg-[#111111]">
      <header className="flex items-center justify-between gap-3 border-b border-[#1e1e1e] px-5 py-3">
        <h2 className="flex items-center gap-2 font-[family-name:var(--font-oswald)] text-sm font-semibold uppercase tracking-wider text-white">
          {Icon && <Icon className="h-4 w-4 text-gray-500" />}
          {title}
        </h2>
        {action}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Employee
 * ------------------------------------------------------------------ */

function EmployeeCard({
  interview,
  canWaive,
  onChanged,
}: {
  interview: InterviewDetail;
  canWaive: boolean;
  onChanged: (interview: InterviewDetail) => void;
}) {
  const candidate = interview.candidate;
  // Live figures while the session is open; the snapshot taken at creation once
  // it is finalized, so a closed record does not keep counting upward.
  const rankSince = interview.status === "Ongoing" ? (candidate?.rankSince ?? interview.rankSince) : interview.rankSince;
  const joined = candidate?.joinedEmsAt ?? interview.joinedEmsAt;
  const asOf = interview.finalizedAt ?? undefined;

  return (
    <Card title="Employee Information" icon={Users}>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-3">
        <Detail label="EMS Employee" value={interview.memberName} sub={interview.callSign ?? undefined} />
        <Detail label="Current Rank" value={candidate?.rank ?? interview.currentRank} />
        <Detail label="Target Rank" value={interview.targetRank} highlight />
        <Detail label="Time in Current Rank" value={formatDuration(rankSince, asOf)} sub={formatDate(rankSince)} />
        <Detail label="EMS Joining Date" value={formatDate(joined)} />
        <Detail label="Total EMS Tenure" value={formatDuration(joined, asOf)} />
        {candidate && (
          <>
            <Detail label="Roster status" value={candidate.activity} />
            <Detail label="Training completion" value={`${candidate.trainingPercent}%`} />
            <Detail label="Departments" value={candidate.departments.join(", ") || "None"} />
          </>
        )}
      </dl>

      <EligibilityPanel interview={interview} canWaive={canWaive} onChanged={onChanged} />
    </Card>
  );
}

/**
 * Promotion eligibility as it stands now, falling back to the verdict recorded
 * at creation once the session is finalized.
 *
 * Re-checked live rather than shown only as the creation-time snapshot: a
 * candidate who was two days short when the session was opened has usually met
 * the requirement by the time the panel sits, and a stale "Not Yet Eligible" is
 * worse than none. The original verdict stays available underneath, because it
 * is what the decision to open the session was made on.
 *
 * A requirement can also be waived for this candidate in particular, which
 * changes nothing department-wide — the thresholds stay where the settings put
 * them, and the exception is recorded on the session with who made it and why.
 */
function EligibilityPanel({
  interview,
  canWaive,
  onChanged,
}: {
  interview: InterviewDetail;
  canWaive: boolean;
  onChanged: (interview: InterviewDetail) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [waiving, setWaiving] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [showOriginal, setShowOriginal] = useState(false);

  const live = interview.liveEligibility;
  const verdict = live ?? interview.eligibility;
  if (!verdict) return null;

  async function send(body: Record<string, unknown>, label: string) {
    setBusy(label);
    try {
      onChanged(
        await fetchJson<InterviewDetail>(`/api/interviews/${interview.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
      );
      setWaiving(null);
      setReason("");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-5 border-t border-[#1e1e1e] pt-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <EligibilityBadge eligible={verdict.eligible} />
        <span className="text-xs text-gray-600">
          {live
            ? "checked against today's roster and the current requirements"
            : "as checked when the session was created"}
        </span>
      </div>

      <ul className="grid grid-cols-1 gap-1.5 text-sm sm:grid-cols-2">
        {verdict.checks.map((check) => (
          <li key={check.label}>
            <div className="flex items-start gap-2">
              <span className={check.waiver ? "text-amber-400" : check.ok ? "text-emerald-400" : "text-red-400"}>
                {check.waiver ? "!" : check.ok ? "✓" : "✕"}
              </span>
              <span className="flex-1 text-gray-400">
                <span className="text-gray-300">{check.label}</span> — {check.detail}
                {check.waiver && (
                  <span className="block text-xs text-amber-400">
                    Waived by {check.waiver.waivedBy}
                    {check.waiver.reason ? ` — ${check.waiver.reason}` : ""}
                  </span>
                )}
              </span>
              {canWaive &&
                live &&
                (check.waiver ? (
                  <button
                    type="button"
                    disabled={busy === check.label}
                    onClick={() => send({ unwaive: check.label }, check.label)}
                    className="shrink-0 text-xs text-gray-500 hover:text-white disabled:opacity-50"
                  >
                    Restore
                  </button>
                ) : !check.ok && isWaivable(check.label) ? (
                  <button
                    type="button"
                    onClick={() => {
                      setWaiving(waiving === check.label ? null : check.label);
                      setReason("");
                    }}
                    className="shrink-0 text-xs text-amber-400 hover:text-amber-300"
                  >
                    Waive
                  </button>
                ) : null)}
            </div>

            {waiving === check.label && (
              <div className="ml-5 mt-1.5 rounded-md border border-[#1e1e28] bg-[#0a0a0f] p-2">
                <Input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Why is this requirement being set aside?"
                  className="h-8 text-xs"
                />
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-gray-600">Applies to this interview only.</span>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setWaiving(null)}>
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      disabled={busy === check.label}
                      onClick={() => send({ waive: { label: check.label, reason } }, check.label)}
                    >
                      Waive
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>

      {live && interview.eligibility && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowOriginal(!showOriginal)}
            className="text-xs text-gray-600 hover:text-gray-400"
          >
            {showOriginal ? "Hide" : "Show"} the check made when the session was created
          </button>
          {showOriginal && (
            <ul className="mt-2 grid grid-cols-1 gap-1 text-xs sm:grid-cols-2">
              {interview.eligibility.checks.map((check) => (
                <li key={check.label} className="flex items-start gap-2">
                  <span className={check.ok ? "text-emerald-400/70" : "text-red-400/70"}>
                    {check.ok ? "✓" : "✕"}
                  </span>
                  <span className="text-gray-600">
                    {check.label} — {check.detail}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function Detail({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wider text-gray-500">{label}</dt>
      <dd className={`mt-0.5 ${highlight ? "font-semibold text-[#dc2626]" : "text-gray-200"}`}>{value}</dd>
      {sub && <dd className="text-xs text-gray-600">{sub}</dd>}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Panel
 * ------------------------------------------------------------------ */

function PanelCard({
  interview,
  settings,
  canManage,
  onChanged,
}: {
  interview: InterviewDetail;
  settings: PromotionSettingsValues;
  canManage: boolean;
  onChanged: (interview: InterviewDetail) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);

  async function changeRole(panelistId: string, role: string) {
    setBusy(panelistId);
    try {
      onChanged(
        await fetchJson<InterviewDetail>(`/api/interviews/${interview.id}/panel`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ panelistId, role }),
        })
      );
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function remove(panelistId: string) {
    setBusy(panelistId);
    try {
      onChanged(
        await fetchJson<InterviewDetail>(`/api/interviews/${interview.id}/panel?panelistId=${panelistId}`, {
          method: "DELETE",
        })
      );
      toast.success("Removed from the panel");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card
      title="Interview Panel"
      icon={Users}
      action={
        <span className="text-xs text-gray-500">
          {interview.scores.submitted} of {interview.scores.expected} evaluations submitted
        </span>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] text-sm">
          <thead>
            <tr className="border-b border-[#1e1e1e] text-left text-[11px] uppercase tracking-wider text-gray-500">
              <th className="py-2 pr-3 font-medium">Interviewer</th>
              <th className="py-2 pr-3 font-medium">Current Rank</th>
              <th className="py-2 pr-3 font-medium">Role</th>
              <th className="py-2 pr-3 font-medium">Score</th>
              <th className="py-2 pr-3 font-medium">Status</th>
              <th className="py-2 pr-3 font-medium">Submitted</th>
              {canManage && <th className="py-2 font-medium" />}
            </tr>
          </thead>
          <tbody>
            {interview.panel.map((p) => (
              <tr key={p.id} className="border-b border-[#1e1e1e]/50">
                <td className="py-2.5 pr-3 text-white">{p.name}</td>
                <td className="py-2.5 pr-3 text-gray-400">{p.rank ?? "—"}</td>
                <td className="py-2.5 pr-3">
                  {canManage ? (
                    <select
                      value={p.role}
                      disabled={busy === p.id}
                      onChange={(e) => changeRole(p.id, e.target.value)}
                      className="h-7 rounded border border-[#1e1e28] bg-[#0a0a0a] px-1.5 text-xs text-white disabled:opacity-50"
                      style={{ colorScheme: "dark" }}
                    >
                      {PANEL_ROLES.map((r) => (
                        <option key={r.key} value={r.key}>
                          {r.key}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-gray-400">{p.role}</span>
                  )}
                </td>
                <td className="py-2.5 pr-3">
                  {!isScoringRole(p.role) ? (
                    <span className="text-xs text-gray-600">Observer</span>
                  ) : p.individualScore === null ? (
                    <span className="text-xs text-gray-500">Pending</span>
                  ) : (
                    <span
                      className={`font-[family-name:var(--font-oswald)] font-bold ${scoreColor(
                        p.individualScore,
                        settings.passingScore
                      )}`}
                    >
                      {p.individualScore}/100
                    </span>
                  )}
                </td>
                <td className="py-2.5 pr-3">
                  {p.submittedAt ? (
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                      <CheckCircle2 className="h-3 w-3" />
                      Submitted
                    </span>
                  ) : (
                    <span className="text-xs text-amber-400">Pending</span>
                  )}
                </td>
                <td className="py-2.5 pr-3 text-xs text-gray-500">{formatWhen(p.submittedAt)}</td>
                {canManage && (
                  <td className="py-2.5 text-right">
                    {!p.submittedAt && (
                      <button
                        type="button"
                        disabled={busy === p.id}
                        onClick={() => remove(p.id)}
                        className="p-1 text-gray-600 hover:text-red-400 disabled:opacity-50"
                        title="Remove from the panel"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function JoinButton({
  interviewId,
  onJoined,
  canScore,
}: {
  interviewId: string;
  onJoined: (interview: InterviewDetail) => void;
  canScore: boolean;
}) {
  const [busy, setBusy] = useState(false);

  async function join(role: string) {
    setBusy(true);
    try {
      onJoined(
        await fetchJson<InterviewDetail>(`/api/interviews/${interviewId}/panel`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role }),
        })
      );
      toast.success(`Joined as ${role}`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant="outline" size="sm" disabled={busy} onClick={() => join(canScore ? "Interviewer" : "Observer")}>
      <UserPlus className="mr-2 h-4 w-4" />
      {busy ? "Joining..." : canScore ? "Join as Interviewer" : "Join as Observer"}
    </Button>
  );
}

/* ------------------------------------------------------------------ *
 * Evaluation
 * ------------------------------------------------------------------ */

type ScoreState = Record<CategoryKey, string>;
type NoteState = Record<CategoryKey, string>;

function EvaluationForm({
  interviewId,
  seat,
  settings,
  onSaved,
}: {
  interviewId: string;
  seat: PanelistRecord;
  settings: PromotionSettingsValues;
  onSaved: (interview: InterviewDetail) => void;
}) {
  const [scores, setScores] = useState<ScoreState>(() => ({
    sop: seat.sopScore?.toString() ?? "",
    medical: seat.medicalScore?.toString() ?? "",
    situation: seat.situationScore?.toString() ?? "",
    overall: seat.overallScore?.toString() ?? "",
  }));
  const [notes, setNotes] = useState<NoteState>(() => ({
    sop: seat.sopNotes ?? "",
    medical: seat.medicalNotes ?? "",
    situation: seat.situationNotes ?? "",
    overall: seat.overallNotes ?? "",
  }));
  const [recommendation, setRecommendation] = useState(seat.recommendation ?? "");
  const [busy, setBusy] = useState(false);

  const numbers = CATEGORY_KEYS.map((k) => (scores[k] === "" ? null : Number(scores[k])));
  const complete = numbers.every((n) => n !== null && Number.isInteger(n) && n >= 0 && n <= 100);
  const myAverage = complete
    ? Math.round((numbers as number[]).reduce((a, b) => a + b, 0) / numbers.length)
    : null;

  async function save(submit: boolean) {
    setBusy(true);
    try {
      const payload: Record<string, unknown> = { submit, recommendation: recommendation || null };
      for (const key of CATEGORY_KEYS) {
        payload[`${key}Score`] = scores[key] === "" ? null : Number(scores[key]);
        payload[`${key}Notes`] = notes[key];
      }
      onSaved(
        await fetchJson<InterviewDetail>(`/api/interviews/${interviewId}/evaluation`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      );
      toast.success(submit ? "Evaluation submitted" : "Draft saved");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      title={seat.submittedAt ? "Your Evaluation (submitted)" : "Your Evaluation"}
      icon={ClipboardCheck}
      action={
        myAverage !== null && (
          <span className={`font-[family-name:var(--font-oswald)] text-lg font-bold ${scoreColor(myAverage, settings.passingScore)}`}>
            {myAverage}/100
          </span>
        )
      }
    >
      <div className="space-y-6">
        {EVALUATION_CATEGORIES.map((category) => {
          const floor = categoryFloor(settings, category.key);
          const value = scores[category.key];
          const parsed = value === "" ? null : Number(value);
          return (
            <div key={category.key}>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-white">{category.label}</h3>
                  <p className="mt-0.5 text-xs leading-relaxed text-gray-600">{category.covers.join(" · ")}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={value}
                    onChange={(e) => setScores({ ...scores, [category.key]: e.target.value })}
                    className="h-9 w-20 text-center"
                    placeholder="0-100"
                  />
                  <span className="text-xs text-gray-600">min {floor}%</span>
                </div>
              </div>
              <ScoreBar score={parsed} passingScore={settings.passingScore} floor={floor} />
              <Textarea
                value={notes[category.key]}
                onChange={(e) => setNotes({ ...notes, [category.key]: e.target.value })}
                placeholder={`Interviewer notes on ${category.label.toLowerCase()}...`}
                className="mt-2 min-h-[64px] text-sm"
              />
            </div>
          );
        })}

        <div>
          <label className="mb-1 block text-[11px] uppercase tracking-wider text-gray-500">
            Promotion Recommendation
          </label>
          <select
            value={recommendation}
            onChange={(e) => setRecommendation(e.target.value)}
            className="h-9 w-full rounded-md border border-[#1e1e28] bg-[#0a0a0a] px-3 text-sm text-white sm:w-72"
            style={{ colorScheme: "dark" }}
          >
            <option value="">No recommendation</option>
            {RECOMMENDATIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-600">
            Recorded as part of the interview. It does not replace the finalized result.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[#1e1e1e] pt-4">
          <Button variant="ghost" disabled={busy} onClick={() => save(false)}>
            Save draft
          </Button>
          <Button disabled={busy || !complete} onClick={() => save(true)}>
            <Send className="mr-2 h-4 w-4" />
            {seat.submittedAt ? "Resubmit evaluation" : "Submit evaluation"}
          </Button>
        </div>
        {!complete && (
          <p className="text-right text-xs text-gray-600">Score all four categories to submit.</p>
        )}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ *
 * Submitted evaluations
 * ------------------------------------------------------------------ */

function SubmissionsCard({
  interview,
  settings,
}: {
  interview: InterviewDetail;
  settings: PromotionSettingsValues;
}) {
  const submitted = interview.panel.filter((p) => p.submittedAt && isScoringRole(p.role));
  const [open, setOpen] = useState<string | null>(null);

  if (submitted.length === 0) {
    return (
      <Card title="Submitted Evaluations" icon={ClipboardCheck}>
        <p className="text-sm text-gray-500">No interviewer has submitted an evaluation yet.</p>
      </Card>
    );
  }

  return (
    <Card title="Submitted Evaluations" icon={ClipboardCheck}>
      <div className="space-y-2">
        {submitted.map((p) => {
          const isOpen = open === p.id;
          return (
            <div key={p.id} className="rounded-lg border border-[#1e1e28]">
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : p.id)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
              >
                <span>
                  <span className="text-white">{p.name}</span>
                  <span className="ml-2 text-xs text-gray-500">
                    {p.role}
                    {p.rank ? ` · ${p.rank}` : ""}
                  </span>
                </span>
                <span className="flex items-center gap-3">
                  {p.recommendation && <span className="text-xs text-gray-500">{p.recommendation}</span>}
                  <span
                    className={`font-[family-name:var(--font-oswald)] font-bold ${scoreColor(
                      p.individualScore,
                      settings.passingScore
                    )}`}
                  >
                    {p.individualScore}/100
                  </span>
                </span>
              </button>
              {isOpen && (
                <div className="space-y-4 border-t border-[#1e1e28] px-4 py-4">
                  {EVALUATION_CATEGORIES.map((category) => {
                    const score = p[`${category.key}Score`];
                    const note = p[`${category.key}Notes`];
                    return (
                      <div key={category.key}>
                        <ScoreBar
                          label={category.label}
                          score={score}
                          passingScore={settings.passingScore}
                          floor={categoryFloor(settings, category.key)}
                        />
                        {note && <p className="mt-1.5 whitespace-pre-wrap text-sm text-gray-400">{note}</p>}
                      </div>
                    );
                  })}
                  <p className="text-xs text-gray-600">Submitted {formatWhen(p.submittedAt)}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ *
 * Notes
 * ------------------------------------------------------------------ */

function NotesCard({
  interview,
  canAdd,
  onAdded,
}: {
  interview: InterviewDetail;
  canAdd: boolean;
  onAdded: (interview: InterviewDetail) => void;
}) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!body.trim()) return;
    setBusy(true);
    try {
      onAdded(
        await fetchJson<InterviewDetail>(`/api/interviews/${interview.id}/notes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body }),
        })
      );
      setBody("");
      toast.success("Note added");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="General Notes" icon={MessageSquarePlus}>
      {interview.notes.length === 0 ? (
        <p className="text-sm text-gray-500">
          No general notes yet. Strengths, weaknesses, incidents discussed and concerns about the promotion go here.
        </p>
      ) : (
        <ul className="space-y-3">
          {interview.notes.map((note) => (
            <li key={note.id} className="rounded-lg border border-[#1e1e28] bg-[#0a0a0f] p-3">
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium text-white">{note.authorName}</span>
                <span className="text-xs text-gray-600">{formatWhen(note.createdAt)}</span>
              </div>
              <p className="whitespace-pre-wrap text-sm text-gray-300">{note.body}</p>
            </li>
          ))}
        </ul>
      )}

      {canAdd && (
        <div className="mt-4 border-t border-[#1e1e1e] pt-4">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Strengths, weaknesses, areas to improve, incidents discussed, concerns..."
            className="min-h-[80px] text-sm"
          />
          <div className="mt-2 flex justify-end">
            <Button size="sm" disabled={busy || !body.trim()} onClick={add}>
              Add note
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ *
 * Result
 * ------------------------------------------------------------------ */

function ResultCard({
  interview,
  settings,
  score,
  verdict,
}: {
  interview: InterviewDetail;
  settings: PromotionSettingsValues;
  score: number | null;
  verdict: ReturnType<typeof evaluateThresholds> | null;
}) {
  const categories = interview.categoryScores ?? interview.scores.categories;

  return (
    <Card title="Final Result" icon={Gavel}>
      <div className="mb-4 text-center">
        <div
          className={`font-[family-name:var(--font-oswald)] text-5xl font-bold ${scoreColor(score, settings.passingScore)}`}
        >
          {score === null ? "—" : `${score}`}
          <span className="text-2xl text-gray-600">/100</span>
        </div>
        <div className="mt-2">
          <ResultBadge result={interview.result} className="text-sm" />
        </div>
        <p className="mt-2 text-xs text-gray-600">
          {interview.status === "Finalized"
            ? `Finalized by ${interview.finalizedByName ?? "—"} on ${formatDate(interview.finalizedAt)}`
            : `Passing score ${settings.passingScore}% · ${interview.scores.submitted} of ${interview.scores.expected} submitted`}
        </p>
      </div>

      <div className="space-y-3">
        {EVALUATION_CATEGORIES.map((category) => (
          <ScoreBar
            key={category.key}
            label={category.label}
            score={categories[category.key] ?? null}
            passingScore={settings.passingScore}
            floor={categoryFloor(settings, category.key)}
          />
        ))}
      </div>

      {verdict && interview.status === "Ongoing" && verdict.failures.length > 0 && (
        <ul className="mt-4 space-y-1 border-t border-[#1e1e1e] pt-3 text-xs text-amber-400">
          {verdict.failures.map((f) => (
            <li key={f}>• {f}</li>
          ))}
        </ul>
      )}

      {interview.status === "Finalized" && (
        <div className="mt-4 space-y-2 border-t border-[#1e1e1e] pt-3 text-xs">
          <Row
            label="Roster updated"
            value={interview.rosterUpdated ? `${interview.currentRank} → ${interview.targetRank}` : "No"}
            tone={interview.rosterUpdated ? "text-emerald-400" : "text-gray-500"}
          />
          {interview.announcementStatus && (
            <Row
              label="Announcement"
              value={interview.announcementStatus}
              tone={interview.announcementStatus === "Sent" ? "text-emerald-400" : "text-amber-400"}
            />
          )}
          {interview.announcementDetail && interview.announcementStatus !== "Sent" && (
            <p className="text-gray-500">{interview.announcementDetail}</p>
          )}
          {interview.cooldownUntil && (
            <Row label="Reattempt available" value={formatDate(interview.cooldownUntil)} tone="text-amber-400" />
          )}
        </div>
      )}
    </Card>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-gray-500">{label}</span>
      <span className={tone ?? "text-gray-300"}>{value}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Training check, improvement notes, history
 * ------------------------------------------------------------------ */

function TrainingCheckCard({
  interview,
  canVerify,
  onChanged,
}: {
  interview: InterviewDetail;
  canVerify: boolean;
  onChanged: (interview: InterviewDetail) => void;
}) {
  const [busy, setBusy] = useState(false);

  async function toggle(value: boolean) {
    setBusy(true);
    try {
      onChanged(
        await fetchJson<InterviewDetail>(`/api/interviews/${interview.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trainingVerified: value }),
        })
      );
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Required Training" icon={ShieldCheck}>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={interview.trainingVerified}
          disabled={!canVerify || busy || interview.status !== "Ongoing"}
          onChange={(e) => toggle(e.target.checked)}
          className="mt-0.5 accent-red-600 disabled:opacity-50"
        />
        <span className="text-gray-300">
          Required training and certifications verified for {interview.targetRank}
        </span>
      </label>
      {interview.trainingVerified && (
        <p className="mt-2 text-xs text-gray-600">
          Verified by {interview.trainingVerifiedBy ?? "—"} on {formatDate(interview.trainingVerifiedAt)}
        </p>
      )}
    </Card>
  );
}

function ImprovementCard({
  interview,
  canEdit,
  onChanged,
}: {
  interview: InterviewDetail;
  canEdit: boolean;
  onChanged: (interview: InterviewDetail) => void;
}) {
  const [value, setValue] = useState(interview.improvementNotes ?? "");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      onChanged(
        await fetchJson<InterviewDetail>(`/api/interviews/${interview.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ improvementNotes: value }),
        })
      );
      toast.success("Recommendations saved");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Improvement Recommendations" icon={MessageSquarePlus}>
      {canEdit ? (
        <>
          <Textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="What this employee should work on before reattempting..."
            className="min-h-[90px] text-sm"
          />
          <div className="mt-2 flex justify-end">
            <Button size="sm" disabled={busy} onClick={save}>
              Save
            </Button>
          </div>
        </>
      ) : interview.improvementNotes ? (
        <p className="whitespace-pre-wrap text-sm text-gray-300">{interview.improvementNotes}</p>
      ) : (
        <p className="text-sm text-gray-500">No recommendations recorded.</p>
      )}
    </Card>
  );
}

function HistoryCard({ interview }: { interview: InterviewDetail }) {
  return (
    <Card title="Interview History" icon={History}>
      {interview.attempts.length === 0 ? (
        <p className="text-sm text-gray-500">This is {interview.memberName}&apos;s first promotion interview.</p>
      ) : (
        <ul className="space-y-2">
          {interview.attempts.map((a) => (
            <li key={a.id}>
              <Link
                href={`/admin/interviews/${a.id}`}
                className="flex items-center justify-between gap-2 rounded-lg border border-[#1e1e28] px-3 py-2 text-sm transition-colors hover:bg-white/5"
              >
                <span>
                  <span className="font-[family-name:var(--font-mono)] text-xs text-blue-400">{a.sessionId}</span>
                  <span className="ml-2 text-gray-400">{a.targetRank}</span>
                </span>
                <span className="flex items-center gap-2">
                  {a.finalScore !== null && <span className="text-xs text-gray-500">{a.finalScore}%</span>}
                  <ResultBadge result={a.result} />
                </span>
              </Link>
              <div className="px-3 pt-0.5 text-[11px] text-gray-600">{formatDate(a.createdAt)}</div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ *
 * Finalize
 * ------------------------------------------------------------------ */

function FinalizeDialog({
  interview,
  settings,
  verdict,
  onClose,
  onFinalized,
}: {
  interview: InterviewDetail;
  settings: PromotionSettingsValues;
  verdict: ReturnType<typeof evaluateThresholds>;
  onClose: () => void;
  onFinalized: (interview: InterviewDetail) => void;
}) {
  const [result, setResult] = useState<InterviewResult>(
    verdict.suggested === "Pending" ? "Review Required" : verdict.suggested
  );
  const [busy, setBusy] = useState(false);

  const blockers: string[] = [];
  if (interview.scores.submitted === 0) blockers.push("No interviewer has submitted an evaluation yet.");
  if (settings.requireTrainingCheck && !interview.trainingVerified) {
    blockers.push("Required training and certifications have not been verified.");
  }

  // A warning, not a blocker: eligibility is advisory, and a Lead may still
  // record a Failed or Review Required result for someone who never qualified.
  const outstanding = interview.liveEligibility?.reasons ?? [];

  async function finalize() {
    setBusy(true);
    try {
      const updated = await fetchJson<InterviewDetail>(`/api/interviews/${interview.id}/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ result }),
      });
      toast.success(
        result === "Passed" && updated.rosterUpdated
          ? `${interview.memberName} promoted to ${interview.targetRank}`
          : `Interview finalized as ${result}`
      );
      onFinalized(updated);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Finalize {interview.sessionId}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-gray-400">
            Are you sure you want to finalize this interview? Once finalized, the result may update the employee&apos;s
            EMS roster rank and generate a promotion announcement.
          </p>

          <div className="rounded-lg border border-[#1e1e28] bg-[#0a0a0f] p-3 text-sm">
            <Row label="Candidate" value={`${interview.memberName} · ${interview.currentRank}`} />
            <Row label="Target rank" value={interview.targetRank} />
            <Row
              label="Panel score"
              value={interview.scores.finalScore === null ? "—" : `${interview.scores.finalScore}%`}
            />
            <Row label="Evaluations" value={`${interview.scores.submitted} of ${interview.scores.expected}`} />
            <Row label="Thresholds say" value={verdict.suggested} />
          </div>

          {verdict.failures.length > 0 && (
            <ul className="space-y-1 text-xs text-amber-400">
              {verdict.failures.map((f) => (
                <li key={f}>• {f}</li>
              ))}
            </ul>
          )}

          <div>
            <label className="mb-1 block text-[11px] uppercase tracking-wider text-gray-500">Result</label>
            <div className="flex flex-wrap gap-2">
              {FINAL_RESULTS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setResult(r)}
                  className={`rounded-md border px-3 py-1.5 text-sm ${
                    result === r
                      ? "border-[#dc2626] bg-[#dc2626]/10 text-[#dc2626]"
                      : "border-[#1e1e28] text-gray-400 hover:text-gray-200"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {result === "Passed" && (
            <p className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-emerald-400">
              {interview.memberName} will be promoted to {interview.targetRank} on the roster, their time-in-rank
              counter reset, a permanent Promotion History entry written and the promotion announcement posted.
            </p>
          )}
          {result === "Failed" && settings.cooldownDays > 0 && (
            <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-400">
              Their rank is left unchanged and a new interview cannot be created for {settings.cooldownDays} days.
            </p>
          )}

          {result === "Passed" && outstanding.length > 0 && (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-400">
              <p className="mb-1 font-semibold">This candidate still does not meet every promotion requirement:</p>
              <ul className="space-y-0.5">
                {outstanding.map((r) => (
                  <li key={r}>• {r}</li>
                ))}
              </ul>
              <p className="mt-1 text-amber-400/70">
                Waive a requirement on the employee panel if the exception is intended.
              </p>
            </div>
          )}

          {blockers.length > 0 && (
            <ul className="space-y-1 text-xs text-red-400">
              {blockers.map((b) => (
                <li key={b}>• {b}</li>
              ))}
            </ul>
          )}

          <div className="flex justify-end gap-2 border-t border-[#1e1e28] pt-4">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button disabled={busy || blockers.length > 0} onClick={finalize}>
              {busy ? "Finalizing..." : `Finalize as ${result}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ *
 * Cancel / delete
 * ------------------------------------------------------------------ */

function DangerMenu({
  interview,
  onChanged,
  onDeleted,
}: {
  interview: InterviewDetail;
  onChanged: (interview: InterviewDetail) => void;
  onDeleted: () => void;
}) {
  const [confirming, setConfirming] = useState<"cancel" | "delete" | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      if (confirming === "cancel") {
        onChanged(
          await fetchJson<InterviewDetail>(`/api/interviews/${interview.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cancel: true }),
          })
        );
        toast.success("Interview cancelled");
      } else {
        await fetchJson(`/api/interviews/${interview.id}`, { method: "DELETE" });
        toast.success("Interview deleted");
        onDeleted();
      }
      setConfirming(null);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {interview.status === "Ongoing" && (
        <Button variant="outline" size="sm" onClick={() => setConfirming("cancel")}>
          Cancel session
        </Button>
      )}
      <Button variant="ghost" size="sm" onClick={() => setConfirming("delete")} title="Delete this interview">
        <Trash2 className="h-4 w-4 text-gray-500" />
      </Button>

      <Dialog open={confirming !== null} onOpenChange={(open) => !open && setConfirming(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {confirming === "cancel" ? "Cancel this interview?" : "Delete this interview?"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-400">
            {confirming === "cancel"
              ? "The session is closed without a result. Every score and note submitted so far is kept."
              : "The whole examination record is removed, including every score and note. A copy is kept in Restore for 7 days."}
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirming(null)}>
              Keep it
            </Button>
            <Button variant="destructive" disabled={busy} onClick={run}>
              {busy ? "Working..." : confirming === "cancel" ? "Cancel session" : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
