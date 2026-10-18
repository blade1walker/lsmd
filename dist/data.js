import { api } from "./api.js";
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
];
export const ACTIVITY = ["Active", "Reserve", "LOA"];
const TTL_MS = 60_000;
let cache = null;
/** The roster, cached briefly — autocomplete fires on every keystroke. */
export async function roster(actor, fresh = false) {
    if (!fresh && cache && Date.now() - cache.at < TTL_MS)
        return cache.sections;
    const sections = await api(actor, "GET", "/api/members");
    cache = { at: Date.now(), sections };
    return sections;
}
export function invalidateRoster() {
    cache = null;
}
export async function members(actor, fresh = false) {
    return (await roster(actor, fresh)).flatMap((s) => s.members.map((m) => ({ ...m, section: s.name })));
}
export function memberLabel(m) {
    return `${m.callSign ? `[${m.callSign}] ` : ""}${m.name} — ${m.rank}`;
}
/** Autocomplete matches on name, call sign or Discord ID. */
export function matchMembers(list, query, limit = 25) {
    const q = query.trim().toLowerCase();
    const hits = q
        ? list.filter((m) => m.name.toLowerCase().includes(q) ||
            (m.callSign ?? "").toLowerCase().includes(q) ||
            (m.discordId ?? "") === q)
        : list;
    return hits.slice(0, limit);
}
//# sourceMappingURL=data.js.map