import Link from "next/link";
import { ArrowRight, CheckCircle, ClipboardList, GraduationCap, Lock } from "lucide-react";
import { prisma } from "@/lib/db/prisma";
import { cached } from "@/lib/db/cache";
import { optionalAccess } from "@/lib/auth/api";
import { meetsMinRank, minRankMessage, parseQuestions } from "@/lib/tests";

interface Card {
  id: string;
  title: string;
  description: string | null;
  questionCount: number;
  timeLimitMinutes: number | null;
  minRank: string | null;
  eligible: boolean;
  /** The viewer's latest submitted result, when the test shows results. */
  result: { score: number | null; passed: boolean | null; marking: boolean } | null;
  attemptsLeft: number | null;
}

const CARD =
  "group flex flex-col rounded-xl border p-6 transition-all border-white/[0.08] bg-gradient-to-b from-[#131319] to-[#0e0e14]";
const CARD_LINK = `${CARD} hover:-translate-y-0.5 hover:border-red-600/50 hover:shadow-xl hover:shadow-red-950/30`;

/**
 * Training & quiz cards for the homepage's Applications row, styled like the
 * cards beside them. One card per published test an admin marked "Show on
 * homepage", shown to everyone; only a signed-in member who meets the test's
 * minimum rank can open it, and everyone else is told which rank they need.
 * The test route enforces the same rule.
 *
 * With no test on the homepage — or the database unreachable, which must not
 * take the homepage down — a single card leads to the list of tests instead.
 */
export async function TrainingCards() {
  let cards: Card[] = [];
  let signedIn = false;
  try {
    const [tests, access] = await Promise.all([
      cached("home:tests", 60_000, () =>
        prisma.test.findMany({ where: { status: "Published", showOnHomepage: true }, orderBy: { title: "asc" } })
      ),
      optionalAccess().catch(() => null),
    ]);
    signedIn = !!access;

    const attempts =
      access && tests.length
        ? await prisma.testAttempt.findMany({
            where: { discordId: access.discordId, testId: { in: tests.map((t) => t.id) }, status: { not: "In Progress" } },
            orderBy: { submittedAt: "desc" },
            select: { testId: true, status: true, score: true, passed: true },
          })
        : [];

    cards = tests.map((t) => {
      const mine = attempts.filter((a) => a.testId === t.id);
      const latest = mine[0];
      return {
        id: t.id,
        title: t.title,
        description: t.description,
        questionCount: parseQuestions(t.questions).length,
        timeLimitMinutes: t.timeLimitMinutes,
        minRank: t.minRank,
        eligible: !!access && meetsMinRank(t.minRank, { rank: access.memberRank, isSuperAdmin: access.isSuperAdmin }),
        result:
          latest && t.showResults
            ? { score: latest.score, passed: latest.passed, marking: latest.status === "Awaiting Grading" }
            : null,
        attemptsLeft: t.maxAttempts === null ? null : Math.max(0, t.maxAttempts - mine.length),
      };
    });
  } catch (error) {
    console.error("Training cards failed to load:", error);
  }

  if (cards.length === 0) {
    return (
      <Link href="/tests" className={CARD_LINK}>
        <CardTop icon={<GraduationCap className="h-5 w-5" />} chip="EMS members · Discord sign-in" />
        <h3 className="mt-5 font-[family-name:var(--font-oswald)] text-xl font-semibold uppercase tracking-wide text-white">
          Training &amp; Quizzes
        </h3>
        <p className="mt-2 flex-1 text-sm leading-relaxed text-gray-400">
          Take the theory tests and quizzes set by the training team. Your result appears the moment you finish.
        </p>
        <Cta>View tests</Cta>
      </Link>
    );
  }

  return (
    <>
      {cards.map((c) => {
        const locked = signedIn && !c.eligible;
        const details = [`${c.questionCount} questions`, c.timeLimitMinutes ? `${c.timeLimitMinutes} min` : null].filter(Boolean).join(" · ");
        const body = (
          <>
            <CardTop
              icon={locked ? <Lock className="h-5 w-5" /> : <ClipboardList className="h-5 w-5" />}
              muted={locked}
              chip={c.minRank ? `${c.minRank} & above` : "All ranks"}
            />
            <h3 className="mt-5 font-[family-name:var(--font-oswald)] text-xl font-semibold uppercase tracking-wide text-white">{c.title}</h3>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-gray-400">
              {c.description ?? "A training test set by the training team."}
              <span className="mt-1 block text-xs text-gray-500">{details}</span>
            </p>
            {!signedIn ? (
              <Cta>Sign in to take this test</Cta>
            ) : locked ? (
              <span className="mt-6 text-sm font-semibold text-amber-300">{minRankMessage(c.minRank ?? "")}</span>
            ) : c.result?.marking ? (
              <span className="mt-6 text-sm font-semibold text-sky-300">Submitted — being marked</span>
            ) : c.result && c.result.score !== null ? (
              <span className={`mt-6 inline-flex items-center gap-1.5 text-sm font-semibold ${c.result.passed ? "text-emerald-300" : "text-red-300"}`}>
                {c.result.passed && <CheckCircle className="h-4 w-4" />}
                {c.result.passed ? "Passed" : "Not passed"} · {c.result.score}%
              </span>
            ) : c.attemptsLeft === 0 ? (
              <span className="mt-6 text-sm font-semibold text-gray-400">Submitted</span>
            ) : (
              <Cta>Start test</Cta>
            )}
          </>
        );

        // A locked card is shown but leads nowhere, so nobody opens a test they cannot start.
        return locked ? (
          <div key={c.id} aria-disabled className={`${CARD} cursor-not-allowed opacity-80`}>
            {body}
          </div>
        ) : (
          <Link key={c.id} href={`/tests/${c.id}`} className={CARD_LINK}>
            {body}
          </Link>
        );
      })}
    </>
  );
}

function CardTop({ icon, chip, muted }: { icon: React.ReactNode; chip: string; muted?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className={`flex h-11 w-11 items-center justify-center rounded-lg ${muted ? "bg-white/[0.05] text-gray-500" : "bg-red-600/15 text-red-500"}`}>
        {icon}
      </span>
      <span className="rounded-full border border-white/[0.08] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
        {chip}
      </span>
    </div>
  );
}

function Cta({ children }: { children: React.ReactNode }) {
  return (
    <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-red-400 transition-colors group-hover:text-red-300">
      {children}
      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
    </span>
  );
}
