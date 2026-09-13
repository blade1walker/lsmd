/**
 * The EMS training curriculum, and the progress recorded against it.
 *
 * Replaces the police academy checklist the roster was forked with (Use of
 * Force, Hostage Handling, Traffic Stops...). Those ticks lived in one fixed
 * TrainingRecord column per topic. Progress is now a single Json value keyed by
 * the checkpoint keys below, so the curriculum can change here without a schema
 * change — and an old tick can never quietly reappear as a different skill.
 *
 * Client-safe on purpose: the curriculum doubles as reference material, shown
 * to trainees alongside their own progress.
 */

export interface TrainingCheckpoint {
  /** Stored key. Never rename one that is in use — recorded progress is keyed by it. */
  key: string;
  label: string;
  /** What the skill covers, shown to trainers and trainees. */
  description: string;
}

export interface TrainingCounter {
  key: string;
  label: string;
  /** How many are needed for it to count as complete. */
  target: number;
}

export interface TrainingPhase {
  key: string;
  title: string;
  subtitle: string;
  checkpoints: TrainingCheckpoint[];
  counters?: TrainingCounter[];
}

export const EMS_TRAINING: TrainingPhase[] = [
  {
    key: "foundations",
    title: "Phase 1 · Foundations",
    subtitle: "The groundwork every medic needs before treating a patient.",
    checkpoints: [
      {
        key: "conduct",
        label: "Code of Conduct & Professionalism",
        description: "Department standards, chain of command, patient confidentiality and conduct on scene.",
      },
      {
        key: "scene_safety",
        label: "Scene Safety & PPE",
        description: "Sizing up a scene, recognising hazards, and using gloves, eye and respiratory protection.",
      },
      {
        key: "patient_assessment",
        label: "Patient Assessment",
        description: "Primary survey (ABCDE) for life threats, then a head-to-toe secondary survey and SAMPLE history.",
      },
      {
        key: "vital_signs",
        label: "Vital Signs",
        description: "Pulse, blood pressure, respiratory rate, SpO₂, temperature and GCS — and their normal ranges.",
      },
      {
        key: "radio",
        label: "Radio & Dispatch Procedures",
        description: "Radio codes, status updates, requesting assistance and giving a hospital pre-alert.",
      },
    ],
  },
  {
    key: "clinical",
    title: "Phase 2 · Core Clinical Skills",
    subtitle: "Hands-on skills used on nearly every call.",
    checkpoints: [
      {
        key: "cpr_aed",
        label: "CPR & AED (BLS)",
        description: "High-quality compressions at 100–120 per minute, rescue breaths, and safe AED use.",
      },
      {
        key: "airway",
        label: "Airway Management",
        description: "Head-tilt chin-lift and jaw thrust, suction, OPA/NPA sizing and bag-valve-mask ventilation.",
      },
      {
        key: "bleeding_shock",
        label: "Bleeding Control & Shock",
        description: "Direct pressure, wound packing, tourniquets, and recognising and managing shock.",
      },
      {
        key: "immobilization",
        label: "Fractures & Spinal Immobilization",
        description: "Splinting, cervical collars and moving a patient with a suspected spinal injury safely.",
      },
      {
        key: "pcr",
        label: "Patient Care Reports",
        description: "Writing a complete, accurate PCR for every patient contact.",
      },
    ],
  },
  {
    key: "advanced",
    title: "Phase 3 · Advanced Care & Operations",
    subtitle: "Complex patients and running the scene.",
    checkpoints: [
      {
        key: "trauma",
        label: "Trauma Care",
        description: "Gunshot and stab wounds, road traffic collisions, burns and head injuries.",
      },
      {
        key: "medical_emergencies",
        label: "Medical Emergencies",
        description: "Cardiac chest pain, stroke (FAST), diabetic emergencies, seizures, anaphylaxis and overdose.",
      },
      {
        key: "medication",
        label: "Medication Administration",
        description: "The rights of medication administration, dosing, routes (oral, IM, IV) and adverse reactions.",
      },
      {
        key: "triage",
        label: "Triage & Mass Casualty",
        description: "START triage, tagging patients and managing a scene with more patients than medics.",
      },
      {
        key: "transport",
        label: "Patient Transport & Handover",
        description: "Loading and moving patients safely, and a clear structured handover at the hospital.",
      },
    ],
  },
  {
    key: "probationary",
    title: "Probationary Evaluation",
    subtitle: "Proving readiness to work without supervision.",
    checkpoints: [
      {
        key: "communication",
        label: "Patient Communication",
        description: "Calm, clear communication with patients, bystanders and other emergency services.",
      },
      {
        key: "theory_exam",
        label: "Theory Exam",
        description: "Written assessment covering the full curriculum.",
      },
      {
        key: "practical_exam",
        label: "Practical Exam",
        description: "Supervised scenario assessment of clinical skills.",
      },
      {
        key: "recommendation",
        label: "Supervisor Recommendation",
        description: "A supervising FTO's sign-off that the medic is ready to work unsupervised.",
      },
    ],
    counters: [
      { key: "supervised_calls", label: "Supervised Patient Calls", target: 5 },
      { key: "pcrs_filed", label: "Patient Care Reports Filed", target: 3 },
    ],
  },
];

export interface CheckpointMark {
  /** The account that signed the skill off. */
  by: string | null;
  /** ISO timestamp of the sign-off. */
  at: string;
}

export interface EmsProgress {
  checkpoints: Record<string, CheckpointMark>;
  counters: Record<string, number>;
}

/** One row of the Training page. */
export interface TrainingSummaryRow {
  memberId: string;
  member: {
    name: string;
    callSign: string | null;
    rank: string;
    ftoRole: string | null;
    activity: string;
  };
  reportNumber: string;
  progress: EmsProgress;
}

export const ALL_CHECKPOINTS = EMS_TRAINING.flatMap((phase) => phase.checkpoints);
export const ALL_COUNTERS = EMS_TRAINING.flatMap((phase) => phase.counters ?? []);

export function findCheckpoint(key: unknown): TrainingCheckpoint | undefined {
  return typeof key === "string" ? ALL_CHECKPOINTS.find((c) => c.key === key) : undefined;
}

export function findCounter(key: unknown): TrainingCounter | undefined {
  return typeof key === "string" ? ALL_COUNTERS.find((c) => c.key === key) : undefined;
}

/**
 * Reads stored progress, dropping anything malformed instead of throwing — the
 * column is Json, and one bad entry must not blank someone's whole record.
 */
export function parseEmsProgress(raw: unknown): EmsProgress {
  const progress: EmsProgress = { checkpoints: {}, counters: {} };
  if (!raw || typeof raw !== "object") return progress;

  const { checkpoints, counters } = raw as { checkpoints?: unknown; counters?: unknown };

  if (checkpoints && typeof checkpoints === "object") {
    for (const [key, mark] of Object.entries(checkpoints as Record<string, unknown>)) {
      if (!mark || typeof mark !== "object") continue;
      const { by, at } = mark as { by?: unknown; at?: unknown };
      progress.checkpoints[key] = {
        by: typeof by === "string" ? by : null,
        at: typeof at === "string" ? at : "",
      };
    }
  }

  if (counters && typeof counters === "object") {
    for (const [key, value] of Object.entries(counters as Record<string, unknown>)) {
      if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
        progress.counters[key] = Math.floor(value);
      }
    }
  }

  return progress;
}

/** A counter counts toward completion once it reaches its target. */
export function phaseProgress(phase: TrainingPhase, progress: EmsProgress): { done: number; total: number } {
  const checks = phase.checkpoints.filter((c) => progress.checkpoints[c.key]).length;
  const counts = (phase.counters ?? []).filter((c) => (progress.counters[c.key] ?? 0) >= c.target).length;
  return { done: checks + counts, total: phase.checkpoints.length + (phase.counters?.length ?? 0) };
}

/**
 * Only keys in the current curriculum count, so a skill later removed from it
 * cannot keep inflating anyone's percentage.
 */
export function overallProgress(progress: EmsProgress): { done: number; total: number; percent: number } {
  let done = 0;
  let total = 0;
  for (const phase of EMS_TRAINING) {
    const stats = phaseProgress(phase, progress);
    done += stats.done;
    total += stats.total;
  }
  return { done, total, percent: total ? Math.round((done / total) * 100) : 0 };
}
