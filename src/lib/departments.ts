/**
 * Department standing and the marks that stand for it on the roster.
 *
 * The roster shows one column per department; a member's cell carries the mark
 * for their standing in it, so "who runs Surgical" is readable at a glance
 * rather than only from the department page. Ordered most senior first — the
 * same convention as RANKS.
 */
export const DEPARTMENT_ROLES = ["High Command", "Command", "Lead", "Member"] as const;

export type DepartmentRole = (typeof DEPARTMENT_ROLES)[number];

export function isDepartmentRole(value: unknown): value is DepartmentRole {
  return typeof value === "string" && (DEPARTMENT_ROLES as readonly string[]).includes(value);
}

/** Falls back to "Member" so an unrecognised stored value still renders as belonging, not as nothing. */
export function normalizeDepartmentRole(value: unknown): DepartmentRole {
  return isDepartmentRole(value) ? value : "Member";
}

export interface DepartmentRoleMark {
  /** Which glyph MembershipMark draws. */
  icon: "star" | "shield" | "check";
  /** Solid star for high command, hollow for command — the difference is the fill. */
  filled: boolean;
  /** Tailwind text colour, so the mark reads without needing the legend. */
  className: string;
  /** Tooltip/legend text. */
  label: string;
}

export const DEPARTMENT_ROLE_MARKS: Record<DepartmentRole, DepartmentRoleMark> = {
  "High Command": {
    icon: "star",
    filled: true,
    className: "text-amber-400",
    label: "Department High Command",
  },
  Command: {
    icon: "star",
    filled: false,
    className: "text-amber-300",
    label: "Department Command",
  },
  Lead: {
    icon: "shield",
    filled: true,
    className: "text-sky-400",
    label: "Department Lead",
  },
  Member: {
    icon: "check",
    filled: false,
    className: "text-emerald-400",
    label: "Department Member",
  },
};

/** The short label a department shows as — its tag, falling back to its name. */
export function departmentTag(dept: { tag?: string | null; name: string }): string {
  return dept.tag?.trim() || dept.name;
}

/** Every question type the form builder offers. */
export const QUESTION_TYPES = ["text", "textarea", "select", "checkbox"] as const;

export type QuestionType = (typeof QUESTION_TYPES)[number];

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  text: "Short answer",
  textarea: "Paragraph",
  select: "Multiple choice",
  checkbox: "Yes / no",
};

export function isQuestionType(value: unknown): value is QuestionType {
  return typeof value === "string" && (QUESTION_TYPES as readonly string[]).includes(value);
}

export interface DepartmentQuestionShape {
  id: string;
  label: string;
  type: string;
  options: unknown;
  placeholder: string | null;
  required: boolean;
  order: number;
}

/** A question's choices, tolerating the Json column holding anything. */
export function questionOptions(question: { options: unknown }): string[] {
  if (!Array.isArray(question.options)) return [];
  return question.options.filter((o): o is string => typeof o === "string" && o.trim() !== "");
}

export interface SubmittedAnswer {
  questionId: string;
  label: string;
  answer: string;
}

/** Answers as stored on an application, tolerating the Json column holding anything. */
export function readAnswers(value: unknown): SubmittedAnswer[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const { questionId, label, answer } = entry as Record<string, unknown>;
    if (typeof label !== "string") return [];
    return [
      {
        questionId: typeof questionId === "string" ? questionId : "",
        label,
        answer: typeof answer === "string" ? answer : "",
      },
    ];
  });
}

/**
 * Validates a submitted answer map against a department's questions and
 * returns the snapshot to store. Mandatory questions are the whole point of
 * the builder, so an unanswered one is an error rather than a blank row.
 */
export function collectAnswers(
  questions: DepartmentQuestionShape[],
  submitted: Record<string, unknown>
): { answers: SubmittedAnswer[] } | { error: string } {
  const answers: SubmittedAnswer[] = [];

  for (const question of [...questions].sort((a, b) => a.order - b.order)) {
    const raw = submitted[question.id];
    let answer = "";

    if (question.type === "checkbox") {
      // A "yes/no" is always answered — false is an answer, so `required`
      // here means "must tick", matching how a consent box behaves.
      const ticked = raw === true || raw === "true";
      if (question.required && !ticked) {
        return { error: `"${question.label}" must be ticked` };
      }
      answer = ticked ? "Yes" : "No";
    } else {
      answer = typeof raw === "string" ? raw.trim() : "";
      if (question.required && !answer) {
        return { error: `"${question.label}" is required` };
      }
      if (question.type === "select" && answer) {
        const choices = questionOptions(question);
        if (choices.length > 0 && !choices.includes(answer)) {
          return { error: `"${answer}" is not a choice for "${question.label}"` };
        }
      }
    }

    answers.push({ questionId: question.id, label: question.label, answer });
  }

  return { answers };
}
