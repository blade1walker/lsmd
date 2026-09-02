import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { writeFileSync } from "node:fs";

/**
 * Looks up roster Discord IDs for a list of character names.
 *
 * The names come in as people type them — inconsistent case, missing letters,
 * "chales morgna" for "Charles Morgan" — so an exact match is tried first, then
 * a normalised match, then a nearest-neighbour match that is reported as a
 * guess rather than silently accepted. Anything with no plausible match is
 * listed at the end so it can be chased up rather than quietly dropped.
 *
 * Usage:
 *   npm run lookup-discord-ids            # prints the table
 *   npm run lookup-discord-ids -- --csv   # also writes discord-ids.csv
 */

const NAMES = [
  "Aaviraj Mishra",
  "agni",
  "ALBERT MESSI",
  "Anastasya Feodorovna Snezhnaya",
  "avneet singh",
  "Anshu",
  "chaggaan lal",
  "Chandru Shubhaskar",
  "champal lal",
  "chales morgna",
  "conner brooks",
  "devon pravesh",
  "Hiicrow Singh",
  "Karan Sharma",
  "leon choudhary",
  "Omprakash Escobar",
  "Patrick Bateman",
  "pavan kumar",
  "rana jee",
  "rusty johnson",
  "Shambhu DSouza",
  "Shivam Ganguly",
  "Stuart jr",
  "Sylus Hael",
  "vp chaudary",
];

/** Longest edit distance still treated as "probably the same person". */
const FUZZY_LIMIT = 3;

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Add it to .env or export it, then re-run.");
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const normalise = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "");

function editDistance(a: string, b: string): number {
  const rows = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) rows[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      rows[i][j] = Math.min(
        rows[i - 1][j] + 1,
        rows[i][j - 1] + 1,
        rows[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return rows[a.length][b.length];
}

interface RosterMember {
  name: string;
  rank: string;
  callSign: string | null;
  discordId: string | null;
  activity: string;
}

interface Match {
  requested: string;
  member: RosterMember | null;
  /** "exact" and "normalised" are certain; "closest" needs a human to confirm. */
  confidence: "exact" | "normalised" | "closest" | "none";
}

function match(requested: string, roster: RosterMember[]): Match {
  const exact = roster.find((m) => m.name === requested);
  if (exact) return { requested, member: exact, confidence: "exact" };

  const target = normalise(requested);
  const normalised = roster.find((m) => normalise(m.name) === target);
  if (normalised) return { requested, member: normalised, confidence: "normalised" };

  // A name that is wholly contained in a roster entry (or vice versa) — "agni"
  // inside "Agni Kai", say — before falling back to edit distance.
  const contained = roster.find((m) => {
    const candidate = normalise(m.name);
    return candidate.includes(target) || target.includes(candidate);
  });
  if (contained) return { requested, member: contained, confidence: "closest" };

  let best: RosterMember | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const m of roster) {
    const distance = editDistance(target, normalise(m.name));
    if (distance < bestDistance) {
      bestDistance = distance;
      best = m;
    }
  }

  return bestDistance <= FUZZY_LIMIT && best
    ? { requested, member: best, confidence: "closest" }
    : { requested, member: null, confidence: "none" };
}

async function main() {
  const roster = await prisma.member.findMany({
    select: { name: true, rank: true, callSign: true, discordId: true, activity: true },
    orderBy: { name: "asc" },
  });

  console.log(`Roster holds ${roster.length} members. Looking up ${NAMES.length} names.\n`);

  const matches = NAMES.map((name) => match(name, roster));
  const found = matches.filter((m) => m.member);
  const missing = matches.filter((m) => !m.member);

  const rows = found.map((m) => ({
    requested: m.requested,
    roster: m.member!.name,
    callSign: m.member!.callSign ?? "—",
    rank: m.member!.rank,
    discordId: m.member!.discordId ?? "NOT LINKED",
    activity: m.member!.activity,
    confidence: m.confidence,
  }));

  const width = (pick: (r: (typeof rows)[number]) => string, header: string) =>
    Math.max(header.length, ...rows.map((r) => pick(r).length));

  const w = {
    requested: width((r) => r.requested, "Requested name"),
    roster: width((r) => r.roster, "Roster name"),
    callSign: width((r) => r.callSign, "Call sign"),
    discordId: width((r) => r.discordId, "Discord ID"),
  };

  const line = (a: string, b: string, c: string, d: string, e: string) =>
    `${a.padEnd(w.requested)}  ${b.padEnd(w.roster)}  ${c.padEnd(w.callSign)}  ${d.padEnd(w.discordId)}  ${e}`;

  console.log(line("Requested name", "Roster name", "Call sign", "Discord ID", "Match"));
  console.log(line("-".repeat(w.requested), "-".repeat(w.roster), "-".repeat(w.callSign), "-".repeat(w.discordId), "-----"));
  for (const r of rows) {
    console.log(line(r.requested, r.roster, r.callSign, r.discordId, r.confidence === "closest" ? "closest — CHECK" : r.confidence));
  }

  const unlinked = rows.filter((r) => r.discordId === "NOT LINKED");
  if (unlinked.length > 0) {
    console.log(`\n${unlinked.length} matched roster entr${unlinked.length === 1 ? "y has" : "ies have"} no Discord ID stored:`);
    for (const r of unlinked) console.log(`  - ${r.roster}`);
  }

  if (missing.length > 0) {
    console.log(`\n${missing.length} name${missing.length === 1 ? "" : "s"} not found on the roster:`);
    for (const m of missing) console.log(`  - ${m.requested}`);
  }

  if (process.argv.includes("--csv")) {
    const csv = [
      "Requested name,Roster name,Call sign,Rank,Discord ID,Activity,Match",
      ...rows.map((r) =>
        [r.requested, r.roster, r.callSign, r.rank, r.discordId, r.activity, r.confidence]
          .map((f) => (f.includes(",") ? `"${f.replace(/"/g, '""')}"` : f))
          .join(",")
      ),
      ...missing.map((m) => `${m.requested},NOT FOUND,,,,,none`),
    ].join("\n");
    writeFileSync("discord-ids.csv", csv, "utf8");
    console.log("\nWrote discord-ids.csv");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
