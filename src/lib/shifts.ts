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
