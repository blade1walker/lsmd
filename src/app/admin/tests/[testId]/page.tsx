"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowLeft, Download, FileUp, Eye, EyeOff, Lock, RotateCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ErrorState } from "@/components/ui/error-state";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { QuestionEditor } from "@/components/tests/QuestionEditor";
import { QuestionInput } from "@/components/tests/QuestionInput";
import { QUESTION_TYPE_ICONS } from "@/components/tests/QuestionTypeIcons";
import { AnswerReview, AttemptGrader, ScoreBadge } from "@/components/tests/AttemptGrader";
import { ImportQuestionsDialog } from "@/components/tests/ImportQuestionsDialog";
import { fetchJson, fetchList, errorMessage } from "@/lib/fetch-json";
import { RANKS, TEST_PERMISSIONS } from "@/lib/constants";
import { cloneQuestion, downloadQuestions } from "@/lib/tests/import-export";
import {
  QUESTION_TYPES,
  QUESTION_TYPE_HINTS,
  QUESTION_TYPE_LABELS,
  STATUS_STYLES,
  blankQuestion,
  grade,
  publicQuestions,
  questionProblems,
  totalPoints,
  type Answers,
  type AttemptSummary,
  type QuestionType,
  type TestQuestion,
  type TestSettings,
} from "@/lib/tests";
import { toast } from "sonner";

type Tab = "questions" | "settings" | "preview" | "results";

interface TestDetail extends TestSettings {
  id: string;
  questions: TestQuestion[];
  updatedAt: string;
  updatedBy: string | null;
}

function settingsOf(t: TestDetail): TestSettings {
  return {
    title: t.title,
    description: t.description,
    instructions: t.instructions,
    status: t.status,
    passingScore: t.passingScore,
    timeLimitMinutes: t.timeLimitMinutes,
    maxAttempts: t.maxAttempts,
    shuffleQuestions: t.shuffleQuestions,
    shuffleOptions: t.shuffleOptions,
    showResults: t.showResults,
    showCorrectAnswers: t.showCorrectAnswers,
    showOnHomepage: t.showOnHomepage,
    minRank: t.minRank,
    examMode: t.examMode,
    maxTabSwitches: t.maxTabSwitches,
  };
}

export default function TestBuilderPage() {
  const { testId } = useParams<{ testId: string }>();
  const { data: session } = useSession();
  const canManage =
    !!session?.user.isSuperAdmin ||
    TEST_PERMISSIONS.manage.some((p) => (session?.user.permissions ?? []).includes(p));

  const [test, setTest] = useState<TestDetail | null>(null);
  const [questions, setQuestions] = useState<TestQuestion[]>([]);
  const [settings, setSettings] = useState<TestSettings | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Unset until picked, so someone with only the grading permission lands on the results.
  const [pickedTab, setTab] = useState<Tab | null>(null);
  const tab: Tab = pickedTab ?? (canManage ? "questions" : "results");
  const [open, setOpen] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    try {
      const t = await fetchJson<TestDetail>(`/api/admin/tests/${testId}`);
      setTest(t);
      setQuestions(t.questions);
      setSettings(settingsOf(t));
      setDirty(false);
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [testId]);

  useEffect(() => {
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [load]);

  // Leaving with unsaved edits asks first.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const save = useCallback(
    async (patch: Partial<TestSettings> = {}) => {
      if (!settings) return false;
      setSaving(true);
      try {
        const saved = await fetchJson<TestDetail>(`/api/admin/tests/${testId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...settings, ...patch, questions }),
        });
        setTest(saved);
        setQuestions(saved.questions);
        setSettings(settingsOf(saved));
        setDirty(false);
        return true;
      } catch (err) {
        toast.error(errorMessage(err), { duration: 8000 });
        return false;
      } finally {
        setSaving(false);
      }
    },
    [settings, questions, testId]
  );

  // Ctrl/Cmd+S saves.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s" && canManage) {
        e.preventDefault();
        save().then((ok) => ok && toast.success("Saved"));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save, canManage]);

  const mutate = (next: TestQuestion[]) => {
    setQuestions(next);
    setDirty(true);
  };
  const setSetting = (patch: Partial<TestSettings>) => {
    setSettings((s) => (s ? { ...s, ...patch } : s));
    setDirty(true);
  };

  const add = (type: QuestionType) => {
    const q = blankQuestion(type);
    mutate([...questions, q]);
    setOpen(q.id);
    setTimeout(() => document.getElementById(`q-${q.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
  };

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= questions.length) return;
    const next = [...questions];
    [next[index], next[target]] = [next[target], next[index]];
    mutate(next);
  };

  const duplicate = (index: number) => {
    // Fresh option ids, so the copy's correct answers point at its own options.
    const copy = cloneQuestion(questions[index]);
    const next = [...questions];
    next.splice(index + 1, 0, copy);
    mutate(next);
    setOpen(copy.id);
  };

  const applyImport = (incoming: TestQuestion[], replace: boolean) => {
    mutate(replace ? incoming : [...questions, ...incoming]);
    setOpen(null);
    toast.success(`${incoming.length} question${incoming.length === 1 ? "" : "s"} imported — remember to save`);
  };

  const exportQuestions = async (format: "xlsx" | "csv" | "json") => {
    setExporting(true);
    try {
      await downloadQuestions(questions, `${settings?.title || "test"}-questions`, format);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  if (error && !test) return <ErrorState title="Failed to load test" message={error} onRetry={load} />;
  if (!test || !settings) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const problems = questions.flatMap((q, i) => questionProblems(q).map((p) => `Q${i + 1}: ${p}`));
  const points = totalPoints(questions);
  const published = test.status === "Published";

  const publish = async () => {
    if (problems.length) {
      toast.error(`Fix ${problems.length} problem${problems.length === 1 ? "" : "s"} first: ${problems.slice(0, 3).join("; ")}`);
      setTab("questions");
      return;
    }
    if (await save({ status: "Published" })) toast.success("Published — members can take it on /tests now");
  };

  return (
    <div className="max-w-5xl pb-24">
      <Link href="/admin/tests" className="mb-4 inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white">
        <ArrowLeft className="h-4 w-4" />
        Tests
      </Link>

      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-[family-name:var(--font-oswald)] text-2xl font-bold uppercase text-white">
              {settings.title || "Untitled test"}
            </h1>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[test.status]}`}>{test.status}</span>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            {questions.length} question{questions.length === 1 ? "" : "s"} · {points} point{points === 1 ? "" : "s"} · pass
            mark {settings.passingScore}%{settings.timeLimitMinutes ? ` · ${settings.timeLimitMinutes} min` : ""}
          </p>
        </div>
        {canManage && (
          <div className="flex flex-wrap items-center gap-2">
            {published ? (
              <Button variant="outline" disabled={saving} onClick={() => save({ status: "Closed" }).then((ok) => ok && toast.success("Closed — no new attempts"))}>
                <Lock className="mr-2 h-4 w-4" />
                Close
              </Button>
            ) : (
              <Button onClick={publish} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
                <Eye className="mr-2 h-4 w-4" />
                {test.status === "Closed" ? "Reopen" : "Publish"}
              </Button>
            )}
            {test.status !== "Draft" && (
              <Button variant="ghost" disabled={saving} onClick={() => save({ status: "Draft" }).then((ok) => ok && toast.success("Moved back to draft"))}>
                <EyeOff className="mr-2 h-4 w-4" />
                Unpublish
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="mb-5 flex gap-1 overflow-x-auto rounded-lg border border-[#1e1e28] p-1">
        {(canManage ? (["questions", "settings", "preview", "results"] as Tab[]) : (["results", "preview"] as Tab[])).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`flex-1 whitespace-nowrap rounded-md px-4 py-1.5 text-sm font-medium capitalize ${
              tab === t ? "bg-red-600/15 text-red-300" : "text-gray-500 hover:text-gray-300"
            }`}
          >
            {t}
            {t === "questions" && problems.length > 0 && <span className="ml-1.5 text-amber-400">•</span>}
          </button>
        ))}
      </div>

      {tab === "questions" && (
        <div>
          {questions.length === 0 ? (
            <div className="mb-4 rounded-xl border border-dashed border-[#1e1e28] p-8 text-center">
              <p className="text-sm text-gray-400">
                No questions yet. Pick a type below to add one, or import them from a spreadsheet, another test or pasted text.
              </p>
              <Button variant="outline" className="mt-4" onClick={() => setShowImport(true)}>
                <FileUp className="mr-2 h-4 w-4" />
                Import questions
              </Button>
            </div>
          ) : (
            <div className="mb-4 space-y-2">
              <div className="flex flex-wrap items-center justify-end gap-2 pb-1">
                <Button variant="outline" size="sm" onClick={() => setShowImport(true)}>
                  <FileUp className="mr-2 h-4 w-4" />
                  Import
                </Button>
                <div className="flex items-center gap-1 rounded-md border border-[#1e1e28] px-2 py-1 text-xs text-gray-400">
                  <Download className="h-3.5 w-3.5" />
                  Export:
                  {(["xlsx", "csv", "json"] as const).map((f) => (
                    <button key={f} type="button" disabled={exporting} onClick={() => exportQuestions(f)} className="rounded px-1.5 py-0.5 uppercase hover:bg-white/5 hover:text-white disabled:opacity-40">
                      {f === "xlsx" ? "Excel" : f}
                    </button>
                  ))}
                </div>
              </div>
              {questions.map((q, i) => (
                <div key={q.id} id={`q-${q.id}`}>
                  <QuestionEditor
                    question={q}
                    index={i}
                    count={questions.length}
                    open={open === q.id}
                    onToggle={() => setOpen(open === q.id ? null : q.id)}
                    onChange={(next) => mutate(questions.map((x) => (x.id === q.id ? next : x)))}
                    onMove={(d) => move(i, d)}
                    onDuplicate={() => duplicate(i)}
                    onDelete={() => {
                      if (q.prompt && !confirm(`Delete question ${i + 1}?`)) return;
                      mutate(questions.filter((x) => x.id !== q.id));
                    }}
                  />
                </div>
              ))}
            </div>
          )}

          <div className="rounded-xl border border-[#1e1e28] bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Add a question</p>
              <button type="button" onClick={() => setShowImport(true)} className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-white">
                <FileUp className="h-3.5 w-3.5" />
                Import several at once
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
              {QUESTION_TYPES.map((type) => {
                const Icon = QUESTION_TYPE_ICONS[type];
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => add(type)}
                    title={QUESTION_TYPE_HINTS[type]}
                    className="flex flex-col items-center gap-1.5 rounded-lg border border-[#1e1e28] px-2 py-3 text-xs text-gray-300 transition-colors hover:border-red-500/50 hover:bg-red-600/5 hover:text-white"
                  >
                    <Icon className="h-5 w-5 text-red-400" />
                    {QUESTION_TYPE_LABELS[type]}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {tab === "settings" && <SettingsPanel settings={settings} set={setSetting} />}

      {tab === "preview" && <PreviewPanel settings={settings} questions={questions} />}

      {tab === "results" && <ResultsPanel testId={testId} title={settings.title} passing={settings.passingScore} canManage={canManage} />}

      {canManage && (tab === "questions" || tab === "settings") && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#1e1e28] bg-[#0a0a0f]/95 backdrop-blur md:left-64">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
            <p className="text-xs text-gray-500">
              {dirty ? (
                <span className="text-amber-300">Unsaved changes</span>
              ) : (
                <>Saved{test.updatedBy ? ` by ${test.updatedBy}` : ""} · {new Date(test.updatedAt).toLocaleString()}</>
              )}
              {problems.length > 0 && (
                <span className="ml-2 text-amber-400">
                  · {problems.length} thing{problems.length === 1 ? "" : "s"} to fix before publishing
                </span>
              )}
            </p>
            <div className="flex gap-2">
              {dirty && (
                <Button variant="ghost" onClick={load} disabled={saving}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Discard
                </Button>
              )}
              <Button onClick={() => save().then((ok) => ok && toast.success("Saved"))} disabled={!dirty || saving} className="bg-[#dc2626] hover:bg-[#b91c1c]">
                <Save className="mr-2 h-4 w-4" />
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {canManage && (
        <ImportQuestionsDialog
          open={showImport}
          onOpenChange={setShowImport}
          currentTestId={testId}
          hasQuestions={questions.length > 0}
          onImport={applyImport}
        />
      )}
    </div>
  );
}

function SettingsPanel({ settings: s, set }: { settings: TestSettings; set: (patch: Partial<TestSettings>) => void }) {
  return (
    <div className="space-y-5">
      <Section title="Details">
        <div>
          <Label className="text-sm text-gray-400">Title</Label>
          <Input className="mt-1" value={s.title} onChange={(e) => set({ title: e.target.value })} />
        </div>
        <div>
          <Label className="text-sm text-gray-400">Description</Label>
          <Textarea className="mt-1" rows={2} value={s.description ?? ""} onChange={(e) => set({ description: e.target.value })} placeholder="Shown in the list of tests" />
        </div>
        <div>
          <Label className="text-sm text-gray-400">Instructions</Label>
          <Textarea
            className="mt-1"
            rows={4}
            value={s.instructions ?? ""}
            onChange={(e) => set({ instructions: e.target.value })}
            placeholder="Shown on the start screen — e.g. closed book, answer in your own words"
          />
        </div>
      </Section>

      <Section title="Scoring & rules">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label className="text-sm text-gray-400">Pass mark (%)</Label>
            <Input className="mt-1" type="number" min={0} max={100} value={s.passingScore} onChange={(e) => set({ passingScore: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })} />
          </div>
          <OptionalNumber
            label="Time limit (minutes)"
            off="No time limit"
            value={s.timeLimitMinutes}
            fallback={30}
            onChange={(v) => set({ timeLimitMinutes: v })}
          />
          <OptionalNumber
            label="Attempts per member"
            off="Unlimited attempts"
            value={s.maxAttempts}
            fallback={1}
            onChange={(v) => set({ maxAttempts: v })}
          />
        </div>
      </Section>

      <Section title="Who can take it">
        <Check
          label="Show on the homepage"
          hint="Shown as a card in the Applications row of the homepage for everyone to see. Only members who meet the minimum rank can start it."
          checked={s.showOnHomepage}
          onChange={(v) => set({ showOnHomepage: v })}
        />
        <div className="max-w-sm">
          <Label className="text-sm text-gray-400">Minimum rank</Label>
          <Select className="mt-1" value={s.minRank ?? ""} onChange={(e) => set({ minRank: e.target.value || null })}>
            <option value="">Any rank</option>
            {[...RANKS].reverse().map((r) => (
              <option key={r.name} value={r.name}>
                {r.name} and above
              </option>
            ))}
          </Select>
          <p className="mt-1 text-xs text-gray-500">
            {s.minRank
              ? `Members below ${s.minRank} still see the test, with "You require this minimum rank: ${s.minRank}" in place of Start.`
              : "Every member on the roster can take it."}
          </p>
        </div>
      </Section>

      <Section title="Exam mode">
        <Check
          label="Lock down the test while it is open"
          hint="Opens full screen, blocks copy, cut, paste, right-click and text selection, and records every time the member leaves the page"
          checked={s.examMode}
          onChange={(v) => set({ examMode: v })}
        />
        {s.examMode && (
          <div className="max-w-sm">
            <Label className="text-sm text-gray-400">Times a member may leave the page</Label>
            <Input
              className="mt-1 w-32"
              type="number"
              min={0}
              max={20}
              value={s.maxTabSwitches}
              onChange={(e) => set({ maxTabSwitches: Math.max(0, Math.min(20, Number(e.target.value) || 0)) })}
            />
            <p className="mt-1 text-xs text-gray-500">
              {s.maxTabSwitches === 0
                ? "Switching tab, app or window once hands the test in immediately."
                : `Each leave shows a warning; leave ${s.maxTabSwitches + 1} times and the test is handed in automatically.`}
            </p>
          </div>
        )}
      </Section>

      <Section title="While taking the test">
        <Check label="Shuffle question order" hint="Each attempt gets its own order" checked={s.shuffleQuestions} onChange={(v) => set({ shuffleQuestions: v })} />
        <Check label="Shuffle answer options" hint="Multiple choice, checkboxes and dropdowns" checked={s.shuffleOptions} onChange={(v) => set({ shuffleOptions: v })} />
      </Section>

      <Section title="After submitting">
        <Check label="Show the member their score" checked={s.showResults} onChange={(v) => set({ showResults: v, ...(v ? {} : { showCorrectAnswers: false }) })} />
        <Check
          label="Also show correct answers and explanations"
          hint="Lets members review their marked paper — leave off for a test people retake"
          checked={s.showCorrectAnswers}
          disabled={!s.showResults}
          onChange={(v) => set({ showCorrectAnswers: v })}
        />
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[#1e1e28] bg-card p-5">
      <h2 className="mb-4 text-xs font-medium uppercase tracking-wider text-gray-500">{title}</h2>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Check({ label, hint, checked, disabled, onChange }: { label: string; hint?: string; checked: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className={`flex cursor-pointer items-start gap-3 ${disabled ? "opacity-40" : ""}`}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-4 w-4 accent-red-600" />
      <span>
        <span className="block text-sm text-gray-200">{label}</span>
        {hint && <span className="block text-xs text-gray-500">{hint}</span>}
      </span>
    </label>
  );
}

function OptionalNumber({
  label,
  off,
  value,
  fallback,
  onChange,
}: {
  label: string;
  off: string;
  value: number | null;
  fallback: number;
  onChange: (v: number | null) => void;
}) {
  return (
    <div>
      <Label className="text-sm text-gray-400">{label}</Label>
      <Input
        className="mt-1"
        type="number"
        min={1}
        disabled={value === null}
        value={value ?? ""}
        placeholder="—"
        onChange={(e) => onChange(Math.max(1, Number(e.target.value) || 1))}
      />
      <label className="mt-1.5 flex items-center gap-2 text-xs text-gray-500">
        <input type="checkbox" checked={value === null} onChange={(e) => onChange(e.target.checked ? null : fallback)} className="accent-red-600" />
        {off}
      </label>
    </div>
  );
}

/** The test as a member will see it, answerable, with a "check" that marks it locally. */
function PreviewPanel({ settings, questions }: { settings: TestSettings; questions: TestQuestion[] }) {
  const [answers, setAnswers] = useState<Answers>({});
  const [checked, setChecked] = useState(false);
  const shown = publicQuestions(questions);
  const result = checked ? grade(questions, answers) : null;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 rounded-xl border border-[#1e1e28] bg-card p-5">
        <h2 className="text-xl font-semibold text-white">{settings.title}</h2>
        {settings.description && <p className="mt-1 text-sm text-gray-400">{settings.description}</p>}
        {settings.instructions && <p className="mt-3 whitespace-pre-wrap rounded bg-white/[0.03] p-3 text-sm text-gray-300">{settings.instructions}</p>}
        <p className="mt-3 text-xs text-gray-500">Preview — answers here are not saved.</p>
      </div>
      <div className="space-y-3">
        {shown.map((q, i) => (
          <div key={q.id} className="rounded-xl border border-[#1e1e28] bg-card p-5">
            <div className="mb-3 flex justify-between gap-3">
              <p className="text-sm font-medium text-white">
                <span className="mr-2 text-gray-500">{i + 1}.</span>
                {q.prompt || <span className="italic text-gray-500">Untitled question</span>}
                {q.required && <span className="ml-1 text-red-400">*</span>}
              </p>
              <span className="shrink-0 text-xs text-gray-500">
                {q.points} pt{q.points === 1 ? "" : "s"}
              </span>
            </div>
            {q.description && <p className="mb-3 whitespace-pre-wrap text-sm text-gray-400">{q.description}</p>}
            {result ? (
              <>
                <AnswerReview q={questions[i]} answer={answers[q.id]} />
                <p className="mt-2 text-xs text-gray-500">
                  {result.points[q.id] === null ? "Marked by a grader" : `${result.points[q.id]} / ${q.points} pts`}
                </p>
              </>
            ) : (
              <QuestionInput question={q} value={answers[q.id]} onChange={(v) => setAnswers({ ...answers, [q.id]: v })} />
            )}
          </div>
        ))}
      </div>
      {questions.length > 0 && (
        <div className="mt-4 flex items-center justify-end gap-3">
          {result && <ScoreBadge score={result.score} pending={result.pendingManual} passing={settings.passingScore} earned={result.earned} total={result.total} />}
          <Button
            variant="outline"
            onClick={() => {
              if (checked) setAnswers({});
              setChecked(!checked);
            }}
          >
            {checked ? "Try again" : "Check my answers"}
          </Button>
        </div>
      )}
    </div>
  );
}

function ResultsPanel({ testId, title, passing, canManage }: { testId: string; title: string; passing: number; canManage: boolean }) {
  const [attempts, setAttempts] = useState<AttemptSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [grading, setGrading] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "grade" | "passed" | "failed">("all");

  const load = useCallback(async () => {
    try {
      setAttempts(await fetchList<AttemptSummary>(`/api/admin/tests/${testId}/attempts`));
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [testId]);

  useEffect(() => {
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [load]);

  if (error) return <ErrorState title="Failed to load results" message={error} onRetry={load} />;
  if (!attempts) return <Skeleton className="h-64 w-full" />;

  const done = attempts.filter((a) => a.status !== "In Progress");
  const graded = done.filter((a) => a.score !== null);
  const average = graded.length ? Math.round(graded.reduce((s, a) => s + (a.score ?? 0), 0) / graded.length) : null;
  const rows = attempts.filter((a) =>
    filter === "grade" ? a.status === "Awaiting Grading" : filter === "passed" ? a.passed === true : filter === "failed" ? a.passed === false : true
  );

  const remove = async (a: AttemptSummary) => {
    if (!confirm(`Delete ${a.memberName}'s attempt? They get that attempt back.`)) return;
    try {
      await fetchJson(`/api/admin/tests/attempts/${a.id}`, { method: "DELETE" });
      toast.success("Attempt deleted");
      load();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const csv = () => {
    const cell = (v: string | number | null | boolean) => {
      const t = v === null ? "" : String(v);
      return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
    };
    const lines = [
      ["Call Sign", "Name", "Status", "Score %", "Points", "Total", "Passed", "Started", "Submitted", "Graded By"].join(","),
      ...done.map((a) =>
        [a.callSign, a.memberName, a.status, a.score, a.earned, a.total, a.passed === null ? "" : a.passed ? "Yes" : "No", a.startedAt, a.submittedAt, a.gradedBy]
          .map(cell)
          .join(",")
      ),
    ];
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${title.replace(/[^\w-]+/g, "-").toLowerCase() || "test"}-results.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Submitted" value={String(done.length)} />
        <Tile label="To grade" value={String(done.filter((a) => a.status === "Awaiting Grading").length)} tone="text-sky-300" />
        <Tile label="Pass rate" value={graded.length ? `${Math.round((graded.filter((a) => a.passed).length / graded.length) * 100)}%` : "—"} tone="text-emerald-300" />
        <Tile label="Average score" value={average === null ? "—" : `${average}%`} />
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1.5">
          {(["all", "grade", "passed", "failed"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-full border px-3 py-1 text-xs ${filter === f ? "border-red-500/50 bg-red-600/15 text-red-300" : "border-[#1e1e28] text-gray-400 hover:text-gray-200"}`}
            >
              {f === "all" ? "All" : f === "grade" ? "To grade" : f === "passed" ? "Passed" : "Failed"}
            </button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={csv} disabled={done.length === 0}>
          <Download className="mr-2 h-4 w-4" />
          CSV
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#1e1e28] p-10 text-center text-sm text-gray-500">
          {attempts.length === 0 ? "Nobody has taken this test yet." : "No attempts match."}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#1e1e28] bg-card">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-[#1e1e28] text-left text-xs uppercase tracking-wider text-gray-500">
                <th className="px-4 py-3 font-medium">Member</th>
                <th className="px-4 py-3 font-medium">Submitted</th>
                <th className="px-4 py-3 font-medium">Score</th>
                <th className="px-4 py-3 font-medium">Result</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id} className="border-b border-[#1e1e28]/60 last:border-b-0">
                  <td className="px-4 py-3 text-gray-200">
                    {a.callSign && <span className="font-[family-name:var(--font-mono)] font-bold text-white">{a.callSign} </span>}
                    {a.memberName}
                    {a.tabSwitches > 0 && (
                      <span
                        title={a.autoSubmittedReason ?? "Times they left the page during the test"}
                        className={`ml-2 rounded px-1.5 py-0.5 text-[11px] ${a.autoSubmittedReason ? "bg-red-500/15 text-red-300" : "bg-amber-500/15 text-amber-300"}`}
                      >
                        left page {a.tabSwitches}×{a.autoSubmittedReason ? " · auto-submitted" : ""}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-400">{a.submittedAt ? new Date(a.submittedAt).toLocaleString() : "—"}</td>
                  <td className="px-4 py-3 text-gray-200">
                    {a.score !== null ? `${a.score}%` : "—"}
                    {a.earned !== null && <span className="ml-1 text-xs text-gray-500">({a.earned}/{a.total})</span>}
                  </td>
                  <td className="px-4 py-3">
                    {a.status === "In Progress" ? (
                      <span className="text-xs text-gray-500">In progress</span>
                    ) : a.status === "Awaiting Grading" ? (
                      <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-xs text-sky-300">To grade</span>
                    ) : a.passed ? (
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300">Passed</span>
                    ) : (
                      <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-xs text-red-300">Failed</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {a.status !== "In Progress" && (
                      <Button size="sm" variant={a.status === "Awaiting Grading" ? "default" : "outline"} onClick={() => setGrading(a.id)} className={a.status === "Awaiting Grading" ? "bg-sky-600 hover:bg-sky-700" : ""}>
                        {a.status === "Awaiting Grading" ? "Grade" : "Review"}
                      </Button>
                    )}
                    {canManage && (
                      <Button size="sm" variant="ghost" onClick={() => remove(a)} className="ml-1 text-red-400">
                        Delete
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-xs text-gray-600">Pass mark {passing}%. Deleting an attempt gives the member that attempt back.</p>

      <Dialog open={grading !== null} onOpenChange={(o) => !o && setGrading(null)}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-3xl">
          <DialogHeader>
            <DialogTitle>Mark attempt</DialogTitle>
          </DialogHeader>
          {grading && (
            <AttemptGrader
              key={grading}
              attemptId={grading}
              onClose={() => setGrading(null)}
              onSaved={() => {
                setGrading(null);
                load();
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Tile({ label, value, tone = "text-white" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-[#1e1e28] bg-card px-4 py-3">
      <p className="text-[11px] uppercase tracking-wider text-gray-500">{label}</p>
      <p className={`mt-1 text-xl font-bold ${tone}`}>{value}</p>
    </div>
  );
}
