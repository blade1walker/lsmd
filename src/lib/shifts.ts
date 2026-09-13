/**
 * The standing 24-hour duty cycle, split into fixed 2-hour blocks. Both the
 * submission form and the schedule page index into this same array so a
 * signup's stored `primarySlot`/`secondarySlot` integer always means the same
 * time everywhere — the array's position is the source of truth, not a
 * separately stored label.
 */
export const SHIFT_SLOTS = [
  "12:00 AM – 2:00 AM",
  "2:00 AM – 4:00 AM",
  "4:00 AM – 6:00 AM",
  "6:00 AM – 8:00 AM",
  "8:00 AM – 10:00 AM",
  "10:00 AM – 12:00 PM",
  "12:00 PM – 2:00 PM",
  "2:00 PM – 4:00 PM",
  "4:00 PM – 6:00 PM",
  "6:00 PM – 8:00 PM",
  "8:00 PM – 10:00 PM",
  "10:00 PM – 12:00 AM",
] as const;

export function isValidShiftSlot(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value < SHIFT_SLOTS.length;
}

export function shiftSlotLabel(slot: number): string {
  return SHIFT_SLOTS[slot] ?? "Unknown";
}

/**
 * The day in four 6-hour bands, for filtering the roster by shift. Twelve
 * 2-hour chips would be unreadable; these group the same slot indices, so a
 * band is always derived from the stored slot rather than stored separately.
 */
export const SHIFT_BANDS = [
  { key: "night", label: "Night", hours: "12 AM – 6 AM", slots: [0, 1, 2] },
  { key: "morning", label: "Morning", hours: "6 AM – 12 PM", slots: [3, 4, 5] },
  { key: "afternoon", label: "Afternoon", hours: "12 PM – 6 PM", slots: [6, 7, 8] },
  { key: "evening", label: "Evening", hours: "6 PM – 12 AM", slots: [9, 10, 11] },
] as const;

export type ShiftBandKey = (typeof SHIFT_BANDS)[number]["key"];

export function shiftBandOf(slot: number | null | undefined): ShiftBandKey | null {
  if (slot === null || slot === undefined) return null;
  return SHIFT_BANDS.find((b) => (b.slots as readonly number[]).includes(slot))?.key ?? null;
}
