/**
 * The EMS Call Log's vocabulary and input rules. Client-safe — the form and
 * the API validate against the same lists, so a value the form offers is a
 * value the server accepts.
 */

export const CALL_PRIORITIES = [
  { key: "P1", label: "Life-threatening" },
  { key: "P2", label: "Urgent" },
  { key: "P3", label: "Non-urgent" },
] as const;

export type CallPriority = (typeof CALL_PRIORITIES)[number]["key"];

export const CALL_NATURES = [
  "Cardiac Arrest",
  "Chest Pain",
  "Breathing Difficulty",
  "Stroke",
  "Seizure",
  "Diabetic Emergency",
  "Allergic Reaction",
  "Overdose / Poisoning",
  "Unconscious / Unresponsive",
  "Gunshot Wound",
  "Stabbing / Laceration",
  "Motor Vehicle Collision",
  "Fall",
  "Burns",
  "Other Trauma",
  "Psychiatric / Behavioural",
  "Obstetric",
  "Welfare Check",
  "Standby / Event Cover",
  "Inter-facility Transfer",
  "Other",
] as const;

export const CALL_OUTCOMES = [
  "Treated on Scene",
  "Transported",
  "Transferred Care",
  "Refused Treatment",
  "Deceased on Scene",
  "No Patient Found",
  "Cancelled",
] as const;

/** The outcome that needs a receiving hospital. */
export const TRANSPORT_OUTCOME = "Transported";

/** Receiving facilities across San Andreas. "Other" takes free text. */
export const HOSPITALS = [
  "Pillbox Hill Medical Center",
  "Mount Zonah Medical Center",
  "Central Los Santos Medical Center",
  "St. Fiacre Hospital",
  "Eclipse Medical Tower",
  "Sandy Shores Medical Center",
  "The Bay Care Center (Paleto Bay)",
] as const;

export const CALL_NUMBER_PREFIX = "EMS-CALL";

export const MAX_RESPONDERS = 12;

export interface CallResponderInput {
  memberId: string;
  role: "Lead" | "Responder";
}

export interface CallInput {
  occurredAt: Date;
  location: string;
  nature: string;
  priority: CallPriority;
  outcome: string;
  hospital: string | null;
  patientName: string | null;
  patientStateId: string | null;
  notes: string | null;
  medicalDocumentNumber: string | null;
  responders: CallResponderInput[];
}

/** A call as the API returns it. */
export interface EmsCallRecord {
  id: string;
  callNumber: string;
  occurredAt: string;
  location: string;
  nature: string;
  priority: string;
  outcome: string;
  hospital: string | null;
  patientName: string | null;
  patientStateId: string | null;
  notes: string | null;
  medicalDocumentNumber: string | null;
  createdByDiscordId: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  responders: { memberId: string; role: string; name: string; callSign: string | null; rank: string }[];
}

export interface CallStats {
  today: number;
  last7Days: number;
  last30Days: number;
  /** Share of the last 30 days' calls that ended in a transport, 0–100. */
  transportRate: number;
  byNature: { nature: string; count: number }[];
  byOutcome: { outcome: string; count: number }[];
  topResponders: { memberId: string; name: string; callSign: string | null; count: number }[];
  /** False when the numbers only cover the viewer's own calls. */
  departmentWide: boolean;
}

function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, max);
  return trimmed === "" ? null : trimmed;
}

/**
 * Validates a submitted call. Every field is checked against the lists above,
 * so the log stays reportable — free text in "nature" or "outcome" would make
 * the statistics meaningless within a week.
 */
export function parseCallInput(body: unknown): { data: CallInput } | { error: string } {
  if (!body || typeof body !== "object") return { error: "Nothing was submitted" };
  const b = body as Record<string, unknown>;

  const occurredAt = typeof b.occurredAt === "string" ? new Date(b.occurredAt) : null;
  if (!occurredAt || Number.isNaN(occurredAt.getTime())) return { error: "Enter when the call happened" };
  // A little slack for clock drift between the medic's machine and the server.
  if (occurredAt.getTime() > Date.now() + 60 * 60 * 1000) return { error: "The call time is in the future" };

  const location = text(b.location, 120);
  if (!location) return { error: "Enter where the call was" };

  const nature = typeof b.nature === "string" ? b.nature : "";
  if (!(CALL_NATURES as readonly string[]).includes(nature)) return { error: "Choose what the call was" };

  const priority = CALL_PRIORITIES.find((p) => p.key === b.priority)?.key ?? "P2";

  const outcome = typeof b.outcome === "string" ? b.outcome : "";
  if (!(CALL_OUTCOMES as readonly string[]).includes(outcome)) return { error: "Choose how the call ended" };

  const hospital = outcome === TRANSPORT_OUTCOME ? text(b.hospital, 80) : null;
  if (outcome === TRANSPORT_OUTCOME && !hospital) return { error: "Choose the hospital the patient was taken to" };

  const rawResponders = Array.isArray(b.responders) ? b.responders : [];
  const responders: CallResponderInput[] = [];
  for (const entry of rawResponders) {
    const memberId =
      typeof entry === "string"
        ? entry
        : entry && typeof entry === "object" && typeof (entry as { memberId?: unknown }).memberId === "string"
          ? (entry as { memberId: string }).memberId
          : null;
    if (!memberId || responders.some((r) => r.memberId === memberId)) continue;
    const wantsLead = typeof entry === "object" && (entry as { role?: unknown }).role === "Lead";
    responders.push({ memberId, role: wantsLead ? "Lead" : "Responder" });
  }
  if (responders.length === 0) return { error: "Add at least one responding medic" };
  if (responders.length > MAX_RESPONDERS) return { error: `A call can list at most ${MAX_RESPONDERS} medics` };

  // Exactly one lead: the first one marked, or the first medic listed.
  const leadIndex = Math.max(0, responders.findIndex((r) => r.role === "Lead"));
  responders.forEach((r, i) => (r.role = i === leadIndex ? "Lead" : "Responder"));

  return {
    data: {
      occurredAt,
      location,
      nature,
      priority,
      outcome,
      hospital,
      patientName: text(b.patientName, 80),
      patientStateId: text(b.patientStateId, 20),
      notes: text(b.notes, 2000),
      medicalDocumentNumber: text(b.medicalDocumentNumber, 40)?.toUpperCase() ?? null,
      responders,
    },
  };
}
