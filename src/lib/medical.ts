/**
 * The medical documentation platform's shared vocabulary.
 *
 * The whole module is built around one idea: a document is a *form version*
 * plus *answers*. Nothing is hard-coded per document type — Command defines a
 * type, builds a form out of the field types below, publishes it, and doctors
 * can fill it in immediately. Adding "Fitness-to-Drive Certificate" is data
 * entry, not a deploy.
 */

/** Every field the form builder can place. */
export const FIELD_TYPES = [
  "shortText",
  "longText",
  "number",
  "date",
  "time",
  "datetime",
  "dropdown",
  "multiSelect",
  "checkbox",
  "radio",
  "yesNo",
  "patientInfo",
  "doctorInfo",
  "departmentInfo",
  "signature",
  "fileAttachment",
  "imageAttachment",
  "assessment",
  "heading",
  "separator",
] as const;

export type FieldType = (typeof FIELD_TYPES)[number];

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  shortText: "Short text",
  longText: "Long text",
  number: "Number",
  date: "Date",
  time: "Time",
  datetime: "Date and time",
  dropdown: "Dropdown",
  multiSelect: "Multi-select",
  checkbox: "Checkbox",
  radio: "Radio buttons",
  yesNo: "Yes / No",
  patientInfo: "Patient information",
  doctorInfo: "Doctor information",
  departmentInfo: "Department information",
  signature: "Signature",
  fileAttachment: "File attachment",
  imageAttachment: "Image attachment",
  assessment: "Medical assessment",
  heading: "Custom heading",
  separator: "Separator / information block",
};

/** Types that offer a fixed choice list, so the builder shows an options editor. */
export const CHOICE_TYPES: FieldType[] = ["dropdown", "multiSelect", "radio"];

/**
 * Types that present information rather than collect it. They hold no answer,
 * are never required, and can't be the subject of a condition.
 */
export const PRESENTATIONAL_TYPES: FieldType[] = ["heading", "separator", "departmentInfo"];

/**
 * Types the system fills in from the record rather than from the doctor's
 * typing — the patient block, the author block. Stored as answers all the
 * same, so a finalized document keeps what was true when it was signed rather
 * than re-reading a roster that may since have changed.
 */
export const AUTOFILL_TYPES: FieldType[] = ["patientInfo", "doctorInfo"];

export interface FieldValidation {
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  /** Regular expression source, applied to the string value. */
  pattern?: string;
}

/**
 * Show this field only when another field's answer matches. One condition per
 * field, which covers the "was the patient injured? → show injury details"
 * case without turning the builder into a rules engine.
 */
export interface FieldCondition {
  /** FormField.name of the controlling field. */
  field: string;
  operator: "equals" | "notEquals" | "isAnyOf" | "isFilled" | "isEmpty";
  value?: string | string[];
}

export interface FormField {
  id: string;
  type: FieldType;
  /** Machine key. Answers are stored under this, so it must be stable. */
  name: string;
  label: string;
  description?: string;
  placeholder?: string;
  required: boolean;
  defaultValue?: string;
  /** Choice list for dropdown / multiSelect / radio. */
  options?: string[];
  /** Groups fields under a heading in both the form and the export. */
  section?: string;
  order: number;
  /** Hidden fields stay on the form definition but are not rendered. */
  visible: boolean;
  /** Whether the field's answer reaches the exported PDF. */
  inExport: boolean;
  validation?: FieldValidation;
  condition?: FieldCondition;
}

export type SignatureMode = "required" | "optional" | "disabled";

/** What the exported PDF shows, over and above the answers themselves. */
export interface ExportConfig {
  showLogo: boolean;
  showDepartmentName: boolean;
  showAddress: boolean;
  showContact: boolean;
  showDocumentNumber: boolean;
  showDate: boolean;
  showDoctor: boolean;
  showPatient: boolean;
  showSignature: boolean;
  showConfidentiality: boolean;
  showDisclaimer: boolean;
  showPageNumbers: boolean;
  /** Printed above the body, beneath the letterhead. */
  documentTitle?: string;
  /** Printed immediately above the signature block. */
  certificationStatement?: string;
  /** Section names in the order they should print. Unlisted sections follow. */
  sectionOrder?: string[];
}

export const DEFAULT_EXPORT_CONFIG: ExportConfig = {
  showLogo: true,
  showDepartmentName: true,
  showAddress: true,
  showContact: true,
  showDocumentNumber: true,
  showDate: true,
  showDoctor: true,
  showPatient: true,
  showSignature: true,
  showConfidentiality: true,
  showDisclaimer: true,
  showPageNumbers: true,
};

export const FORM_STATUSES = ["Draft", "Active", "Inactive", "Archived"] as const;
export type FormStatus = (typeof FORM_STATUSES)[number];

export const DOCUMENT_STATUSES = ["Draft", "Review", "Finalized", "Archived"] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export const DOCUMENT_CATEGORIES = ["Report", "Certificate", "Evaluation", "Other"] as const;

/** A finalized or archived document is a record of what was issued, not a working draft. */
export function isLocked(status: string): boolean {
  return status === "Finalized" || status === "Archived";
}

/** Falls back to Draft rather than rejecting, so an unknown status can never brick a form. */
export function normalizeFormStatus(raw: unknown): FormStatus {
  const value = String(raw ?? "").trim();
  return (FORM_STATUSES as readonly string[]).includes(value) ? (value as FormStatus) : "Draft";
}

export function normalizeDocumentStatus(raw: unknown): DocumentStatus {
  const value = String(raw ?? "").trim();
  return (DOCUMENT_STATUSES as readonly string[]).includes(value) ? (value as DocumentStatus) : "Draft";
}

/**
 * Parses a stored fields array back into FormField[], dropping anything
 * malformed rather than throwing. A form definition read from Json is
 * untrusted input as far as TypeScript is concerned, and one bad entry should
 * not blank the whole document.
 */
export function parseFields(raw: unknown): FormField[] {
  if (!Array.isArray(raw)) return [];
  const fields: FormField[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const f = entry as Partial<FormField>;
    if (typeof f.name !== "string" || !f.name) continue;
    if (typeof f.type !== "string" || !(FIELD_TYPES as readonly string[]).includes(f.type)) continue;
    fields.push({
      id: typeof f.id === "string" ? f.id : f.name,
      type: f.type as FieldType,
      name: f.name,
      label: typeof f.label === "string" && f.label ? f.label : f.name,
      description: typeof f.description === "string" ? f.description : undefined,
      placeholder: typeof f.placeholder === "string" ? f.placeholder : undefined,
      required: f.required === true,
      defaultValue: typeof f.defaultValue === "string" ? f.defaultValue : undefined,
      options: Array.isArray(f.options) ? f.options.filter((o): o is string => typeof o === "string") : undefined,
      section: typeof f.section === "string" ? f.section : undefined,
      order: typeof f.order === "number" ? f.order : fields.length,
      visible: f.visible !== false,
      inExport: f.inExport !== false,
      validation: f.validation && typeof f.validation === "object" ? f.validation : undefined,
      condition: f.condition && typeof f.condition === "object" ? f.condition : undefined,
    });
  }
  return fields.sort((a, b) => a.order - b.order);
}

export function parseExportConfig(raw: unknown): ExportConfig {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_EXPORT_CONFIG };
  return { ...DEFAULT_EXPORT_CONFIG, ...(raw as Partial<ExportConfig>) };
}

export type Answers = Record<string, unknown>;

function asText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

/**
 * Whether a field should be shown, given the answers so far.
 *
 * A field whose controlling field is itself hidden stays hidden too — one
 * level of lookup, deliberately: chains are resolved by re-running this over
 * the whole set (see visibleFields), which terminates even if someone builds
 * a cycle.
 */
export function conditionMet(condition: FieldCondition | undefined, answers: Answers): boolean {
  if (!condition?.field) return true;
  const actual = answers[condition.field];
  const actualText = asText(actual).toLowerCase();

  switch (condition.operator) {
    case "isFilled":
      return actualText !== "";
    case "isEmpty":
      return actualText === "";
    case "notEquals":
      return actualText !== asText(condition.value).toLowerCase();
    case "isAnyOf": {
      const allowed = Array.isArray(condition.value) ? condition.value : [condition.value ?? ""];
      const selected = Array.isArray(actual) ? actual.map((v) => asText(v).toLowerCase()) : [actualText];
      return allowed.some((v) => selected.includes(asText(v).toLowerCase()));
    }
    case "equals":
    default:
      return actualText === asText(condition.value).toLowerCase();
  }
}

/**
 * The fields actually on screen for a given set of answers, with conditions
 * resolved. Iterates until the visible set stops shrinking so a field
 * controlled by another conditional field settles correctly; the pass count is
 * capped, which is what keeps a circular condition from hanging the render.
 */
export function visibleFields(fields: FormField[], answers: Answers): FormField[] {
  let current = fields.filter((f) => f.visible);
  for (let pass = 0; pass < 10; pass++) {
    const names = new Set(current.map((f) => f.name));
    const next = current.filter((f) => {
      if (!f.condition?.field) return true;
      // Controlled by a field that is itself hidden — nothing can satisfy it.
      if (!names.has(f.condition.field)) return false;
      return conditionMet(f.condition, answers);
    });
    if (next.length === current.length) return next;
    current = next;
  }
  return current;
}

/**
 * Validates answers against the fields that are actually visible. A required
 * field inside a hidden branch must not block submission — that is the whole
 * point of conditional fields.
 */
export function validateAnswers(fields: FormField[], answers: Answers): string[] {
  const errors: string[] = [];
  for (const field of visibleFields(fields, answers)) {
    if (PRESENTATIONAL_TYPES.includes(field.type)) continue;
    const value = answers[field.name];
    const text = asText(value).trim();

    if (field.required && text === "") {
      errors.push(`${field.label} is required.`);
      continue;
    }
    if (text === "") continue;

    const v = field.validation;
    if (!v) continue;

    if (field.type === "number") {
      const n = Number(text);
      if (Number.isNaN(n)) {
        errors.push(`${field.label} must be a number.`);
        continue;
      }
      if (v.min !== undefined && n < v.min) errors.push(`${field.label} must be at least ${v.min}.`);
      if (v.max !== undefined && n > v.max) errors.push(`${field.label} must be at most ${v.max}.`);
    } else {
      if (v.minLength !== undefined && text.length < v.minLength) {
        errors.push(`${field.label} must be at least ${v.minLength} characters.`);
      }
      if (v.maxLength !== undefined && text.length > v.maxLength) {
        errors.push(`${field.label} must be at most ${v.maxLength} characters.`);
      }
      if (v.pattern) {
        try {
          if (!new RegExp(v.pattern).test(text)) errors.push(`${field.label} is not in the expected format.`);
        } catch {
          // A malformed pattern is a builder mistake, not a doctor's — never
          // block a document over it.
        }
      }
    }
  }
  return errors;
}

/**
 * Next version string for a form. Minor bumps within the major, so a published
 * 1.9 becomes 1.10 rather than rolling over — the number is an identifier, not
 * a decimal.
 */
export function nextVersion(existing: string[]): string {
  let major = 1;
  let minor = 0;
  let seen = false;
  for (const v of existing) {
    const match = /^(\d+)\.(\d+)$/.exec(v.trim());
    if (!match) continue;
    seen = true;
    const [, maj, min] = match;
    const majN = Number(maj);
    const minN = Number(min);
    if (majN > major || (majN === major && minN >= minor)) {
      major = majN;
      minor = minN;
    }
  }
  return seen ? `${major}.${minor + 1}` : "1.0";
}

/** Formats a sequence number the way document numbers read: EMS-MED-2026-000124. */
export function formatDocumentNumber(prefix: string, year: number, sequence: number): string {
  return `${prefix}-${year}-${String(sequence).padStart(6, "0")}`;
}

/**
 * Groups fields into their sections, preserving the export's configured
 * section order and appending any section it doesn't mention. Shared by the
 * form renderer and the PDF so both lay a document out the same way.
 */
export function groupBySection(
  fields: FormField[],
  sectionOrder?: string[]
): { section: string; fields: FormField[] }[] {
  const groups = new Map<string, FormField[]>();
  for (const field of fields) {
    const key = field.section?.trim() || "";
    groups.set(key, [...(groups.get(key) ?? []), field]);
  }
  const ordered: { section: string; fields: FormField[] }[] = [];
  for (const name of sectionOrder ?? []) {
    const found = groups.get(name);
    if (found) {
      ordered.push({ section: name, fields: found });
      groups.delete(name);
    }
  }
  for (const [section, sectionFields] of groups) {
    ordered.push({ section, fields: sectionFields });
  }
  return ordered;
}

/** One answer rendered for display — in the review pane and the PDF alike. */
export function displayAnswer(field: FormField, answers: Answers): string {
  const value = answers[field.name];
  if (field.type === "yesNo" || field.type === "checkbox") {
    if (value === undefined || value === "") return "—";
    return value === true || value === "true" || value === "Yes" ? "Yes" : "No";
  }
  const text = asText(value).trim();
  return text === "" ? "—" : text;
}
