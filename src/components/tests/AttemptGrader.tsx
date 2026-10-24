"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { fetchJson, errorMessage } from "@/lib/fetch-json";
import {
  CHOICE_TYPES,
  QUESTION_TYPE_LABELS,
  grade,
  needsManualGrading,
  type Answers,
  type AttemptSummary,
  type TestQuestion,
} from "@/lib/tests";
import { toast } from "sonner";

interface AttemptDetail extends AttemptSummary {
  testTitle: string;
  passingScore: number;
  questions: TestQuestion[];
  answers: Answers;
  manualPoints: Record<string, number>;
  comments: Record<string, string>;
  feedback: string | null;
}

/**
 * Marks one attempt. Every question shows the answer against the key with
 * its automatic mark; hand-marked questions wait for points, and any
 * auto-marked one can be overridden. The live total updates as points go in.
 */
export function AttemptGrader({ attemptId, onSaved, onClose }: { attemptId: string; onSaved: () => void; onClose: () => void }) {
  const [detail, setDetail] = useState<AttemptDetail | null>(null);
  const [manual, setManual] = useState<Record<string, string>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await fetchJson<AttemptDetail>(`/api/admin/tests/attempts/${attemptId}`);
      setDetail(d);
      setManual(Object.fromEntries(Object.entries(d.manualPoints).map(([k, v]) => [k, String(v)])));
      setComments(d.comments);
      setFeedback(d.feedback ?? "");
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [attemptId]);

  useEffect(() => {
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const manualNumbers = useMemo(
    () => Object.fromEntries(Object.entries(manual).filter(([, v]) => v.trim() !== "" && Number.isFinite(Number(v))).map(([k, v]) => [k, Number(v)])),
    [manual]
  );
  const live = useMemo(
    () => (detail ? grade(detail.questions, detail.answers, manualNumbers) : null),
    [detail, manualNumbers]
  );

  const save = async () => {
    setSaving(true);
    try {
      await fetchJson(`/api/admin/tests/attempts/${attemptId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manualPoints: manualNumbers, comments, feedback }),
      });
      toast.success("Marks saved");
      onSaved();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (error) return <p className="text-sm text-red-400">{error}</p>;
  if (!detail || !live) return <Skeleton className="h-64 w-full" />;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-lg font-semibold text-white">
            {detail.callSign && <span className="font-[family-name:var(--font-mono)]">{detail.callSign} </span>}
            {detail.memberName}
          </p>
          <p className="text-xs text-gray-500">
            Submitted {detail.submittedAt ? new Date(detail.submittedAt).toLocaleString() : "—"}
            {detail.gradedBy && ` · last marked by ${detail.gradedBy}`}
          </p>
          {detail.tabSwitches > 0 && (
            <p className={`mt-1 text-xs ${detail.autoSubmittedReason ? "text-red-300" : "text-amber-300"}`}>
              Left the test page {detail.tabSwitches} time{detail.tabSwitches === 1 ? "" : "s"}
              {detail.autoSubmittedReason ? " — handed in automatically" : ""}
            </p>
          )}
        </div>
        <ScoreBadge score={live.score} pending={live.pendingManual} passing={detail.passingScore} earned={live.earned} total={live.total} />
      </div>

      <div className="space-y-3">
        {detail.questions.map((q, i) => {
          const answer = detail.answers[q.id];
          const auto = live.points[q.id];
          const manualOnly = needsManualGrading(q);
          const awaiting = auto === null;
          return (
            <div
              key={q.id}
              className={`rounded-lg border p-4 ${awaiting ? "border-sky-500/40 bg-sky-500/5" : "border-[#1e1e28]"}`}
            >
              <div className="mb-2 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-gray-500">
                    Q{i + 1} · {QUESTION_TYPE_LABELS[q.type]}
                  </p>
                  <p className="text-sm font-medium text-white">{q.prompt}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Input
                    type="number"
                    min={0}
                    max={q.points}
                    step="any"
                    value={manual[q.id] ?? (manualOnly ? "" : String(auto ?? ""))}
                    onChange={(e) => setManual({ ...manual, [q.id]: e.target.value })}
                    placeholder="—"
                    className={`h-8 w-16 text-right ${awaiting ? "border-sky-500/60" : ""}`}
                    title={manualOnly ? "Award points" : "Override the automatic mark"}
                  />
                  <span className="text-xs text-gray-500">/ {q.points}</span>
                </div>
              </div>

              <AnswerReview q={q} answer={answer} />

              {q.explanation && (
                <p className="mt-2 rounded bg-white/[0.03] px-3 py-2 text-xs text-gray-400">
                  <span className="font-medium text-gray-300">{q.type === "long" ? "Marking guide: " : "Explanation: "}</span>
                  {q.explanation}
                </p>
              )}

              <Input
                value={comments[q.id] ?? ""}
                onChange={(e) => setComments({ ...comments, [q.id]: e.target.value })}
                placeholder="Comment for the member (optional)"
                className="mt-2 h-8 text-xs"
              />
            </div>
          );
        })}
      </div>

      <div className="mt-4">
        <label className="mb-1 block text-xs text-gray-500">Overall feedback (optional)</label>
        <Textarea rows={3} value={feedback} onChange={(e) => setFeedback(e.target.value)} />
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
        <Button onClick={save} disabled={saving} className="bg-[#dc2626] hover:bg-[#b91c1c]">
          {saving ? "Saving…" : live.pendingManual ? `Save (${live.pendingManual} still to mark)` : "Save marks"}
        </Button>
      </div>
    </div>
  );
}

/** The member's answer next to the key — ticks and crosses on choices, text for the rest. */
export function AnswerReview({ q, answer }: { q: TestQuestion; answer: string | string[] | null | undefined }) {
  if (CHOICE_TYPES.includes(q.type)) {
    const picked = new Set(Array.isArray(answer) ? answer : answer ? [answer] : []);
    return (
      <ul className="space-y-1">
        {q.options.map((o) => {
          const correct = q.correct.includes(o.id);
          const chose = picked.has(o.id);
          return (
            <li
              key={o.id}
              className={`flex items-center gap-2 rounded px-2 py-1 text-sm ${
                chose && correct ? "bg-emerald-500/10 text-emerald-200" : chose ? "bg-red-500/10 text-red-200" : correct ? "text-emerald-300/80" : "text-gray-500"
              }`}
            >
              {chose ? (correct ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />) : <span className="w-3.5" />}
              {o.text}
              {correct && !chose && <span className="text-[11px] text-emerald-400/70">(correct answer)</span>}
            </li>
          );
        })}
        {picked.size === 0 && <li className="px-2 text-xs italic text-gray-500">Not answered</li>}
      </ul>
    );
  }

  const text = typeof answer === "string" ? answer : "";
  return (
    <div className="space-y-1">
      <p className={`whitespace-pre-wrap rounded bg-black/30 px-3 py-2 text-sm ${text ? "text-gray-200" : "italic text-gray-500"}`}>
        {text || "Not answered"}
      </p>
      {q.type === "short" && q.accepted.length > 0 && (
        <p className="text-xs text-gray-500">Accepted: {q.accepted.join(" · ")}</p>
      )}
      {q.type === "number" && q.numberAnswer !== null && q.numberAnswer !== undefined && (
        <p className="text-xs text-gray-500">
          Answer: {q.numberAnswer}
          {q.tolerance ? ` ± ${q.tolerance}` : ""}
        </p>
      )}
    </div>
  );
}

export function ScoreBadge({
  score,
  pending,
  passing,
  earned,
  total,
}: {
  score: number | null;
  pending: number;
  passing: number;
  earned: number;
  total: number;
}) {
  if (score === null) {
    return (
      <div className="rounded-lg bg-sky-500/10 px-3 py-2 text-right">
        <p className="text-sm font-semibold text-sky-300">{pending} to mark</p>
        <p className="text-[11px] text-gray-500">{earned} pts so far</p>
      </div>
    );
  }
  const passed = score >= passing;
  return (
    <div className={`rounded-lg px-3 py-2 text-right ${passed ? "bg-emerald-500/10" : "bg-red-500/10"}`}>
      <p className={`text-xl font-bold ${passed ? "text-emerald-300" : "text-red-300"}`}>{score}%</p>
      <p className="text-[11px] text-gray-500">
        {earned} / {total} pts · {passed ? "Pass" : "Fail"}
      </p>
    </div>
  );
}
