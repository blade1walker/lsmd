/**
 * Importing and exporting test questions — spreadsheets (Excel or CSV), JSON,
 * and copies from another test. Client-safe and database-free, like tests.ts.
 *
 * A spreadsheet has one question per row. Columns are matched by name,
 * ignoring case and spacing, so a sheet someone typed up by hand imports
 * without being reshaped first:
 *
 *   Question · Type · Options · Answer · Points · Required · Details · Explanation · Partial credit
 *
 * Options go in one cell split by "|", or in their own Option 1… / Option A…
 * columns. The Answer is the correct option's text or letter ("B", "A, C"),
 * the accepted answers of a short question ("CPR | cardiopulmonary
 * resuscitation"), a number ("110 ± 10"), or True / False.
 */

import {
  CHOICE_TYPES,
  QUESTION_TYPE_LABELS,
  blankQuestion,
  newId,
  normalizeText,
  parseQuestionText,
  parseQuestions,
  type QuestionType,
  type TestQuestion,
} from "./";

export interface ImportResult {
  questions: TestQuestion[];
  /** Rows that were skipped or read with a guess, in words a person can act on. */
  warnings: string[];
}

/** A copy with fresh question and option ids, so it can sit beside the original. */
export function cloneQuestion(q: TestQuestion): TestQuestion {
  const ids = new Map(q.options.map((o, i) => [o.id, q.type === "truefalse" ? o.id : `${newId()}${i}`]));
  return {
    ...q,
    id: newId(),
    options: q.options.map((o) => ({ ...o, id: ids.get(o.id)! })),
    correct: q.correct.map((c) => ids.get(c) ?? c),
    accepted: [...q.accepted],
  };
}

const TYPE_SYNONYMS: [QuestionType, string[]][] = [
  ["multiple", ["checkbox", "checkboxes", "multi", "multiselect", "multipleanswer", "multipleanswers", "selectall", "selectallthatapply"]],
  ["single", ["single", "multiplechoice", "mcq", "choice", "radio", "singlechoice", "onechoice"]],
  ["truefalse", ["truefalse", "tf", "boolean", "yesno", "trueorfalse"]],
  ["dropdown", ["dropdown", "select", "list"]],
  ["short", ["short", "shortanswer", "text", "fillintheblank", "fillin", "fill", "oneword", "blank"]],
  ["long", ["long", "longanswer", "paragraph", "essay", "written", "openended"]],
  ["number", ["number", "numeric", "numerical", "integer", "calculation"]],
];

const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

function readType(raw: string): QuestionType | null {
  const k = key(raw);
  if (!k) return null;
  for (const [type, names] of TYPE_SYNONYMS) {
    if (k === type || key(QUESTION_TYPE_LABELS[type]) === k || names.includes(k)) return type;
  }
  return null;
}

/** Column name → which field it fills. */
const COLUMN_SYNONYMS: Record<string, string[]> = {
  prompt: ["question", "prompt", "questiontext", "q", "title"],
  type: ["type", "questiontype", "kind", "format"],
  options: ["options", "choices", "possibleanswers", "answeroptions"],
  answer: ["answer", "answers", "correct", "correctanswer", "correctanswers", "key", "solution", "accepted", "acceptedanswers"],
  points: ["points", "marks", "score", "pts", "mark", "point"],
  required: ["required", "mandatory", "compulsory"],
  description: ["details", "description", "scenario", "context", "notes", "hint"],
  explanation: ["explanation", "feedback", "reason", "markingguide", "modelanswer", "rationale"],
  partialCredit: ["partialcredit", "partial", "partialmarks"],
};

function fieldFor(column: string): string | null {
  const k = key(column);
  for (const [field, names] of Object.entries(COLUMN_SYNONYMS)) if (names.includes(k)) return field;
  return null;
}

/** "Option 1", "option_a", "Choice C" — the index of a one-option-per-column header, or null. */
function optionColumnIndex(column: string): number | null {
  const m = /^(?:option|choice|answer)\s*[_#-]?\s*([0-9]{1,2}|[a-j])$/i.exec(column.trim());
  if (!m) return null;
  const v = m[1].toLowerCase();
  return /\d/.test(v) ? Number(v) - 1 : v.charCodeAt(0) - 97;
}

const cell = (v: unknown) => (v === null || v === undefined ? "" : String(v).trim());
const truthy = (v: string) => /^(y|yes|true|1|x|✓|required)$/i.test(v.trim());
const splitList = (v: string) => v.split("|").map((s) => s.trim()).filter(Boolean);

function parseNumberAnswer(v: string): { value: number | null; tolerance: number | null } {
  const m = /(-?\d+(?:\.\d+)?)\s*(?:±|\+\/-|\+-|plus or minus)?\s*(\d+(?:\.\d+)?)?/i.exec(v.replace(/,/g, ""));
  if (!m) return { value: null, tolerance: null };
  return { value: Number(m[1]), tolerance: m[2] ? Number(m[2]) : null };
}

/** The option ids an Answer cell names — by letter ("A, C"), number ("2") or text. */
function matchOptions(answer: string, options: { id: string; text: string }[]): string[] {
  const letters = /^[a-j](\s*[,;|/&]\s*[a-j]|\s+and\s+[a-j])*$/i;
  if (letters.test(answer) && !options.some((o) => normalizeText(o.text) === normalizeText(answer))) {
    return [...answer.toLowerCase().matchAll(/[a-j]/g)].map((m) => options[m[0].charCodeAt(0) - 97]?.id).filter(Boolean) as string[];
  }
  if (/^\d+(\s*[,;|]\s*\d+)*$/.test(answer) && !options.some((o) => normalizeText(o.text) === normalizeText(answer))) {
    return answer.split(/[,;|]/).map((n) => options[Number(n.trim()) - 1]?.id).filter(Boolean) as string[];
  }
  const byText = (parts: string[]) =>
    parts.map((p) => options.find((o) => normalizeText(o.text) === normalizeText(p))?.id).filter(Boolean) as string[];
  const whole = byText([answer]);
  if (whole.length) return whole;
  const piped = byText(splitList(answer));
  if (piped.length) return piped;
  return byText(answer.split(/[,;]/).map((s) => s.trim()).filter(Boolean));
}

/**
 * Spreadsheet rows (objects keyed by header, as sheet_to_json gives them) →
 * questions. Rows without a question are skipped; the type is guessed from
 * the options and answer when no Type column says.
 */
function rowsToQuestions(rows: Record<string, unknown>[]): ImportResult {
  const questions: TestQuestion[] = [];
  const warnings: string[] = [];
  if (rows.length === 0) return { questions, warnings: ["The file has no rows."] };

  const columns = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const fields = new Map(columns.map((c) => [c, fieldFor(c)]));
  const optionColumns = columns
    .map((c) => ({ c, i: fields.get(c) ? null : optionColumnIndex(c) }))
    .filter((x): x is { c: string; i: number } => x.i !== null)
    .sort((a, b) => a.i - b.i);

  if (![...fields.values()].includes("prompt")) {
    return {
      questions,
      warnings: [`No "Question" column found. The columns in this file are: ${columns.join(", ") || "none"}. Download the template to see the expected layout.`],
    };
  }

  rows.forEach((row, index) => {
    const line = index + 2; // header is row 1
    const get = (field: string) => {
      for (const [c, f] of fields) if (f === field && cell(row[c])) return cell(row[c]);
      return "";
    };
    const prompt = get("prompt");
    if (!prompt) return;

    const options = [
      ...splitList(get("options")),
      ...optionColumns.map(({ c }) => cell(row[c])).filter(Boolean),
    ].map((text, i) => ({ id: `${newId()}${i}`, text }));
    const answer = get("answer");
    const typeCell = get("type");
    let type = readType(typeCell);
    if (typeCell && !type) warnings.push(`Row ${line}: type "${typeCell}" is not recognised — guessed from the answer instead.`);

    if (!type) {
      if (options.length) type = "single";
      else if (/^(true|false|t|f)$/i.test(answer)) type = "truefalse";
      else if (answer && /^-?\d+(\.\d+)?(\s*(±|\+\/-|\+-)\s*\d+(\.\d+)?)?$/.test(answer.replace(/,/g, ""))) type = "number";
      else if (answer) type = "short";
      else type = "long";
    }

    const q: TestQuestion = { ...blankQuestion(type), prompt };
    const description = get("description");
    if (description) q.description = description;
    const explanation = get("explanation");
    if (explanation) q.explanation = explanation;
    const points = get("points");
    if (points) q.points = Math.max(0, Number(points.replace(",", ".")) || 0);
    const required = get("required");
    if (required) q.required = truthy(required);
    if (truthy(get("partialCredit"))) q.partialCredit = true;

    if (type === "truefalse") {
      const a = answer.toLowerCase();
      q.correct = /^(t|true|yes|y|1)$/.test(a) ? ["true"] : /^(f|false|no|n|0)$/.test(a) ? ["false"] : [];
    } else if (CHOICE_TYPES.includes(type)) {
      if (options.length) q.options = options;
      q.correct = answer ? matchOptions(answer, q.options) : [];
      // Several correct answers on a one-answer type: it was meant to be checkboxes.
      if (q.correct.length > 1 && type !== "multiple") {
        if (typeCell) warnings.push(`Row ${line}: ${q.correct.length} correct answers on a "${typeCell}" question — imported as checkboxes.`);
        q.type = "multiple";
      }
      if (answer && q.correct.length === 0) warnings.push(`Row ${line}: answer "${answer}" doesn't match any option — mark the correct one after importing.`);
    } else if (type === "short") {
      q.accepted = splitList(answer);
    } else if (type === "number") {
      const { value, tolerance } = parseNumberAnswer(answer);
      q.numberAnswer = value;
      q.tolerance = tolerance;
    } else if (type === "long" && answer && !q.explanation) {
      // A long answer has no key; what was written in the Answer column is the marking guide.
      q.explanation = answer;
    }

    if (!points && q.type === "long") q.points = 5;
    questions.push(q);
  });

  if (questions.length === 0) warnings.unshift("No rows had a question in them.");
  return { questions, warnings };
}

/**
 * JSON: either this site's own export ({ questions: [...] }) or a plain list.
 * Items in the site's own shape keep everything; anything else is read like
 * spreadsheet rows, so { "question": "…", "options": [...], "answer": "…" } works too.
 */
function parseJsonQuestions(text: string): ImportResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (err) {
    return { questions: [], warnings: [`That isn't valid JSON: ${(err as Error).message}`] };
  }
  const list = Array.isArray(data) ? data : data && typeof data === "object" && Array.isArray((data as { questions?: unknown }).questions) ? (data as { questions: unknown[] }).questions : null;
  if (!list) return { questions: [], warnings: ['Expected a list of questions, or an object with a "questions" list.'] };

  const native = list.filter((item) => item && typeof item === "object" && "prompt" in item && "type" in item && Array.isArray((item as { options?: unknown }).options) && (item as { options: unknown[] }).options.every((o) => o && typeof o === "object"));
  const loose = list.filter((item) => !native.includes(item) && item && typeof item === "object") as Record<string, unknown>[];

  const fromNative = parseQuestions(native).map(cloneQuestion);
  const fromLoose = loose.length
    ? rowsToQuestions(loose.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, Array.isArray(v) ? v.join(" | ") : v]))))
    : { questions: [], warnings: [] };
  return { questions: [...fromNative, ...fromLoose.questions], warnings: fromLoose.warnings };
}

const EXPORT_COLUMNS = ["Question", "Type", "Options", "Answer", "Points", "Required", "Details", "Explanation", "Partial credit"] as const;

/** One row per question, in the layout rowsToQuestions reads back. */
function questionsToRows(questions: TestQuestion[]): Record<(typeof EXPORT_COLUMNS)[number], string | number>[] {
  return questions.map((q) => ({
    Question: q.prompt,
    Type: QUESTION_TYPE_LABELS[q.type],
    Options: q.type === "truefalse" || !CHOICE_TYPES.includes(q.type) ? "" : q.options.map((o) => o.text).join(" | "),
    Answer:
      q.type === "truefalse"
        ? q.correct[0] === "true" ? "True" : q.correct[0] === "false" ? "False" : ""
        : CHOICE_TYPES.includes(q.type)
          ? q.options.filter((o) => q.correct.includes(o.id)).map((o) => o.text).join(" | ")
          : q.type === "short"
            ? q.accepted.join(" | ")
            : q.type === "number" && q.numberAnswer !== null && q.numberAnswer !== undefined
              ? `${q.numberAnswer}${q.tolerance ? ` ± ${q.tolerance}` : ""}`
              : "",
    Points: q.points,
    Required: q.required ? "Yes" : "No",
    Details: q.description ?? "",
    Explanation: q.explanation ?? "",
    "Partial credit": q.partialCredit ? "Yes" : "",
  }));
}

/** The downloadable template: one example of every question type. */
export function templateQuestions(): TestQuestion[] {
  return parseQuestionText(`1. What does CPR stand for? [short]
   = Cardiopulmonary resuscitation | cardio pulmonary resuscitation
2. Which of these are vital signs? [checkbox]
   - Pulse *
   - Blood pressure *
   - Hair colour
3. What is the first step at any scene?
   - Ensure scene safety *
   - Start compressions
   - Call for backup
4. An unconscious patient with a pulse goes in the recovery position. [true]
5. Which triage tag is used for walking wounded? [dropdown]
   - Red
   - Yellow
   - Green *
   - Black
6. Compressions per minute for adult CPR? [number] = 110 ± 10
7. Describe how you would triage a multi-casualty incident. [long] (10 pts)`).questions;
}

/** Reads an uploaded file into questions. xlsx is loaded only when a spreadsheet is picked. */
export async function importFile(file: File): Promise<ImportResult> {
  const name = file.name.toLowerCase();
  if (file.size > 5 * 1024 * 1024) return { questions: [], warnings: ["That file is over 5 MB — is it the right one?"] };

  if (name.endsWith(".json")) return parseJsonQuestions(await file.text());
  if (name.endsWith(".txt") || name.endsWith(".md")) {
    const { questions } = parseQuestionText(await file.text());
    return {
      questions,
      warnings: questions.length ? [] : ["No questions found. Text files use the same layout as Paste text."],
    };
  }
  if (/\.(xlsx|xls|csv|ods)$/.test(name)) {
    const XLSX = await import("xlsx");
    const book = name.endsWith(".csv") ? XLSX.read(await file.text(), { type: "string" }) : XLSX.read(await file.arrayBuffer());
    const sheet = book.Sheets[book.SheetNames[0]];
    if (!sheet) return { questions: [], warnings: ["The file has no sheets."] };
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false });
    const result = rowsToQuestions(rows);
    if (book.SheetNames.length > 1) result.warnings.push(`Only the first sheet ("${book.SheetNames[0]}") was read.`);
    return result;
  }
  return { questions: [], warnings: ["Pick an Excel (.xlsx), CSV, JSON or text file."] };
}

/** Downloads questions as a spreadsheet (xlsx or csv) or as JSON. */
export async function downloadQuestions(questions: TestQuestion[], baseName: string, format: "xlsx" | "csv" | "json") {
  const safe = baseName.replace(/[^\w-]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "questions";
  if (format === "json") {
    const blob = new Blob([JSON.stringify({ questions }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${safe}.json`;
    link.click();
    URL.revokeObjectURL(url);
    return;
  }
  const XLSX = await import("xlsx");
  const sheet = XLSX.utils.json_to_sheet(questionsToRows(questions), { header: [...EXPORT_COLUMNS] });
  sheet["!cols"] = [{ wch: 50 }, { wch: 16 }, { wch: 40 }, { wch: 30 }, { wch: 8 }, { wch: 9 }, { wch: 30 }, { wch: 40 }, { wch: 13 }];
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Questions");
  XLSX.writeFile(book, `${safe}.${format}`, { bookType: format });
}
