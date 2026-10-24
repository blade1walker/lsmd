"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useSession, signIn } from "next-auth/react";
import { AlertTriangle, CheckCircle, Clock, Timer, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { TestShell } from "@/components/tests/TestShell";
import { QuestionInput } from "@/components/tests/QuestionInput";
import { AnswerReview } from "@/components/tests/AttemptGrader";
import { fetchJson, errorMessage, ApiError } from "@/lib/fetch-json";
import { isAnswered, type Answers, type PublicQuestion, type TestQuestion } from "@/lib/tests";
import { toast } from "sonner";

interface PastAttempt {
  id: string;
  status: string;
  submittedAt: string | null;
  score: number | null;
  passed: boolean | null;
  earned: number | null;
  total: number;
  feedback: string | null;
  review: (TestQuestion & { answer: string | string[] | null; awarded: number | null; comment: string | null })[] | null;
}

interface TestView {
  id: string;
  title: string;
  description: string | null;
  instructions: string | null;
  status: string;
  passingScore: number;
  timeLimitMinutes: number | null;
  maxAttempts: number | null;
  questionCount: number;
  totalPoints: number;
  showResults: boolean;
  attemptsUsed: number;
  current: { id: string; startedAt: string; questions: PublicQuestion[]; answers: Answers } | null;
  attempts: PastAttempt[];
}

function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

export default function TakeTestPage() {
  const { id } = useParams<{ id: string }>();
  const { status } = useSession();
  const [test, setTest] = useState<TestView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [missing, setMissing] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [reviewing, setReviewing] = useState<string | null>(null);
  const savedRef = useRef<string>("");
  const submittingRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const t = await fetchJson<TestView>(`/api/tests/${id}`);
      setTest(t);
      if (t.current) {
        setAnswers(t.current.answers);
        savedRef.current = JSON.stringify(t.current.answers);
      }
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [id]);

  useEffect(() => {
    if (status === "authenticated") load();
  }, [status, load]);

  const current = test?.current ?? null;
  const deadline =
    current && test?.timeLimitMinutes ? Date.parse(current.startedAt) + test.timeLimitMinutes * 60_000 : null;
  const remaining = deadline ? (deadline - now) / 1000 : null;

  // Tick once a second while the clock matters.
  useEffect(() => {
    if (!deadline) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [deadline]);

  // Autosave a moment after the member stops typing, so a closed tab loses nothing.
  useEffect(() => {
    if (!current) return;
    const body = JSON.stringify(answers);
    if (body === savedRef.current) return;
    const timer = setTimeout(async () => {
      try {
        await fetchJson(`/api/tests/${id}/submit`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ attemptId: current.id, answers }),
        });
        savedRef.current = body;
      } catch {
        // Autosave is a safety net; the submit carries the answers regardless.
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [answers, current, id]);

  const start = async () => {
    setBusy(true);
    try {
      await fetchJson(`/api/tests/${id}`, { method: "POST" });
      setAnswers({});
      savedRef.current = "{}";
      setNow(Date.now());
      await load();
      window.scrollTo({ top: 0 });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const submit = useCallback(
    async (timedOut = false) => {
      if (!current || submittingRef.current) return;
      if (!timedOut) {
        const unanswered = current.questions.filter((q) => !isAnswered(answers[q.id]));
        const required = unanswered.filter((q) => q.required);
        if (required.length) {
          setMissing(new Set(required.map((q) => q.id)));
          document.getElementById(`tq-${required[0].id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
          toast.error(`Answer every required question first (${required.length} left)`);
          return;
        }
        if (!confirm(unanswered.length ? `Submit with ${unanswered.length} question${unanswered.length === 1 ? "" : "s"} unanswered?` : "Submit your answers? You cannot change them afterwards.")) return;
      }
      submittingRef.current = true;
      setBusy(true);
      try {
        await fetchJson(`/api/tests/${id}/submit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ attemptId: current.id, answers }),
        });
        if (timedOut) toast.warning("Time is up — your answers were handed in");
        setMissing(new Set());
        await load();
        window.scrollTo({ top: 0 });
      } catch (err) {
        if (err instanceof ApiError && err.status === 409) await load();
        toast.error(errorMessage(err));
      } finally {
        submittingRef.current = false;
        setBusy(false);
      }
    },
    [answers, current, id, load]
  );

  // The clock running out hands the paper in as it stands — once per attempt,
  // so a failed request does not retry every tick. The server closes it on
  // the autosaved answers if this never gets through.
  const autoSubmitted = useRef<string | null>(null);
  useEffect(() => {
    if (remaining === null || remaining > 0 || !current || autoSubmitted.current === current.id) return;
    autoSubmitted.current = current.id;
    submit(true);
  }, [remaining, current, submit]);

  if (status === "unauthenticated") {
    return (
      <TestShell back="/tests">
        <div className="py-16 text-center">
          <p className="mb-6 text-gray-400">Sign in with Discord to take this test.</p>
          <Button onClick={() => signIn("discord")} className="bg-[#5865F2] hover:bg-[#4752C4]">
            Sign in with Discord
          </Button>
        </div>
      </TestShell>
    );
  }
  if (error && !test) {
    return (
      <TestShell back="/tests">
        <ErrorState title="Could not open this test" message={error} onRetry={load} />
      </TestShell>
    );
  }
  if (!test) {
    return (
      <TestShell back="/tests">
        <Skeleton className="mb-4 h-10 w-2/3" />
        <Skeleton className="h-64 w-full" />
      </TestShell>
    );
  }

  // ─── Taking the test ───────────────────────────────────────────────────
  if (current) {
    const answered = current.questions.filter((q) => isAnswered(answers[q.id])).length;
    const low = remaining !== null && remaining < 60;
    return (
      <TestShell back="/tests">
        <div className="sticky top-0 z-20 -mx-4 mb-6 border-b border-[#1e1e1e] bg-[#0a0a0a]/95 px-4 py-3 backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <p className="truncate font-semibold text-white">{test.title}</p>
            <div className="flex items-center gap-4 text-sm">
              <span className="text-gray-400">
                {answered}/{current.questions.length} answered
              </span>
              {remaining !== null && (
                <span className={`inline-flex items-center gap-1 font-[family-name:var(--font-mono)] font-bold ${low ? "animate-pulse text-red-400" : "text-white"}`}>
                  <Timer className="h-4 w-4" />
                  {formatClock(remaining)}
                </span>
              )}
            </div>
          </div>
          <div className="mt-2 h-1 overflow-hidden rounded bg-[#1e1e1e]">
            <div className="h-full bg-red-600 transition-all" style={{ width: `${(answered / Math.max(1, current.questions.length)) * 100}%` }} />
          </div>
        </div>

        <div className="space-y-4">
          {current.questions.map((q, i) => (
            <div
              key={q.id}
              id={`tq-${q.id}`}
              className={`rounded-xl border bg-[#111] p-5 ${missing.has(q.id) && !isAnswered(answers[q.id]) ? "border-red-500/60" : "border-[#1e1e1e]"}`}
            >
              <div className="mb-3 flex justify-between gap-3">
                <p className="font-medium text-white">
                  <span className="mr-2 text-gray-500">{i + 1}.</span>
                  {q.prompt}
                  {q.required && <span className="ml-1 text-red-400">*</span>}
                </p>
                <span className="shrink-0 text-xs text-gray-500">
                  {q.points} pt{q.points === 1 ? "" : "s"}
                </span>
              </div>
              {q.description && <p className="mb-3 whitespace-pre-wrap text-sm text-gray-400">{q.description}</p>}
              <QuestionInput question={q} value={answers[q.id]} onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))} disabled={busy} />
            </div>
          ))}
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          <p className="text-xs text-gray-500">Your answers are saved as you go.</p>
          <Button onClick={() => submit()} disabled={busy} className="bg-[#dc2626] px-8 hover:bg-[#b91c1c]">
            {busy ? "Submitting…" : "Submit test"}
          </Button>
        </div>
      </TestShell>
    );
  }

  // ─── Start screen and past results ────────────────────────────────────
  const left = test.maxAttempts === null ? null : Math.max(0, test.maxAttempts - test.attemptsUsed);
  const canStart = test.status === "Published" && (left === null || left > 0);
  const latest = test.attempts[0];
  const review = test.attempts.find((a) => a.id === reviewing)?.review ?? null;

  return (
    <TestShell back="/tests">
      <h1 className="font-[family-name:var(--font-oswald)] text-3xl font-bold uppercase text-white">{test.title}</h1>
      {test.description && <p className="mt-2 text-gray-400">{test.description}</p>}

      {latest && (
        <div
          className={`mt-6 rounded-xl border p-5 ${
            latest.status === "Awaiting Grading" || latest.score === null
              ? "border-sky-500/30 bg-sky-500/5"
              : latest.passed
                ? "border-emerald-500/30 bg-emerald-500/5"
                : "border-red-500/30 bg-red-500/5"
          }`}
        >
          {latest.status === "Awaiting Grading" ? (
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-sky-400" />
              <div>
                <p className="font-semibold text-white">Submitted — being marked</p>
                <p className="text-sm text-gray-400">Some answers are marked by hand. Your result appears here once they are.</p>
              </div>
            </div>
          ) : latest.score === null ? (
            <div className="flex items-center gap-3">
              <CheckCircle className="h-8 w-8 text-sky-400" />
              <p className="font-semibold text-white">Submitted. Your result will be shared with you.</p>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              {latest.passed ? <CheckCircle className="h-10 w-10 text-emerald-400" /> : <XCircle className="h-10 w-10 text-red-400" />}
              <div className="flex-1">
                <p className="text-lg font-semibold text-white">{latest.passed ? "Passed" : "Not passed"}</p>
                <p className="text-sm text-gray-400">
                  {latest.earned} / {latest.total} points · pass mark {test.passingScore}%
                </p>
              </div>
              <p className={`text-4xl font-bold ${latest.passed ? "text-emerald-300" : "text-red-300"}`}>{latest.score}%</p>
            </div>
          )}
          {latest.feedback && <p className="mt-4 whitespace-pre-wrap rounded bg-black/30 p-3 text-sm text-gray-300">{latest.feedback}</p>}
        </div>
      )}

      <div className="mt-6 rounded-xl border border-[#1e1e1e] bg-[#111] p-5">
        <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <Fact label="Questions" value={String(test.questionCount)} />
          <Fact label="Pass mark" value={`${test.passingScore}%`} />
          <Fact label="Time limit" value={test.timeLimitMinutes ? `${test.timeLimitMinutes} min` : "None"} />
          <Fact label="Attempts left" value={left === null ? "Unlimited" : String(left)} />
        </div>
        {test.instructions && <p className="mt-5 whitespace-pre-wrap border-t border-[#1e1e1e] pt-4 text-sm text-gray-300">{test.instructions}</p>}
        {test.timeLimitMinutes && canStart && (
          <p className="mt-4 flex items-center gap-2 text-xs text-amber-300">
            <AlertTriangle className="h-4 w-4" />
            The clock starts when you press Start and keeps running if you leave the page.
          </p>
        )}
        <div className="mt-5">
          {canStart ? (
            <Button onClick={start} disabled={busy} className="bg-[#dc2626] px-8 hover:bg-[#b91c1c]">
              {busy ? "Starting…" : test.attemptsUsed ? "Try again" : "Start test"}
            </Button>
          ) : (
            <p className="text-sm text-gray-500">
              {test.status !== "Published" ? "This test is closed." : "You have used all your attempts at this test."}
            </p>
          )}
        </div>
      </div>

      {test.attempts.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-gray-500">Your attempts</h2>
          <div className="divide-y divide-[#1e1e1e] rounded-xl border border-[#1e1e1e]">
            {test.attempts.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <span className="text-gray-400">{a.submittedAt ? new Date(a.submittedAt).toLocaleString() : "—"}</span>
                <span className="flex items-center gap-3">
                  {a.status === "Awaiting Grading" ? (
                    <span className="text-sky-300">Being marked</span>
                  ) : a.score !== null ? (
                    <span className={a.passed ? "text-emerald-300" : "text-red-300"}>{a.score}%</span>
                  ) : (
                    <span className="text-gray-500">Submitted</span>
                  )}
                  {a.review && (
                    <button type="button" onClick={() => setReviewing(reviewing === a.id ? null : a.id)} className="text-xs text-red-400 hover:underline">
                      {reviewing === a.id ? "Hide answers" : "Review answers"}
                    </button>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {review && (
        <div className="mt-6 space-y-3">
          {review.map((q, i) => (
            <div key={q.id} className="rounded-xl border border-[#1e1e1e] bg-[#111] p-5">
              <div className="mb-2 flex justify-between gap-3">
                <p className="font-medium text-white">
                  <span className="mr-2 text-gray-500">{i + 1}.</span>
                  {q.prompt}
                </p>
                <span className="shrink-0 text-xs text-gray-500">
                  {q.awarded === null ? "—" : q.awarded} / {q.points} pts
                </span>
              </div>
              <AnswerReview q={q} answer={q.answer} />
              {q.explanation && <p className="mt-2 rounded bg-white/[0.03] px-3 py-2 text-xs text-gray-400">{q.explanation}</p>}
              {q.comment && <p className="mt-2 text-xs text-sky-300">Grader: {q.comment}</p>}
            </div>
          ))}
        </div>
      )}

      <p className="mt-8 text-center text-sm">
        <Link href="/tests" className="text-gray-500 hover:text-white">
          ← All tests
        </Link>
      </p>
    </TestShell>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-gray-500">{label}</p>
      <p className="mt-0.5 font-semibold text-white">{value}</p>
    </div>
  );
}
