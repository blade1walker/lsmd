import Link from "next/link";
import { ArrowRight, CheckCircle, ClipboardList, Lock, ShieldAlert, Timer } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { optionalAccess } from "@/lib/api-auth";
import { meetsMinRank, minRankMessage, parseQuestions } from "@/lib/tests";

interface Card {
  id: string;
  title: string;
  description: string | null;
  questionCount: number;
  timeLimitMinutes: number | null;
  minRank: string | null;
  examMode: boolean;
  eligible: boolean;
  /** The viewer's latest submitted result, when the test shows results. */
  result: { score: number | null; passed: boolean | null; marking: boolean } | null;
  attemptsLeft: number | null;
}

/**
 * The Training Assessments section of the homepage: every published test an
 * admin marked "Show on homepage". Listed for everyone; only a signed-in
 * member who meets the test's minimum rank can open it, and everyone else is
 * told which rank they need. The test route enforces the same rule.
 *
 * Renders nothing when no test is on the homepage, or when the database is
 * unreachable — a test listing failing must not take the homepage down.
 */
export async function TrainingAssessments() {
  let cards: Card[];
  let signedIn = false;
  try {
    const [tests, access] = await Promise.all([
      prisma.test.findMany({ where: { status: "Published", showOnHomepage: true }, orderBy: { title: "asc" } }),
      optionalAccess().catch(() => null),
    ]);
    if (tests.length === 0) return null;
    signedIn = !!access;

    const attempts = access
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
        examMode: t.examMode,
        eligible: !!access && meetsMinRank(t.minRank, { rank: access.memberRank, isSuperAdmin: access.isSuperAdmin }),
        result:
          latest && t.showResults
            ? { score: latest.score, passed: latest.passed, marking: latest.status === "Awaiting Grading" }
            : null,
        attemptsLeft: t.maxAttempts === null ? null : Math.max(0, t.maxAttempts - mine.length),
      };
    });
  } catch (error) {
    console.error("Training assessments section failed to load:", error);
    return null;
  }

  return (
    <section id="training" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-16 sm:px-6 md:py-20">
      <div className="max-w-2xl">
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-red-500">Training</p>
        <h2 className="mt-3 font-[family-name:var(--font-oswald)] text-3xl font-bold uppercase tracking-wide text-white sm:text-4xl">
          Training Assessments
        </h2>
        <p className="mt-3 text-gray-400">
          Theory tests and quizzes set by the training team. Each one shows the rank it is open to — your result appears the
          moment you finish.
        </p>
      </div>

      <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => {
          const locked = signedIn && !c.eligible;
          const body = (
            <>
              <div className="flex items-start justify-between gap-3">
                <span className={`flex h-11 w-11 items-center justify-center rounded-lg ${locked ? "bg-white/[0.05] text-gray-500" : "bg-red-600/15 text-red-500"}`}>
                  {locked ? <Lock className="h-5 w-5" /> : <ClipboardList className="h-5 w-5" />}
                </span>
                <span className="rounded-full border border-white/[0.08] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                  {c.minRank ? `${c.minRank} & above` : "All ranks"}
                </span>
              </div>
              <h3 className="mt-5 font-[family-name:var(--font-oswald)] text-xl font-semibold uppercase tracking-wide text-white">{c.title}</h3>
              {c.description && <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-gray-400">{c.description}</p>}
              <p className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                <span>{c.questionCount} questions</span>
                {c.timeLimitMinutes && (
                  <span className="inline-flex items-center gap-1">
                    <Timer className="h-3 w-3" />
                    {c.timeLimitMinutes} min
                  </span>
                )}
                {c.examMode && (
                  <span className="inline-flex items-center gap-1">
                    <ShieldAlert className="h-3 w-3" />
                    Exam mode
                  </span>
                )}
              </p>

              <div className="mt-auto pt-6 text-sm">
                {!signedIn ? (
                  <span className="inline-flex items-center gap-2 font-semibold text-red-400">
                    Sign in to take this test
                    <ArrowRight className="h-4 w-4" />
                  </span>
                ) : locked ? (
                  <span className="font-semibold text-amber-300">{minRankMessage(c.minRank ?? "")}</span>
                ) : c.result?.marking ? (
                  <span className="text-sky-300">Submitted — being marked</span>
                ) : c.result && c.result.score !== null ? (
                  <span className={`inline-flex items-center gap-2 font-semibold ${c.result.passed ? "text-emerald-300" : "text-red-300"}`}>
                    {c.result.passed && <CheckCircle className="h-4 w-4" />}
                    {c.result.passed ? "Passed" : "Not passed"} · {c.result.score}%
                    {!c.result.passed && c.attemptsLeft !== 0 && <span className="font-normal text-gray-400">· try again</span>}
                  </span>
                ) : c.attemptsLeft === 0 ? (
                  <span className="text-gray-400">Submitted</span>
                ) : (
                  <span className="inline-flex items-center gap-2 font-semibold text-red-400">
                    Start test
                    <ArrowRight className="h-4 w-4" />
                  </span>
                )}
              </div>
            </>
          );

          // A locked card is shown but leads nowhere, so nobody opens a test they cannot start.
          return locked ? (
            <div key={c.id} aria-disabled className="flex cursor-not-allowed flex-col rounded-xl border border-white/[0.06] bg-[#0e0e14] p-6 opacity-80">
              {body}
            </div>
          ) : (
            <Link
              key={c.id}
              href={`/tests/${c.id}`}
              className="group flex flex-col rounded-xl border border-white/[0.08] bg-gradient-to-b from-[#131319] to-[#0e0e14] p-6 transition-all hover:-translate-y-0.5 hover:border-red-600/50 hover:shadow-xl hover:shadow-red-950/30"
            >
              {body}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
