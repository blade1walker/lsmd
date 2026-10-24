"use client";

import { useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  CHOICE_TYPES,
  QUESTION_TYPES,
  QUESTION_TYPE_LABELS,
  needsManualGrading,
  newId,
  questionProblems,
  retypeQuestion,
  type TestQuestion,
} from "@/lib/tests";
import { QUESTION_TYPE_ICONS } from "./QuestionTypeIcons";

const fieldLabel = "mb-1 block text-[11px] font-medium uppercase tracking-wider text-gray-500";

/**
 * One question in the builder. Collapsed it reads as a summary line; open, it
 * edits the question in place — the correct answer is marked right on the
 * option it belongs to, rather than picked again from a separate list.
 */
export function QuestionEditor({
  question: q,
  index,
  count,
  open,
  readOnly,
  onToggle,
  onChange,
  onMove,
  onDuplicate,
  onDelete,
}: {
  question: TestQuestion;
  index: number;
  count: number;
  open: boolean;
  readOnly?: boolean;
  onToggle: () => void;
  onChange: (q: TestQuestion) => void;
  onMove: (delta: number) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const problems = questionProblems(q);
  const Icon = QUESTION_TYPE_ICONS[q.type];
  const set = (patch: Partial<TestQuestion>) => onChange({ ...q, ...patch });

  return (
    <div
      className={`rounded-xl border bg-card transition-colors ${
        open ? "border-red-500/40" : problems.length ? "border-amber-500/30" : "border-[#1e1e28] hover:border-[#2e2e3a]"
      }`}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <button type="button" onClick={onToggle} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          {open ? <ChevronDown className="h-4 w-4 shrink-0 text-gray-500" /> : <ChevronRight className="h-4 w-4 shrink-0 text-gray-500" />}
          <span className="font-[family-name:var(--font-mono)] text-xs text-gray-500">Q{index + 1}</span>
          <Icon className="h-4 w-4 shrink-0 text-red-400" />
          <span className={`truncate text-sm ${q.prompt ? "text-gray-200" : "italic text-gray-500"}`}>
            {q.prompt || "Untitled question"}
          </span>
        </button>
        <div className="flex shrink-0 items-center gap-2 text-xs text-gray-500">
          {problems.length > 0 && (
            <span className="inline-flex items-center gap-1 text-amber-400" title={problems.join("\n")}>
              <AlertTriangle className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{problems[0]}</span>
            </span>
          )}
          {needsManualGrading(q) && <span className="hidden rounded bg-sky-500/10 px-1.5 py-0.5 text-sky-300 sm:inline">hand-marked</span>}
          <span>
            {q.points} pt{q.points === 1 ? "" : "s"}
          </span>
        </div>
        {!readOnly && (
          <div className="flex shrink-0 items-center">
            <IconButton title="Move up" disabled={index === 0} onClick={() => onMove(-1)}>
              <ArrowUp className="h-3.5 w-3.5" />
            </IconButton>
            <IconButton title="Move down" disabled={index === count - 1} onClick={() => onMove(1)}>
              <ArrowDown className="h-3.5 w-3.5" />
            </IconButton>
          </div>
        )}
      </div>

      {open && (
        <fieldset disabled={readOnly} className="space-y-4 border-t border-[#1e1e28] px-4 py-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
            <div>
              <label className={fieldLabel}>Question</label>
              <Textarea
                autoFocus={!q.prompt}
                rows={2}
                value={q.prompt}
                onChange={(e) => set({ prompt: e.target.value })}
                placeholder="Type the question…"
              />
            </div>
            <div>
              <label className={fieldLabel}>Type</label>
              <Select value={q.type} onChange={(e) => onChange(retypeQuestion(q, e.target.value as TestQuestion["type"]))}>
                {QUESTION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {QUESTION_TYPE_LABELS[t]}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {q.description !== undefined ? (
            <div>
              <label className={fieldLabel}>Details (optional)</label>
              <Textarea
                rows={2}
                value={q.description}
                onChange={(e) => set({ description: e.target.value })}
                placeholder="A scenario, context or a note on how to answer"
              />
            </div>
          ) : (
            <button type="button" onClick={() => set({ description: "" })} className="text-xs text-gray-500 hover:text-gray-300">
              + Add details or a scenario
            </button>
          )}

          <AnswerEditor q={q} set={set} />

          <div className="flex flex-wrap items-end gap-4 border-t border-[#1e1e28] pt-4">
            <div className="w-24">
              <label className={fieldLabel}>Points</label>
              <Input
                type="number"
                min={0}
                step="any"
                value={q.points}
                onChange={(e) => set({ points: Math.max(0, Number(e.target.value) || 0) })}
              />
            </div>
            <Toggle checked={q.required} onChange={(v) => set({ required: v })} label="Required" />
            {q.type === "multiple" && (
              <Toggle
                checked={!!q.partialCredit}
                onChange={(v) => set({ partialCredit: v })}
                label="Partial credit"
                hint="A share of the points per correct tick; wrong ticks take one back"
              />
            )}
            {!readOnly && (
              <div className="ml-auto flex items-center gap-1">
                <IconButton title="Duplicate question" onClick={onDuplicate}>
                  <Copy className="h-4 w-4" />
                </IconButton>
                <IconButton title="Delete question" onClick={onDelete}>
                  <Trash2 className="h-4 w-4 text-red-400" />
                </IconButton>
              </div>
            )}
          </div>

          <div>
            <label className={fieldLabel}>
              {q.type === "long" ? "Marking guide / model answer (optional)" : "Explanation (optional)"}
            </label>
            <Textarea
              rows={2}
              value={q.explanation ?? ""}
              onChange={(e) => set({ explanation: e.target.value || undefined })}
              placeholder={
                q.type === "long"
                  ? "What a full-marks answer covers — shown to the grader, and to the member if correct answers are shown"
                  : "Why the answer is right — shown after submitting, if correct answers are shown"
              }
            />
          </div>
        </fieldset>
      )}
    </div>
  );
}

function AnswerEditor({ q, set }: { q: TestQuestion; set: (patch: Partial<TestQuestion>) => void }) {
  if (q.type === "truefalse") {
    return (
      <div>
        <label className={fieldLabel}>Correct answer</label>
        <div className="flex gap-2">
          {q.options.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => set({ correct: [o.id] })}
              className={`flex items-center gap-2 rounded-lg border px-5 py-2 text-sm ${
                q.correct.includes(o.id)
                  ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-200"
                  : "border-[#1e1e28] text-gray-400 hover:text-gray-200"
              }`}
            >
              {q.correct.includes(o.id) && <Check className="h-4 w-4" />}
              {o.text}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (CHOICE_TYPES.includes(q.type)) return <OptionsEditor q={q} set={set} />;

  if (q.type === "short") return <AcceptedAnswers q={q} set={set} />;

  if (q.type === "number") {
    return (
      <div className="flex flex-wrap gap-3">
        <div className="w-40">
          <label className={fieldLabel}>Correct answer</label>
          <Input
            type="number"
            step="any"
            value={q.numberAnswer ?? ""}
            onChange={(e) => set({ numberAnswer: e.target.value === "" ? null : Number(e.target.value) })}
            placeholder="e.g. 110"
          />
        </div>
        <div className="w-40">
          <label className={fieldLabel}>Accept ± (optional)</label>
          <Input
            type="number"
            step="any"
            min={0}
            value={q.tolerance ?? ""}
            onChange={(e) => set({ tolerance: e.target.value === "" ? null : Math.abs(Number(e.target.value)) })}
            placeholder="0"
          />
        </div>
        {q.numberAnswer !== null && q.numberAnswer !== undefined && (q.tolerance ?? 0) > 0 && (
          <p className="self-end pb-2 text-xs text-gray-500">
            Anything from {q.numberAnswer - (q.tolerance ?? 0)} to {q.numberAnswer + (q.tolerance ?? 0)} is marked correct.
          </p>
        )}
      </div>
    );
  }

  return (
    <p className="rounded-lg border border-dashed border-sky-500/30 bg-sky-500/5 px-3 py-2 text-xs text-sky-200/80">
      Members write a paragraph. A grader reads it on the Results tab and awards up to {q.points} point
      {q.points === 1 ? "" : "s"}.
    </p>
  );
}

function OptionsEditor({ q, set }: { q: TestQuestion; set: (patch: Partial<TestQuestion>) => void }) {
  const many = q.type === "multiple";

  const toggleCorrect = (id: string) => {
    if (many) set({ correct: q.correct.includes(id) ? q.correct.filter((c) => c !== id) : [...q.correct, id] });
    else set({ correct: [id] });
  };

  const addOption = (after?: number) => {
    const option = { id: newId(), text: "" };
    const options = [...q.options];
    options.splice(after === undefined ? options.length : after + 1, 0, option);
    set({ options });
    // Focus lands on the new option once it renders.
    setTimeout(() => document.getElementById(`opt-${option.id}`)?.focus(), 0);
  };

  const removeOption = (id: string) =>
    set({ options: q.options.filter((o) => o.id !== id), correct: q.correct.filter((c) => c !== id) });

  /** Pasting several lines into one option splits them into one option per line. */
  const pasteLines = (index: number, text: string) => {
    const lines = text.split(/\r?\n/).map((l) => l.replace(/^[-•*]\s*|^[a-hA-H][.)]\s*/, "").trim()).filter(Boolean);
    if (lines.length < 2) return false;
    const options = [...q.options];
    const fresh = lines.map((text, n) => ({ id: `${newId()}${n}`, text }));
    // An empty option is replaced by the pasted list; a filled one keeps its text and the list follows it.
    if (options[index]?.text) options.splice(index + 1, 0, ...fresh);
    else options.splice(index, 1, ...fresh);
    set({ options });
    return true;
  };

  return (
    <div>
      <label className={fieldLabel}>
        Options — {many ? "tick every correct one" : "click the circle next to the correct one"}
      </label>
      <div className="space-y-2">
        {q.options.map((o, i) => {
          const correct = q.correct.includes(o.id);
          return (
            <div key={o.id} className="flex items-center gap-2">
              <button
                type="button"
                title={correct ? "Correct answer" : "Mark as correct"}
                onClick={() => toggleCorrect(o.id)}
                className={`flex h-6 w-6 shrink-0 items-center justify-center border transition-colors ${
                  many ? "rounded" : "rounded-full"
                } ${correct ? "border-emerald-500 bg-emerald-500 text-white" : "border-gray-600 text-transparent hover:border-emerald-500/60 hover:text-emerald-500/60"}`}
              >
                <Check className="h-3.5 w-3.5" />
              </button>
              <Input
                id={`opt-${o.id}`}
                value={o.text}
                onChange={(e) => set({ options: q.options.map((x) => (x.id === o.id ? { ...x, text: e.target.value } : x)) })}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addOption(i);
                  } else if (e.key === "Backspace" && !o.text && q.options.length > 2) {
                    e.preventDefault();
                    const neighbour = q.options[i - 1] ?? q.options[i + 1];
                    removeOption(o.id);
                    setTimeout(() => document.getElementById(`opt-${neighbour.id}`)?.focus(), 0);
                  }
                }}
                onPaste={(e) => {
                  if (pasteLines(i, e.clipboardData.getData("text"))) e.preventDefault();
                }}
                placeholder={`Option ${i + 1}`}
                className={correct ? "border-emerald-500/40" : undefined}
              />
              <button
                type="button"
                title="Remove option"
                disabled={q.options.length <= 2}
                onClick={() => removeOption(o.id)}
                className="p-1 text-gray-600 hover:text-red-400 disabled:opacity-30"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
      <button type="button" onClick={() => addOption()} className="mt-2 inline-flex items-center gap-1 text-xs text-gray-400 hover:text-white">
        <Plus className="h-3.5 w-3.5" />
        Add option
      </button>
      <p className="mt-1 text-[11px] text-gray-600">
        Tip: press Enter for the next option, or paste a list to add several at once.
      </p>
    </div>
  );
}

function AcceptedAnswers({ q, set }: { q: TestQuestion; set: (patch: Partial<TestQuestion>) => void }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const values = draft.split("|").map((v) => v.trim()).filter((v) => v && !q.accepted.includes(v));
    if (values.length) set({ accepted: [...q.accepted, ...values] });
    setDraft("");
  };
  return (
    <div>
      <label className={fieldLabel}>Accepted answers</label>
      <div className="flex flex-wrap gap-1.5">
        {q.accepted.map((a) => (
          <span key={a} className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-200">
            {a}
            <button type="button" onClick={() => set({ accepted: q.accepted.filter((x) => x !== a) })} className="hover:text-white">
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          onBlur={add}
          placeholder="Type an accepted answer and press Enter"
        />
      </div>
      <p className="mt-1 text-[11px] text-gray-600">
        {q.accepted.length
          ? "Marked automatically. Capitals, extra spaces and punctuation are ignored. Add every spelling you accept."
          : "Leave empty to have a grader mark this answer by hand."}
      </p>
    </div>
  );
}

function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 pb-2 text-sm text-gray-300" title={hint}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-red-600" />
      {label}
    </label>
  );
}

function IconButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className="rounded p-1.5 text-gray-500 hover:bg-white/5 hover:text-white disabled:opacity-30" {...props}>
      {children}
    </button>
  );
}
