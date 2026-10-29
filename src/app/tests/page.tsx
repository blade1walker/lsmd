"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useSession, signIn } from "next-auth/react";
import { CheckCircle, ClipboardList, Lock, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { TestShell } from "@/components/tests/TestShell";
import { fetchList, errorMessage } from "@/lib/fetch-json";
import { useLoad } from "@/lib/use-load";

interface TestCard {
  id: string;
  title: string;
  description: string | null;
  questionCount: number;
  totalPoints: number;
  passingScore: number;
  timeLimitMinutes: number | null;
  maxAttempts: number | null;
  minRank: string | null;
  eligible: boolean;
  attemptsUsed: number;
  inProgress: boolean;
  passed: boolean;
  latest: { status: string; score: number | null; passed: boolean | null } | null;
}

export default function TestsPage() {
  const { status } = useSession();
  const [tests, setTests] = useState<TestCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setTests(await fetchList<TestCard>("/api/tests"));
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useLoad(load, status === "authenticated");

  if (status === "unauthenticated") {
    return (
      <TestShell>
        <div className="py-16 text-center">
          <ClipboardList className="mx-auto mb-4 h-12 w-12 text-[#dc2626]" />
          <h1 className="mb-2 font-[family-name:var(--font-oswald)] text-2xl font-bold uppercase text-white">Tests</h1>
          <p className="mb-6 text-gray-500">Sign in with Discord to take your tests. Your name is read from the roster.</p>
          <Button onClick={() => signIn("discord")} className="bg-[#5865F2] hover:bg-[#4752C4]">
            Sign in with Discord
          </Button>
        </div>
      </TestShell>
    );
  }

  return (
    <TestShell>
      <h1 className="mb-1 font-[family-name:var(--font-oswald)] text-3xl font-bold uppercase text-white">Tests</h1>
      <p className="mb-8 text-gray-500">Tests and quizzes set by command and the training team.</p>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
        </div>
      ) : error ? (
        <ErrorState title="Failed to load tests" message={error} onRetry={load} />
      ) : tests.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#1e1e1e] p-12 text-center text-sm text-gray-500">
          There are no tests open right now.
        </div>
      ) : (
        <div className="space-y-3">
          {tests.map((t) => {
            const left = t.maxAttempts === null ? null : Math.max(0, t.maxAttempts - t.attemptsUsed);
            return (
              <Link
                key={t.id}
                href={`/tests/${t.id}`}
                className="block rounded-xl border border-[#1e1e1e] bg-[#111] p-5 transition-colors hover:border-red-500/40"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="flex items-center gap-2 font-semibold text-white">
                      {t.title}
                      {t.passed && <CheckCircle className="h-4 w-4 text-emerald-400" />}
                    </h2>
                    {t.description && <p className="mt-1 text-sm text-gray-500">{t.description}</p>}
                    <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                      <span>{t.questionCount} questions</span>
                      <span>Pass mark {t.passingScore}%</span>
                      {t.timeLimitMinutes && (
                        <span className="inline-flex items-center gap-1">
                          <Timer className="h-3 w-3" />
                          {t.timeLimitMinutes} min
                        </span>
                      )}
                      {left !== null && <span>{left} attempt{left === 1 ? "" : "s"} left</span>}
                    </p>
                  </div>
                  <div className="text-right text-sm">
                    {!t.eligible && t.minRank ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs text-amber-300">
                        <Lock className="h-3 w-3" />
                        {t.minRank}+
                      </span>
                    ) : t.inProgress ? (
                      <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-xs text-amber-300">In progress</span>
                    ) : t.latest?.status === "Awaiting Grading" ? (
                      <span className="rounded-full bg-sky-500/15 px-2.5 py-1 text-xs text-sky-300">Being marked</span>
                    ) : t.latest?.score !== null && t.latest?.score !== undefined ? (
                      <span className={`font-bold ${t.latest.passed ? "text-emerald-300" : "text-red-300"}`}>{t.latest.score}%</span>
                    ) : t.latest ? (
                      <span className="text-xs text-gray-500">Submitted</span>
                    ) : (
                      <span className="text-xs text-red-400">Start →</span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </TestShell>
  );
}
