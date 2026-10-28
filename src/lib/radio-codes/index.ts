export interface RadioCodeEntry {
  code: string;
  description: string;
  /** One of the sections the pages group by: "ten" | "eleven" | "response". */
  section: string;
  highlighted?: boolean;
}

/**
 * The department's radio codes, in the order they should appear.
 *
 * `order` is assigned from the array index by the seed and by
 * scripts/update-radio-codes.ts, so reordering here is the only edit needed.
 *
 * Note: 10-13A and 10-13B each appear twice, once for LEO and once for
 * Medical, exactly as supplied. `RadioCode.code` is not unique, so both
 * store fine and both render.
 */
export const RADIO_CODES: RadioCodeEntry[] = [
  { code: "10-2", description: "Heard Loud & Clear / Response for Radio Check", section: "ten" },
  { code: "10-3", description: "Clear Radio Traffic", section: "ten" },
  { code: "10-4", description: "Acknowledge / Confirm Understanding", section: "ten" },
  { code: "10-6", description: "Busy / Unavailable", section: "ten" },
  { code: "10-7", description: "Out of Service (Short Break)", section: "ten" },
  { code: "10-8", description: "In Service", section: "ten" },
  { code: "10-9", description: "Repeat Last Radio Transmission", section: "ten" },
  { code: "10-13A", description: "Urgent LEO Down", section: "ten", highlighted: true },
  { code: "10-13B", description: "Non-Urgent LEO Down", section: "ten" },
  { code: "10-13A", description: "Urgent Medical Down", section: "ten", highlighted: true },
  { code: "10-13B", description: "Non-Urgent Medical Down", section: "ten" },
  { code: "10-20", description: "Current Location", section: "ten" },
  { code: "10-23", description: "Arrived on Scene", section: "ten" },
  { code: "10-25", description: "Meet in Person", section: "ten" },
  { code: "10-41", description: "On Duty", section: "ten" },
  { code: "10-42", description: "Off Duty", section: "ten" },
  { code: "10-47", description: "Medical Alert (Injured Person's Call)", section: "ten", highlighted: true },
  { code: "10-52", description: "Medical Needed (a few LEOs use this)", section: "ten", highlighted: true },
  { code: "10-74", description: "Negative", section: "ten" },
  { code: "10-76", description: "Enroute", section: "ten" },
  { code: "10-95", description: "Suspect in Custody", section: "ten" },
  { code: "10-100", description: "Crash/Sudden Nap/Disconnect (code-100)", section: "ten" },
];
