import { api, type Actor } from "./api.js";

/**
 * The website's rank ladder, highest first — kept in step with RANKS in the
 * site's src/lib/constants.ts. Only used to offer choices; the site validates
 * the rank itself.
 */
export const RANKS = [
  "Director of Medicine",
  "Chief of EMS",
  "Deputy Chief of EMS",
  "Assistant Chief",
  "Division Chief",
  "EMS Captain",
  "Lieutenant",
  "Senior Paramedic",
  "Paramedic",
  "EMT",
  "EMR",
  "Medical Intern",
] as const;

export const ACTIVITY = ["Active", "Reserve", "LOA"] as const;

export interface Member {
  id: string;
  name: string;
  rank: string;
  callSign: string | null;
  activity: string;
  discordId: string | null;
  dateOfJoining: string | null;
  lastPromotion: string | null;
  category: string | null;
  stateId: string | null;
  loas?: { startDate: string; endDate: string; reason: string }[];
}

interface Section {
  id: string;
  name: string;
  members: Member[];
}

const TTL_MS = 60_000;
let cache: { at: number; sections: Section[] } | null = null;

/** The roster, cached briefly — autocomplete fires on every keystroke. */
export async function roster(actor: Actor, fresh = false): Promise<Section[]> {
  if (!fresh && cache && Date.now() - cache.at < TTL_MS) return cache.sections;
  const sections = await api<Section[]>(actor, "GET", "/api/members");
  cache = { at: Date.now(), sections };
  return sections;
}

export function invalidateRoster() {
  cache = null;
}

export async function members(actor: Actor, fresh = false) {
  return (await roster(actor, fresh)).flatMap((s) => s.members.map((m) => ({ ...m, section: s.name })));
}

export function memberLabel(m: Pick<Member, "name" | "callSign" | "rank">) {
  return `${m.callSign ? `[${m.callSign}] ` : ""}${m.name} — ${m.rank}`;
}

/** Autocomplete matches on name, call sign or Discord ID. */
export function matchMembers<T extends Member>(list: T[], query: string, limit = 25) {
  const q = query.trim().toLowerCase();
  const hits = q
    ? list.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          (m.callSign ?? "").toLowerCase().includes(q) ||
          (m.discordId ?? "") === q
      )
    : list;
  return hits.slice(0, limit);
}
