"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ClipboardPaste, Copy, Download, FileUp, Plus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { QUESTION_TYPE_ICONS } from "./QuestionTypeIcons";
import { fetchJson, fetchList, errorMessage } from "@/lib/fetch-json";
import { PASTE_EXAMPLE, QUESTION_TYPE_LABELS, parseQuestionText, questionProblems, type TestQuestion } from "@/lib/tests";
import { cloneQuestion, downloadQuestions, importFile, templateQuestions, type ImportResult } from "@/lib/tests/import-export";
import { toast } from "sonner";

type Source = "file" | "test" | "paste";

const SOURCES: { key: Source; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "file", label: "Upload a file", icon: FileUp },
  { key: "test", label: "From another test", icon: Copy },
  { key: "paste", label: "Paste text", icon: ClipboardPaste },
];

/**
 * Brings questions in from outside the builder — a spreadsheet or JSON file,
 * another test, or pasted text — and shows exactly how each will be read
 * before anything is added.
 */
export function ImportQuestionsDialog({
  open,
  onOpenChange,
  currentTestId,
  hasQuestions,
  onImport,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentTestId: string;
  hasQuestions: boolean;
  onImport: (questions: TestQuestion[], replace: boolean) => void;
}) {
  const [source, setSource] = useState<Source>("file");
  const [fileResult, setFileResult] = useState<(ImportResult & { name: string }) | null>(null);
  const [reading, setReading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [tests, setTests] = useState<{ id: string; title: string; questionCount: number }[] | null>(null);
  const [sourceTestId, setSourceTestId] = useState("");
  const [sourceQuestions, setSourceQuestions] = useState<TestQuestion[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  // The list of other tests is fetched the first time that tab is opened.
  useEffect(() => {
    if (!open || source !== "test" || tests) return;
    fetchList<{ id: string; title: string; questionCount: number }>("/api/admin/tests")
      .then((all) => setTests(all.filter((t) => t.id !== currentTestId && t.questionCount > 0)))
      .catch((err) => toast.error(errorMessage(err)));
  }, [open, source, tests, currentTestId]);

  const chooseTest = async (id: string) => {
    setSourceTestId(id);
    setSourceQuestions([]);
    setPicked(new Set());
    if (!id) return;
    try {
      const t = await fetchJson<{ questions: TestQuestion[] }>(`/api/admin/tests/${id}`);
      setSourceQuestions(t.questions);
      setPicked(new Set(t.questions.map((q) => q.id)));
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const readFile = async (file: File | undefined) => {
    if (!file) return;
    setReading(true);
    try {
      setFileResult({ ...(await importFile(file)), name: file.name });
    } catch (err) {
      setFileResult({ questions: [], warnings: [`Could not read ${file.name}: ${errorMessage(err)}`], name: file.name });
    } finally {
      setReading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const pasted = useMemo(() => parseQuestionText(pasteText), [pasteText]);

  // Copies get fresh ids so they can sit beside the originals — made once per selection, not per render.
  const copies = useMemo(() => sourceQuestions.filter((q) => picked.has(q.id)).map(cloneQuestion), [sourceQuestions, picked]);

  const result: ImportResult =
    source === "file"
      ? (fileResult ?? { questions: [], warnings: [] })
      : source === "paste"
        ? { questions: pasted.questions, warnings: [] }
        : { questions: copies, warnings: [] };
  const count = result.questions.length;

  const close = () => {
    onOpenChange(false);
    setFileResult(null);
    setPasteText("");
    setSourceTestId("");
    setSourceQuestions([]);
    setPicked(new Set());
  };

  const apply = (replace: boolean) => {
    if (!count) return;
    if (replace && !confirm("Replace every existing question in this test?")) return;
    onImport(result.questions, replace);
    close();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-5xl">
        <DialogHeader>
          <DialogTitle>Import questions</DialogTitle>
        </DialogHeader>

        <div className="mb-4 mt-2 flex gap-1 rounded-lg border border-[#1e1e28] p-1">
          {SOURCES.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setSource(key)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium ${
                source === key ? "bg-red-600/15 text-red-300" : "text-gray-500 hover:text-gray-300"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            {source === "file" && (
              <div>
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragging(false);
                    readFile(e.dataTransfer.files[0]);
                  }}
                  className={`flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-10 text-center transition-colors ${
                    dragging ? "border-red-500 bg-red-600/5" : "border-[#2e2e3a] hover:border-red-500/50"
                  }`}
                >
                  <Upload className="h-8 w-8 text-red-400" />
                  <span className="text-sm text-gray-200">{reading ? "Reading…" : fileResult ? fileResult.name : "Drop a file here, or click to choose"}</span>
                  <span className="text-xs text-gray-500">Excel (.xlsx), CSV, JSON or a text file</span>
                </button>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".xlsx,.xls,.ods,.csv,.json,.txt,.md"
                  className="hidden"
                  onChange={(e) => readFile(e.target.files?.[0])}
                />

                <div className="mt-4 rounded-lg bg-white/[0.03] p-3 text-xs text-gray-400">
                  <p className="mb-1 font-medium text-gray-300">Spreadsheet layout — one question per row</p>
                  <p>
                    <b className="text-gray-300">Question</b> (required), <b className="text-gray-300">Type</b>, <b className="text-gray-300">Options</b>{" "}
                    (split with <code>|</code>, or Option 1, Option 2… columns), <b className="text-gray-300">Answer</b>, Points, Required, Details,
                    Explanation.
                  </p>
                  <p className="mt-1">
                    The Answer is the correct option&apos;s text or letter (<code>B</code>, <code>A, C</code>), accepted short answers (
                    <code>CPR | cardiopulmonary resuscitation</code>), a number (<code>110 ± 10</code>) or True/False. With no Type column, the type is
                    worked out from the options and answer.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button type="button" onClick={() => downloadQuestions(templateQuestions(), "questions-template", "xlsx")} className="inline-flex items-center gap-1 text-red-400 hover:underline">
                      <Download className="h-3 w-3" />
                      Excel template
                    </button>
                    <button type="button" onClick={() => downloadQuestions(templateQuestions(), "questions-template", "csv")} className="inline-flex items-center gap-1 text-red-400 hover:underline">
                      <Download className="h-3 w-3" />
                      CSV template
                    </button>
                  </div>
                </div>
              </div>
            )}

            {source === "test" && (
              <div>
                <Select value={sourceTestId} onChange={(e) => chooseTest(e.target.value)}>
                  <option value="">{tests === null ? "Loading tests…" : tests.length ? "Choose a test to copy from…" : "No other tests with questions"}</option>
                  {(tests ?? []).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title} ({t.questionCount})
                    </option>
                  ))}
                </Select>
                {sourceQuestions.length > 0 && (
                  <div className="mt-3">
                    <div className="mb-2 flex items-center justify-between text-xs text-gray-500">
                      <span>
                        {picked.size} of {sourceQuestions.length} selected
                      </span>
                      <button
                        type="button"
                        onClick={() => setPicked(picked.size === sourceQuestions.length ? new Set() : new Set(sourceQuestions.map((q) => q.id)))}
                        className="text-red-400 hover:underline"
                      >
                        {picked.size === sourceQuestions.length ? "Select none" : "Select all"}
                      </button>
                    </div>
                    <div className="max-h-[340px] space-y-1 overflow-y-auto pr-1">
                      {sourceQuestions.map((q, i) => (
                        <label key={q.id} className="flex cursor-pointer items-start gap-2 rounded px-2 py-1.5 text-sm text-gray-300 hover:bg-white/[0.03]">
                          <input
                            type="checkbox"
                            checked={picked.has(q.id)}
                            onChange={(e) => {
                              const next = new Set(picked);
                              if (e.target.checked) next.add(q.id);
                              else next.delete(q.id);
                              setPicked(next);
                            }}
                            className="mt-1 accent-red-600"
                          />
                          <span>
                            <span className="text-gray-500">{i + 1}. </span>
                            {q.prompt || <i className="text-gray-500">Untitled</i>}
                            <span className="ml-1 text-xs text-gray-600">· {QUESTION_TYPE_LABELS[q.type]}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                <p className="mt-3 text-xs text-gray-500">Copies are independent — editing them here never changes the other test.</p>
              </div>
            )}

            {source === "paste" && (
              <div>
                <Textarea
                  rows={16}
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder={PASTE_EXAMPLE}
                  className="font-[family-name:var(--font-mono)] text-xs"
                />
                <div className="mt-2 space-y-0.5 text-[11px] text-gray-500">
                  <p>
                    One question per line. <code className="text-gray-300">- option</code> lines are choices; end a correct one with{" "}
                    <code className="text-gray-300">*</code>.
                  </p>
                  <p>
                    <code className="text-gray-300">= answer</code> sets accepted short answers (separate with <code className="text-gray-300">|</code>). Tags:{" "}
                    <code className="text-gray-300">[short] [long] [number] [checkbox] [dropdown] [true] [false]</code>, points:{" "}
                    <code className="text-gray-300">(5 pts)</code>.
                  </p>
                  {!pasteText && (
                    <button type="button" onClick={() => setPasteText(PASTE_EXAMPLE)} className="text-red-400 hover:underline">
                      Load the example
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          <ImportPreview result={result} />
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={close}>
            Cancel
          </Button>
          {hasQuestions && (
            <Button variant="outline" disabled={!count} onClick={() => apply(true)}>
              Replace all
            </Button>
          )}
          <Button disabled={!count} onClick={() => apply(false)} className="bg-[#dc2626] hover:bg-[#b91c1c]">
            <Plus className="mr-2 h-4 w-4" />
            Add {count || ""} question{count === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ImportPreview({ result }: { result: ImportResult }) {
  const flagged = result.questions.filter((q) => questionProblems(q).length > 0).length;
  return (
    <div className="max-h-[460px] overflow-y-auto rounded-lg border border-[#1e1e28] p-3">
      <p className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500">
        Will add {result.questions.length} question{result.questions.length === 1 ? "" : "s"}
        {flagged > 0 && <span className="ml-2 normal-case tracking-normal text-amber-400">· {flagged} need a fix after importing</span>}
      </p>
      {result.warnings.length > 0 && (
        <ul className="mb-3 space-y-1 rounded-lg border border-amber-500/30 bg-amber-500/5 p-2 text-xs text-amber-200">
          {result.warnings.slice(0, 12).map((w, i) => (
            <li key={i} className="flex gap-1.5">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
              {w}
            </li>
          ))}
          {result.warnings.length > 12 && <li>…and {result.warnings.length - 12} more</li>}
        </ul>
      )}
      {result.questions.length === 0 && result.warnings.length === 0 && (
        <p className="py-8 text-center text-xs text-gray-600">The questions will appear here, exactly as they will be imported.</p>
      )}
      <ol className="space-y-2">
        {result.questions.map((q, i) => {
          const Icon = QUESTION_TYPE_ICONS[q.type];
          const problems = questionProblems(q);
          return (
            <li key={q.id} className="rounded border border-[#1e1e28] px-3 py-2 text-xs">
              <div className="flex items-center gap-2 text-gray-200">
                <span className="text-gray-500">{i + 1}.</span>
                <Icon className="h-3.5 w-3.5 shrink-0 text-red-400" />
                <span className="flex-1">{q.prompt}</span>
                <span className="shrink-0 text-gray-500">
                  {q.points} pt{q.points === 1 ? "" : "s"}
                </span>
              </div>
              <p className="mt-0.5 text-gray-500">
                {QUESTION_TYPE_LABELS[q.type]}
                {q.options.length > 0 && q.type !== "truefalse" && ` · ${q.options.length} options`}
                {q.correct.length > 0 && ` · correct: ${q.options.filter((o) => q.correct.includes(o.id)).map((o) => o.text).join(", ")}`}
                {q.accepted.length > 0 && ` · accepts: ${q.accepted.join(", ")}`}
                {q.type === "number" && q.numberAnswer !== null && q.numberAnswer !== undefined && ` · = ${q.numberAnswer}${q.tolerance ? ` ± ${q.tolerance}` : ""}`}
                {q.type === "short" && q.accepted.length === 0 && " · hand-marked"}
              </p>
              {problems.length > 0 && <p className="mt-0.5 text-amber-400">{problems.join(" · ")}</p>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
