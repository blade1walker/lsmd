"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ClipboardList, Copy, Plus, Timer, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fetchJson, fetchList, errorMessage } from "@/lib/fetch-json";
import { TEST_PERMISSIONS } from "@/lib/constants";
import { STATUS_STYLES } from "@/lib/tests";
import { toast } from "sonner";

interface TestRow {
  id: string;
  title: string;
  description: string | null;
  status: string;
  passingScore: number;
  timeLimitMinutes: number | null;
  questionCount: number;
  totalPoints: number;
  attempts: number;
  passed: number;
  awaitingGrading: number;
  updatedAt: string;
}

export default function TestsPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const canManage =
    !!session?.user.isSuperAdmin ||
    TEST_PERMISSIONS.manage.some((p) => (session?.user.permissions ?? []).includes(p));

  const [tests, setTests] = useState<TestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setTests(await fetchList<TestRow>("/api/admin/tests"));
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const create = async (body: Record<string, unknown>) => {
    setBusy(true);
    try {
      const { id } = await fetchJson<{ id: string }>("/api/admin/tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      router.push(`/admin/tests/${id}`);
    } catch (err) {
      toast.error(errorMessage(err));
      setBusy(false);
    }
  };

  const remove = async (t: TestRow) => {
    if (!confirm(`Delete "${t.title}"? Its ${t.attempts} result${t.attempts === 1 ? "" : "s"} will be deleted too. This cannot be undone.`)) return;
    try {
      await fetchJson(`/api/admin/tests/${t.id}`, { method: "DELETE" });
      toast.success("Test deleted");
      load();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-28 rounded-xl" />
      </div>
    );
  }
  if (error) return <ErrorState title="Failed to load tests" message={error} onRetry={load} />;

  return (
    <div className="max-w-6xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-oswald)] text-2xl font-bold uppercase text-white">Tests & Quizzes</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            Build a test from multiple choice, checkbox, true/false, dropdown, short, long and number questions. Choice
            questions mark themselves; written answers wait for a grader. Members take published tests at{" "}
            <Link href="/tests" className="text-red-400 hover:underline">
              /tests
            </Link>
            .
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setCreating(true)} className="bg-[#dc2626] hover:bg-[#b91c1c]">
            <Plus className="mr-2 h-4 w-4" />
            New test
          </Button>
        )}
      </div>

      {tests.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#1e1e28] p-12 text-center">
          <ClipboardList className="mx-auto mb-3 h-10 w-10 text-gray-600" />
          <p className="text-sm text-gray-400">No tests yet.</p>
          {canManage && (
            <Button onClick={() => setCreating(true)} variant="outline" className="mt-4">
              <Plus className="mr-2 h-4 w-4" />
              Create your first test
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-3">
          {tests.map((t) => (
            <div key={t.id} className="rounded-xl border border-[#1e1e28] bg-card p-4 transition-colors hover:border-[#2e2e3a]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <Link href={`/admin/tests/${t.id}`} className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold text-white">{t.title}</h2>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[t.status] ?? STATUS_STYLES.Draft}`}>
                      {t.status}
                    </span>
                    {t.awaitingGrading > 0 && (
                      <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-[11px] font-medium text-sky-300">
                        {t.awaitingGrading} to grade
                      </span>
                    )}
                  </div>
                  {t.description && <p className="mt-1 line-clamp-2 text-sm text-gray-500">{t.description}</p>}
                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-500">
                    <span>
                      {t.questionCount} question{t.questionCount === 1 ? "" : "s"} · {t.totalPoints} pts
                    </span>
                    <span>Pass mark {t.passingScore}%</span>
                    {t.timeLimitMinutes && (
                      <span className="inline-flex items-center gap-1">
                        <Timer className="h-3 w-3" />
                        {t.timeLimitMinutes} min
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {t.attempts} attempt{t.attempts === 1 ? "" : "s"}
                      {t.attempts > 0 && ` · ${t.passed} passed`}
                    </span>
                  </div>
                </Link>
                <div className="flex items-center gap-1">
                  <Link href={`/admin/tests/${t.id}`}>
                    <Button variant="outline" size="sm">
                      {canManage ? "Edit" : "Results"}
                    </Button>
                  </Link>
                  {canManage && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Duplicate"
                        disabled={busy}
                        onClick={() => create({ title: `${t.title} (copy)`, duplicateOf: t.id })}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" title="Delete" onClick={() => remove(t)}>
                        <Trash2 className="h-4 w-4 text-red-400" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New test</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (title.trim()) create({ title });
            }}
          >
            <Label className="text-sm text-gray-400">Title</Label>
            <Input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. EMT Theory Exam"
              className="mt-1"
            />
            <p className="mt-2 text-xs text-gray-500">
              It starts as a draft — add questions, then publish it when it is ready.
            </p>
            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setCreating(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!title.trim() || busy} className="bg-[#dc2626] hover:bg-[#b91c1c]">
                Create & add questions
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
