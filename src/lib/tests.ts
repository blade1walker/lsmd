/**
 * Tests & quizzes — the question model, grading and the paste importer.
 *
 * Shared by the builder, the test-taking page and the routes behind them, so
 * the score a member sees on submit is computed by exactly the code the
 * server stored it with. Nothing here touches the database.
 */

import { isRankAtLeast } from "./constants";

export const QUESTION_TYPES = ["single", "multiple", "truefalse", "dropdown", "short", "long", "number"] as const;

export type QuestionType = (typeof QUESTION_TYPES)[number];

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  single: "Multiple choice",
  multiple: "Checkboxes",
  truefalse: "True / False",
  dropdown: "Dropdown",
  short: "Short answer",
  long: "Long answer",
  number: "Number",
};

export const QUESTION_TYPE_HINTS: Record<QuestionType, string> = {
  single: "Pick one correct option",
  multiple: "Tick every correct option",
  truefalse: "A statement that is true or false",
  dropdown: "One option, from a list",
  short: "A word or a line — auto-marked against accepted answers",
  long: "A written paragraph, marked by hand",
  number: "A numeric answer, with optional tolerance",
};

/** Types answered by picking from `options`. */
export const CHOICE_TYPES: QuestionType[] = ["single", "multiple", "truefalse", "dropdown"];

function isQuestionType(value: unknown): value is QuestionType {
  return typeof value === "string" && (QUESTION_TYPES as readonly string[]).includes(value);
}

export const TEST_STATUSES = ["Draft", "Published", "Closed"] as const;
export type TestStatus = (typeof TEST_STATUSES)[number];

export const STATUS_STYLES: Record<string, string> = {
  Draft: "bg-gray-500/15 text-gray-300",
  Published: "bg-emerald-500/15 text-emerald-300",
  Closed: "bg-amber-500/15 text-amber-300",
};

export const MAX_QUESTIONS = 200;
const MAX_ANSWER_LENGTH = 10_000;
/** Seconds past the time limit a submission is still accepted, for a slow connection. */
export const TIME_LIMIT_GRACE_SECONDS = 60;

export interface QuestionOption {
  id: string;
  text: string;
}

export interface TestQuestion {
  id: string;
  type: QuestionType;
  prompt: string;
  /** Extra context under the prompt — a scenario, a note on format. */
  description?: string;
  options: QuestionOption[];
  /** Option ids, for the choice types. */
  correct: string[];
  /**
   * Short answer: accepted answers, compared ignoring case, spacing and
   * punctuation. Empty means the question is marked by hand.
   */
  accepted: string[];
  /** Number: the right answer, and how far off still counts. */
  numberAnswer?: number | null;
  tolerance?: number | null;
  points: number;
  required: boolean;
  /** Shown to the member after submitting, when results are shown. */
  explanation?: string;
  /** Checkboxes: a point share for each correct tick instead of all-or-nothing. */
  partialCredit?: boolean;
}

/** What a member sends back: an option id, several, or text. */
export type AnswerValue = string | string[];
export type Answers = Record<string, AnswerValue>;

export function newId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

const TRUE_FALSE = (): QuestionOption[] => [
  { id: "true", text: "True" },
  { id: "false", text: "False" },
];

export function blankQuestion(type: QuestionType): TestQuestion {
  const options =
    type === "truefalse"
      ? TRUE_FALSE()
      : CHOICE_TYPES.includes(type)
        ? [
            { id: newId(), text: "Option 1" },
            { id: newId(), text: "Option 2" },
          ]
        : [];
  return {
    id: newId(),
    type,
    prompt: "",
    options,
    correct: [],
    accepted: [],
    numberAnswer: null,
    tolerance: null,
    points: type === "long" ? 5 : 1,
    required: true,
  };
}

/** Retypes a question, keeping what still applies so switching back and forth loses nothing typed. */
export function retypeQuestion(q: TestQuestion, type: QuestionType): TestQuestion {
  if (q.type === type) return q;
  const next: TestQuestion = { ...q, type };
  if (type === "truefalse") {
    next.options = TRUE_FALSE();
    next.correct = q.correct.filter((c) => c === "true" || c === "false").slice(0, 1);
  } else if (CHOICE_TYPES.includes(type)) {
    if (q.type === "truefalse" || q.options.length === 0) {
      next.options = blankQuestion(type).options;
      next.correct = [];
    }
    // Moving from checkboxes to a one-answer type keeps only the first correct option.
    if (type !== "multiple") next.correct = next.correct.slice(0, 1);
  }
  return next;
}

/** Whether this question can only be marked by a person. */
export function needsManualGrading(q: TestQuestion): boolean {
  if (q.type === "long") return true;
  if (q.type === "short") return q.accepted.length === 0;
  return false;
}

/**
 * What stops a question from being answerable or markable. Shown on the
 * question card in the builder and checked again before publishing.
 */
export function questionProblems(q: TestQuestion): string[] {
  const problems: string[] = [];
  if (!q.prompt.trim()) problems.push("Write the question");
  if (CHOICE_TYPES.includes(q.type)) {
    if (q.options.filter((o) => o.text.trim()).length < 2) problems.push("Add at least two options");
    if (q.correct.length === 0) problems.push("Mark the correct answer");
  }
  if (q.type === "number" && (q.numberAnswer === null || q.numberAnswer === undefined || !Number.isFinite(q.numberAnswer))) {
    problems.push("Enter the correct number");
  }
  if (!(q.points >= 0)) problems.push("Points must be zero or more");
  return problems;
}

/** Reads stored questions defensively — the column is JSON, so nothing guarantees its shape. */
export function parseQuestions(raw: unknown): TestQuestion[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, MAX_QUESTIONS).flatMap((item): TestQuestion[] => {
    if (!item || typeof item !== "object") return [];
    const r = item as Record<string, unknown>;
    if (!isQuestionType(r.type)) return [];
    const strings = (v: unknown) => (Array.isArray(v) ? v.map((s) => String(s ?? "").trim()).filter(Boolean) : []);
    const options = Array.isArray(r.options)
      ? r.options.flatMap((o): QuestionOption[] => {
          if (!o || typeof o !== "object") return [];
          const opt = o as Record<string, unknown>;
          const id = String(opt.id ?? "").trim();
          return id ? [{ id, text: String(opt.text ?? "").slice(0, 500) }] : [];
        })
      : [];
    const optionIds = new Set(options.map((o) => o.id));
    const num = (v: unknown) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
    return [
      {
        id: String(r.id ?? "") || newId(),
        type: r.type,
        prompt: String(r.prompt ?? "").slice(0, 2000),
        description: r.description ? String(r.description).slice(0, 4000) : undefined,
        options: r.type === "truefalse" ? TRUE_FALSE() : options,
        correct: [...new Set(strings(r.correct))].filter((c) => (r.type === "truefalse" ? c === "true" || c === "false" : optionIds.has(c))),
        accepted: [...new Set(strings(r.accepted))].slice(0, 50),
        numberAnswer: num(r.numberAnswer),
        tolerance: num(r.tolerance),
        points: Math.max(0, Math.min(1000, Number(r.points) || 0)),
        required: r.required !== false,
        explanation: r.explanation ? String(r.explanation).slice(0, 4000) : undefined,
        partialCredit: r.partialCredit === true,
      },
    ];
  });
}

/** The question as a member sees it while taking the test — no answers. */
export type PublicQuestion = Omit<TestQuestion, "correct" | "accepted" | "numberAnswer" | "tolerance" | "explanation">;

export function publicQuestions(questions: TestQuestion[]): PublicQuestion[] {
  return questions.map((q) => ({
    id: q.id,
    type: q.type,
    prompt: q.prompt,
    description: q.description,
    options: q.options,
    points: q.points,
    required: q.required,
    partialCredit: q.partialCredit,
  }));
}

export function totalPoints(questions: TestQuestion[]): number {
  return questions.reduce((sum, q) => sum + q.points, 0);
}

/** Lowercase, collapsed spacing, no punctuation — "CPR." and " cpr" are the same answer. */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function isAnswered(value: AnswerValue | undefined): boolean {
  if (value === undefined) return false;
  return Array.isArray(value) ? value.length > 0 : value.trim() !== "";
}

/** Keeps only answers to questions on the test, of the right shape and length. */
export function cleanAnswers(raw: unknown, questions: TestQuestion[]): Answers {
  const input = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const out: Answers = {};
  for (const q of questions) {
    const v = input[q.id];
    if (v === undefined || v === null) continue;
    if (q.type === "multiple") {
      const ids = new Set(q.options.map((o) => o.id));
      const picked = (Array.isArray(v) ? v : [v]).map(String).filter((id) => ids.has(id));
      if (picked.length) out[q.id] = [...new Set(picked)];
    } else if (CHOICE_TYPES.includes(q.type)) {
      const id = String(Array.isArray(v) ? v[0] ?? "" : v);
      if (q.options.some((o) => o.id === id)) out[q.id] = id;
    } else {
      const text = String(Array.isArray(v) ? v.join(" ") : v).slice(0, MAX_ANSWER_LENGTH);
      if (text.trim()) out[q.id] = text;
    }
  }
  return out;
}

/**
 * Points for one answer, or null when a person has to mark it. Checkboxes are
 * all-or-nothing unless the question allows partial credit, in which case each
 * correct tick earns a share and each wrong tick takes one back.
 */
export function autoScore(q: TestQuestion, value: AnswerValue | undefined): number | null {
  if (needsManualGrading(q)) return null;
  if (!isAnswered(value)) return 0;

  switch (q.type) {
    case "multiple": {
      const picked = new Set(Array.isArray(value) ? value : [value as string]);
      const correct = new Set(q.correct);
      if (q.partialCredit && correct.size > 0) {
        let hits = 0;
        for (const id of picked) hits += correct.has(id) ? 1 : -1;
        return Math.max(0, Math.round((q.points * hits) / correct.size * 100) / 100);
      }
      const exact = picked.size === correct.size && [...picked].every((id) => correct.has(id));
      return exact ? q.points : 0;
    }
    case "single":
    case "dropdown":
    case "truefalse":
      return q.correct.includes(value as string) ? q.points : 0;
    case "short": {
      const given = normalizeText(String(value));
      return q.accepted.some((a) => normalizeText(a) === given) ? q.points : 0;
    }
    case "number": {
      const given = Number(String(value).replace(/,/g, "").trim());
      if (!Number.isFinite(given) || q.numberAnswer === null || q.numberAnswer === undefined) return 0;
      return Math.abs(given - q.numberAnswer) <= Math.abs(q.tolerance ?? 0) ? q.points : 0;
    }
    default:
      return null;
  }
}

export interface GradeResult {
  /** Points per question; null where a person still has to mark it. */
  points: Record<string, number | null>;
  earned: number;
  total: number;
  /** Percent, or null while anything is still to be marked by hand. */
  score: number | null;
  pendingManual: number;
}

/**
 * Marks an attempt. `manual` holds the points a grader awarded by hand, which
 * override the automatic mark for that question — a grader can also correct
 * an auto-marked answer that was right in a way the key did not anticipate.
 */
export function grade(questions: TestQuestion[], answers: Answers, manual: Record<string, number> = {}): GradeResult {
  const points: Record<string, number | null> = {};
  let earned = 0;
  let pendingManual = 0;
  for (const q of questions) {
    const override = manual[q.id];
    // An unanswered hand-marked question needs no one to read it: it scores 0.
    const p =
      typeof override === "number"
        ? Math.max(0, Math.min(q.points, override))
        : needsManualGrading(q) && !isAnswered(answers[q.id])
          ? 0
          : autoScore(q, answers[q.id]);
    points[q.id] = p;
    if (p === null) pendingManual += 1;
    else earned += p;
  }
  const total = totalPoints(questions);
  const score = pendingManual > 0 ? null : total > 0 ? Math.round((earned / total) * 100) : 100;
  return { points, earned: Math.round(earned * 100) / 100, total, score, pendingManual };
}

/** Deterministic shuffle, so a member reloading the page mid-test sees the same order. */
export function seededShuffle<T>(items: T[], seed: string): T[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  const rand = () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ─── Paste importer ────────────────────────────────────────────────────────

export const PASTE_EXAMPLE = `1. What does CPR stand for? [short]
   = Cardiopulmonary resuscitation
2. Which of these are vital signs? [checkbox]
   - Pulse *
   - Blood pressure *
   - Hair colour
3. What is the first step at any scene?
   - Ensure scene safety *
   - Start compressions
   - Call for backup
4. An unconscious patient with a pulse goes in the recovery position. [true]
5. Compressions per minute for adult CPR? [number] = 110 ± 10
6. Describe how you would triage a multi-casualty incident. [long] (10 pts)`;

/**
 * Turns plain text into questions, so a test written in a document or a
 * Discord message can be pasted in instead of rebuilt by hand.
 *
 *  - Each numbered (or unindented) line starts a question.
 *  - `- option` lines are choices; a trailing `*` marks a correct one.
 *  - `= answer` lines are accepted answers for a short answer.
 *  - Tags: [short] [long] [number] [checkbox] [dropdown] [true] [false],
 *    and (N pts) sets the points.
 *  - A question with choices and no tag is multiple choice, or checkboxes
 *    when more than one choice is starred.
 */
export function parseQuestionText(text: string): { questions: TestQuestion[]; warnings: string[] } {
  const questions: TestQuestion[] = [];
  const warnings: string[] = [];
  let current: (TestQuestion & { tag?: string; pointsSet?: boolean }) | null = null;

  const finish = () => {
    if (!current) return;
    const q = current;
    const { tag, pointsSet } = q;
    delete q.tag;
    delete q.pointsSet;
    if (tag === "true" || tag === "false") {
      q.type = "truefalse";
      q.options = TRUE_FALSE();
      q.correct = [tag];
    } else if (q.options.length > 0) {
      q.type = tag === "checkbox" || q.correct.length > 1 ? "multiple" : tag === "dropdown" ? "dropdown" : "single";
    } else if (tag === "long") q.type = "long";
    else if (tag === "number") q.type = "number";
    else if (tag === "truefalse") {
      q.type = "truefalse";
      q.options = TRUE_FALSE();
    } else q.type = "short";
    if (q.type === "long" && !pointsSet) q.points = 5;
    if (questionProblems(q).length && q.prompt) warnings.push(`"${q.prompt.slice(0, 40)}": ${questionProblems(q).join(", ").toLowerCase()}`);
    if (q.prompt) questions.push(q);
    current = null;
  };

  for (const rawLine of text.split(/\r?\n/)) {
    if (!rawLine.trim()) continue;
    const indented = /^\s+/.test(rawLine);
    const line = rawLine.trim();

    // "- option" anywhere, or "a) option" when indented under its question.
    const option = /^(?:[-•*]|([a-hA-H])[.)])\s+(.*)$/.exec(line);
    if (option && current && (!option[1] || indented)) {
      let optText = option[2].trim();
      const isCorrect = /\s*\*$/.test(optText) || /^\*\s*/.test(optText) || /\(correct\)$/i.test(optText);
      optText = optText.replace(/\s*\*$/, "").replace(/^\*\s*/, "").replace(/\s*\(correct\)$/i, "").trim();
      const id = newId() + current.options.length;
      current.options.push({ id, text: optText });
      if (isCorrect) current.correct.push(id);
      continue;
    }

    const accepted = /^=\s*(.+)$/.exec(line);
    if (accepted && current) {
      current.accepted.push(...accepted[1].split("|").map((a) => a.trim()).filter(Boolean));
      continue;
    }

    if (indented && current) {
      current.description = current.description ? `${current.description}\n${line}` : line;
      continue;
    }

    finish();
    let prompt = line.replace(/^(?:Q?\d+[.):]|Q:)\s*/i, "");
    let tag: string | undefined;
    let points = 1;

    const pts = /\((\d+(?:\.\d+)?)\s*(?:pts?|points?|marks?)\)/i.exec(prompt);
    if (pts) {
      points = Number(pts[1]);
      prompt = prompt.replace(pts[0], "");
    }

    let numberAnswer: number | null = null;
    let tolerance: number | null = null;
    const inlineAnswer = /\[(number|short)\]\s*=\s*(.+)$/i.exec(prompt);
    if (inlineAnswer) {
      prompt = prompt.replace(/\s*=\s*.+$/, "");
      if (inlineAnswer[1].toLowerCase() === "number") {
        const m = /(-?[\d.]+)\s*(?:±|\+\/-|\+-)?\s*([\d.]+)?/.exec(inlineAnswer[2]);
        if (m) {
          numberAnswer = Number(m[1]);
          tolerance = m[2] ? Number(m[2]) : null;
        }
      }
    }

    const tagMatch = /\[(short|long|paragraph|number|checkbox(?:es)?|multi(?:ple)?|dropdown|true|false|t\/f|truefalse)\]/i.exec(prompt);
    if (tagMatch) {
      const t = tagMatch[1].toLowerCase();
      tag =
        t === "paragraph" ? "long" : t.startsWith("checkbox") || t.startsWith("multi") ? "checkbox" : t === "t/f" ? "truefalse" : t;
      prompt = prompt.replace(tagMatch[0], "");
    }

    current = {
      ...blankQuestion("short"),
      prompt: prompt.replace(/\s+/g, " ").trim(),
      points,
      pointsSet: !!pts,
      numberAnswer,
      tolerance,
      tag,
    };
    if (inlineAnswer && inlineAnswer[1].toLowerCase() === "short") {
      current.accepted = inlineAnswer[2].split("|").map((a) => a.trim()).filter(Boolean);
    }
  }
  finish();
  return { questions, warnings };
}

// ─── Shapes the API returns ────────────────────────────────────────────────

export interface TestSettings {
  title: string;
  description: string | null;
  instructions: string | null;
  status: TestStatus;
  passingScore: number;
  timeLimitMinutes: number | null;
  maxAttempts: number | null;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  showResults: boolean;
  showCorrectAnswers: boolean;
  showOnHomepage: boolean;
  minRank: string | null;
  examMode: boolean;
  maxTabSwitches: number;
}

/**
 * Whether someone may take a test with this rank requirement. A super admin
 * always may, so command can sit a test to check it; anyone else needs a
 * roster rank at or above the minimum. No minimum means any roster member.
 */
export function meetsMinRank(
  minRank: string | null | undefined,
  viewer: { rank: string | null; isSuperAdmin?: boolean }
): boolean {
  if (!minRank || viewer.isSuperAdmin) return true;
  return isRankAtLeast(viewer.rank, minRank);
}

/** The line shown to someone who does not meet the requirement. */
export function minRankMessage(minRank: string): string {
  return `You require this minimum rank: ${minRank}`;
}

export type AttemptStatus = "In Progress" | "Awaiting Grading" | "Graded";

export interface AttemptSummary {
  id: string;
  memberName: string;
  callSign: string | null;
  discordId: string;
  status: AttemptStatus;
  score: number | null;
  passed: boolean | null;
  earned: number | null;
  total: number;
  startedAt: string;
  submittedAt: string | null;
  gradedBy: string | null;
  tabSwitches: number;
  autoSubmittedReason: string | null;
}
