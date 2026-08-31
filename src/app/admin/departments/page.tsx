"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { toast } from "sonner";
import {
  Building2,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Loader2,
  Plus,
  Trash2,
  XCircle,
} from "lucide-react";
import { fetchJson, fetchList, errorMessage } from "@/lib/fetch-json";
import { RANK_LIST } from "@/lib/constants";
import {
  DEPARTMENT_ROLES,
  QUESTION_TYPES,
  QUESTION_TYPE_LABELS,
  departmentTag,
  questionOptions,
  readAnswers,
  type QuestionType,
} from "@/lib/departments";
import { DepartmentMark, DepartmentMarkLegend } from "@/components/DepartmentMark";

interface Question {
  id: string;
  departmentId: string;
  label: string;
  type: string;
  options: unknown;
  placeholder: string | null;
  required: boolean;
  order: number;
}

interface Department {
  id: string;
  name: string;
  tag: string | null;
  color: string;
  description: string | null;
  documentLink: string | null;
  webhookUrl: string | null;
  openForApplications: boolean;
  minRank: string | null;
  discordRoleId: string | null;
  order: number;
  /**
   * Absent when the signed-in admin lacks the "templates" permission — the
   * departments endpoint hands that caller a reduced projection — so every
   * read of it goes through `questionsOf` below.
   */
  questions?: Question[];
  _count?: { memberships: number; applications: number };
}

const questionsOf = (dept: Department): Question[] => dept.questions ?? [];

interface Application {
  id: string;
  departmentId: string;
  characterName: string;
  discordId: string;
  currentRank: string;
  answers: unknown;
  status: string;
  reviewedBy: string | null;
  reviewNote: string | null;
  createdAt: string;
  department: { id: string; name: string; tag: string | null; color: string };
}

interface Membership {
  id: string;
  departmentId: string;
  memberId: string;
  role: string;
  member: { id: string; name: string; callSign: string | null; rank: string; activity: string };
}

interface RosterSection {
  members: { id: string; name: string; callSign?: string | null; rank: string }[];
}

const TABS = ["applications", "form", "members", "settings"] as const;
type Tab = (typeof TABS)[number];

const TAB_LABELS: Record<Tab, string> = {
  applications: "Applications",
  form: "Join Form",
  members: "Members",
  settings: "Settings",
};

const inputClass =
  "w-full bg-[#0a0a0a] border border-[#1e1e1e] rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#dc2626]";

export default function AdminDepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [roster, setRoster] = useState<RosterSection["members"]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("applications");
  const [newDeptName, setNewDeptName] = useState("");
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [deptList, appList, memberList, sections] = await Promise.all([
        fetchList<Department>("/api/admin/departments"),
        fetchList<Application>("/api/department-applications"),
        fetchList<Membership>("/api/department-memberships"),
        fetchList<RosterSection>("/api/members"),
      ]);
      setDepartments(deptList);
      setApplications(appList);
      setMemberships(memberList);
      setRoster(sections.flatMap((s) => s.members));
      setSelectedId((current) => current ?? deptList[0]?.id ?? null);
    } catch (err) {
      setError(errorMessage(err));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const selected = departments.find((d) => d.id === selectedId) ?? null;

  const deptApplications = useMemo(
    () => applications.filter((a) => a.departmentId === selectedId),
    [applications, selectedId]
  );
  const deptMemberships = useMemo(
    () =>
      memberships
        .filter((m) => m.departmentId === selectedId)
        .sort(
          (a, b) =>
            DEPARTMENT_ROLES.indexOf(a.role as (typeof DEPARTMENT_ROLES)[number]) -
              DEPARTMENT_ROLES.indexOf(b.role as (typeof DEPARTMENT_ROLES)[number]) ||
            a.member.name.localeCompare(b.member.name)
        ),
    [memberships, selectedId]
  );

  const pendingCountFor = useCallback(
    (departmentId: string) =>
      applications.filter((a) => a.departmentId === departmentId && a.status === "Pending").length,
    [applications]
  );

  // ---- Department CRUD --------------------------------------------------

  const createDepartment = async () => {
    if (!newDeptName.trim()) return;
    setCreating(true);
    try {
      const created = await fetchJson<Department>("/api/admin/departments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newDeptName.trim(), order: departments.length }),
      });
      setNewDeptName("");
      toast.success(`${created.name} created`);
      setSelectedId(created.id);
      setTab("form");
      await load();
    } catch (err) {
      toast.error(errorMessage(err));
    }
    setCreating(false);
  };

  const saveDepartment = async (id: string, patch: Partial<Department>) => {
    try {
      await fetchJson("/api/admin/departments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...patch }),
      });
      await load();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const deleteDepartment = async (dept: Department) => {
    if (
      !confirm(
        `Delete ${dept.name}? Its join form, applications and member list go with it. Roster rows are not touched.`
      )
    ) {
      return;
    }
    try {
      await fetchJson(`/api/admin/departments?id=${dept.id}`, { method: "DELETE" });
      toast.success(`${dept.name} deleted`);
      setSelectedId(null);
      await load();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  // ---- Questions --------------------------------------------------------

  const addQuestion = async () => {
    if (!selected) return;
    try {
      await fetchJson("/api/admin/departments/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          departmentId: selected.id,
          label: "New question",
          type: "textarea",
        }),
      });
      await load();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const saveQuestion = async (id: string, patch: Record<string, unknown>) => {
    try {
      await fetchJson("/api/admin/departments/questions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...patch }),
      });
      await load();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const deleteQuestion = async (id: string) => {
    try {
      await fetchJson(`/api/admin/departments/questions?id=${id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const moveQuestion = async (index: number, direction: -1 | 1) => {
    if (!selected) return;
    const ordered = [...questionsOf(selected)];
    const target = index + direction;
    if (target < 0 || target >= ordered.length) return;
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    try {
      await fetchJson("/api/admin/departments/questions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: ordered.map((q) => q.id) }),
      });
      await load();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  // ---- Applications -----------------------------------------------------

  const reviewApplication = async (id: string, status: string, role?: string) => {
    setBusyId(id);
    try {
      await fetchJson(`/api/department-applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, role }),
      });
      toast.success(`Application ${status.toLowerCase()}`);
      await load();
    } catch (err) {
      toast.error(errorMessage(err));
    }
    setBusyId(null);
  };

  // ---- Memberships ------------------------------------------------------

  const addMember = async (memberId: string, role: string) => {
    if (!selected || !memberId) return;
    try {
      await fetchJson("/api/department-memberships", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ departmentId: selected.id, memberId, role }),
      });
      await load();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const setMembershipRole = async (id: string, role: string) => {
    try {
      await fetchJson("/api/department-memberships", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, role }),
      });
      await load();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const removeMembership = async (id: string) => {
    try {
      await fetchJson(`/api/department-memberships?id=${id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  if (loading) {
    return (
      <div>
        <Skeleton className="h-8 w-48 mb-2" />
        <Skeleton className="h-4 w-80 mb-8" />
        <div className="grid grid-cols-1 lg:grid-cols-[16rem_1fr] gap-6">
          <Skeleton className="h-96 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return <ErrorState title="Failed to load departments" message={error} onRetry={load} />;
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-[family-name:var(--font-oswald)] text-2xl font-bold text-white uppercase">
          Departments
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Create departments, build their join forms, review applications and set who runs them.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[16rem_1fr] gap-6 items-start">
        {/* Department list */}
        <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl p-4">
          <div className="flex gap-2 mb-4">
            <Input
              value={newDeptName}
              onChange={(e) => setNewDeptName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createDepartment()}
              placeholder="New department"
              className="bg-[#0a0a0a] border-[#1e1e1e]"
            />
            <Button
              onClick={createDepartment}
              disabled={!newDeptName.trim() || creating}
              className="bg-[#dc2626] text-black hover:bg-[#b91c1c] shrink-0"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            </Button>
          </div>

          <div className="space-y-1">
            {departments.map((dept) => {
              const pending = pendingCountFor(dept.id);
              return (
                <button
                  key={dept.id}
                  onClick={() => setSelectedId(dept.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between gap-2 transition-colors ${
                    dept.id === selectedId
                      ? "bg-[#dc2626]/10 text-white"
                      : "text-gray-400 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: dept.color }}
                    />
                    <span className="truncate">{dept.name}</span>
                  </span>
                  {pending > 0 && (
                    <span className="shrink-0 text-xs bg-yellow-500/20 text-yellow-400 rounded-full px-2">
                      {pending}
                    </span>
                  )}
                </button>
              );
            })}
            {departments.length === 0 && (
              <p className="text-gray-600 text-sm px-1">No departments yet.</p>
            )}
          </div>
        </div>

        {/* Selected department */}
        {!selected ? (
          <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl p-12 text-center">
            <Building2 className="w-10 h-10 text-gray-700 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">
              Create a department to build its join form.
            </p>
          </div>
        ) : (
          <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl">
            <div className="p-5 border-b border-[#1e1e1e]">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold"
                    style={{
                      color: selected.color,
                      backgroundColor: `${selected.color}1a`,
                      border: `1px solid ${selected.color}33`,
                    }}
                  >
                    {departmentTag(selected)}
                  </span>
                  <h2 className="font-[family-name:var(--font-oswald)] text-lg font-bold text-white uppercase">
                    {selected.name}
                  </h2>
                </div>
                <div className="text-xs text-gray-500">
                  {deptMemberships.length} member{deptMemberships.length === 1 ? "" : "s"} ·{" "}
                  {questionsOf(selected).length} question
                  {questionsOf(selected).length === 1 ? "" : "s"}
                </div>
              </div>

              <div className="flex gap-1 mt-4">
                {TABS.map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      tab === t
                        ? "bg-white/10 text-white"
                        : "text-gray-500 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    {TAB_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-5">
              {tab === "applications" && (
                <ApplicationsTab
                  applications={deptApplications}
                  busyId={busyId}
                  onReview={reviewApplication}
                />
              )}

              {tab === "form" && (
                <FormTab
                  department={selected}
                  onAdd={addQuestion}
                  onSave={saveQuestion}
                  onDelete={deleteQuestion}
                  onMove={moveQuestion}
                />
              )}

              {tab === "members" && (
                <MembersTab
                  memberships={deptMemberships}
                  roster={roster}
                  color={selected.color}
                  onAdd={addMember}
                  onSetRole={setMembershipRole}
                  onRemove={removeMembership}
                />
              )}

              {tab === "settings" && (
                <SettingsTab
                  department={selected}
                  onSave={saveDepartment}
                  onDelete={deleteDepartment}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */

function ApplicationsTab({
  applications,
  busyId,
  onReview,
}: {
  applications: Application[];
  busyId: string | null;
  onReview: (id: string, status: string, role?: string) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [roles, setRoles] = useState<Record<string, string>>({});

  const pending = applications.filter((a) => a.status === "Pending");
  const reviewed = applications.filter((a) => a.status !== "Pending");

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-white mb-3">Pending ({pending.length})</h3>
        {pending.length === 0 ? (
          <p className="text-gray-500 text-sm">No pending applications.</p>
        ) : (
          <div className="space-y-3">
            {pending.map((app) => {
              const answers = readAnswers(app.answers);
              const open = expanded === app.id;
              return (
                <div key={app.id} className="bg-[#0a0a0a] border border-[#1e1e1e] rounded-lg p-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="text-white font-medium">{app.characterName}</div>
                      <div className="text-gray-500 text-xs mt-0.5">
                        {app.currentRank} · Discord {app.discordId} ·{" "}
                        {new Date(app.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={roles[app.id] ?? "Member"}
                        onChange={(e) => setRoles((p) => ({ ...p, [app.id]: e.target.value }))}
                        className="h-8 rounded-md border border-[#1e1e1e] bg-[#111111] px-2 text-xs text-white"
                        title="Standing granted on approval"
                      >
                        {DEPARTMENT_ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                      <Button
                        size="sm"
                        onClick={() => onReview(app.id, "Approved", roles[app.id] ?? "Member")}
                        disabled={busyId === app.id}
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        {busyId === app.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <CheckCircle className="w-4 h-4" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => onReview(app.id, "Declined")}
                        disabled={busyId === app.id}
                        className="bg-red-600 hover:bg-red-700 text-white"
                      >
                        <XCircle className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {answers.length > 0 && (
                    <button
                      onClick={() => setExpanded(open ? null : app.id)}
                      className="mt-2 text-xs text-gray-500 hover:text-white inline-flex items-center gap-1"
                    >
                      {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      {open ? "Hide" : "Show"} {answers.length} answer
                      {answers.length === 1 ? "" : "s"}
                    </button>
                  )}
                  {open && (
                    <div className="mt-3 space-y-2 border-t border-[#1e1e1e] pt-3">
                      {answers.map((a, i) => (
                        <div key={`${a.questionId}-${i}`}>
                          <div className="text-xs text-gray-500">{a.label}</div>
                          <div className="text-sm text-gray-200 whitespace-pre-wrap">
                            {a.answer || "—"}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <h3 className="text-sm font-semibold text-white mb-3">Reviewed ({reviewed.length})</h3>
        {reviewed.length === 0 ? (
          <p className="text-gray-500 text-sm">Nothing reviewed yet.</p>
        ) : (
          <div className="space-y-2">
            {reviewed.map((app) => (
              <div
                key={app.id}
                className="bg-[#0a0a0a] border border-[#1e1e1e] rounded-lg px-4 py-2.5 flex items-center justify-between gap-3 opacity-75"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-white text-sm truncate">{app.characterName}</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded ${
                      app.status === "Approved"
                        ? "bg-green-500/20 text-green-400"
                        : "bg-red-500/20 text-red-400"
                    }`}
                  >
                    {app.status}
                  </span>
                </div>
                <span className="text-xs text-gray-600 shrink-0">
                  {app.reviewedBy ? `by ${app.reviewedBy}` : ""}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */

function FormTab({
  department,
  onAdd,
  onSave,
  onDelete,
  onMove,
}: {
  department: Department;
  onAdd: () => void;
  onSave: (id: string, patch: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
  onMove: (index: number, direction: -1 | 1) => void;
}) {
  return (
    <div>
      <p className="text-gray-500 text-sm mb-4">
        These questions are what an applicant sees. Tick <span className="text-red-400">Required</span>{" "}
        to make one mandatory — the form will not submit until it is answered.
      </p>

      <div className="space-y-3">
        {questionsOf(department).map((question, index) => (
          <QuestionEditor
            key={question.id}
            question={question}
            index={index}
            total={questionsOf(department).length}
            onSave={onSave}
            onDelete={onDelete}
            onMove={onMove}
          />
        ))}
        {questionsOf(department).length === 0 && (
          <p className="text-gray-600 text-sm">
            No questions yet — applicants will only be able to register interest.
          </p>
        )}
      </div>

      <Button onClick={onAdd} variant="outline" className="mt-4 border-[#1e1e1e] text-gray-300">
        <Plus className="w-4 h-4 mr-2" />
        Add question
      </Button>
    </div>
  );
}

function QuestionEditor({
  question,
  index,
  total,
  onSave,
  onDelete,
  onMove,
}: {
  question: Question;
  index: number;
  total: number;
  onSave: (id: string, patch: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
  onMove: (index: number, direction: -1 | 1) => void;
}) {
  const [label, setLabel] = useState(question.label);
  const [placeholder, setPlaceholder] = useState(question.placeholder ?? "");
  const [optionText, setOptionText] = useState(questionOptions(question).join("\n"));

  // Reset when the row is replaced by a reload, so an edit elsewhere is picked up.
  useEffect(() => {
    setLabel(question.label);
    setPlaceholder(question.placeholder ?? "");
    setOptionText(questionOptions(question).join("\n"));
  }, [question]);

  return (
    <div className="bg-[#0a0a0a] border border-[#1e1e1e] rounded-lg p-4 space-y-3">
      <div className="flex items-start gap-2">
        <div className="flex flex-col gap-0.5 pt-1">
          <button
            onClick={() => onMove(index, -1)}
            disabled={index === 0}
            className="text-gray-600 hover:text-white disabled:opacity-30"
            title="Move up"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
          <button
            onClick={() => onMove(index, 1)}
            disabled={index === total - 1}
            className="text-gray-600 hover:text-white disabled:opacity-30"
            title="Move down"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>

        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={() => label.trim() && label !== question.label && onSave(question.id, { label })}
          placeholder="Question text"
          className="bg-[#111111] border-[#1e1e1e]"
        />

        <select
          value={question.type}
          onChange={(e) => onSave(question.id, { type: e.target.value })}
          className="h-9 shrink-0 rounded-md border border-[#1e1e1e] bg-[#111111] px-2 text-sm text-white"
        >
          {QUESTION_TYPES.map((t) => (
            <option key={t} value={t}>
              {QUESTION_TYPE_LABELS[t as QuestionType]}
            </option>
          ))}
        </select>

        <button
          onClick={() => onDelete(question.id)}
          className="p-2 text-gray-600 hover:text-red-400 shrink-0"
          title="Delete question"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center gap-4 flex-wrap pl-6">
        <label className="flex items-center gap-2 text-sm text-gray-400">
          <input
            type="checkbox"
            checked={question.required}
            onChange={(e) => onSave(question.id, { required: e.target.checked })}
            className="h-4 w-4 accent-[#dc2626]"
          />
          Required
        </label>

        <Input
          value={placeholder}
          onChange={(e) => setPlaceholder(e.target.value)}
          onBlur={() =>
            placeholder !== (question.placeholder ?? "") &&
            onSave(question.id, { placeholder })
          }
          placeholder={
            question.type === "checkbox" ? "Tick-box wording" : "Hint text (optional)"
          }
          className="flex-1 min-w-48 h-8 text-xs bg-[#111111] border-[#1e1e1e]"
        />
      </div>

      {question.type === "select" && (
        <div className="pl-6">
          <Label className="text-gray-500 text-xs">Choices — one per line</Label>
          <textarea
            value={optionText}
            onChange={(e) => setOptionText(e.target.value)}
            onBlur={() =>
              onSave(question.id, {
                options: optionText
                  .split("\n")
                  .map((o) => o.trim())
                  .filter(Boolean),
              })
            }
            rows={3}
            className={`mt-1 resize-none text-xs ${inputClass}`}
          />
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */

function MembersTab({
  memberships,
  roster,
  color,
  onAdd,
  onSetRole,
  onRemove,
}: {
  memberships: Membership[];
  roster: { id: string; name: string; callSign?: string | null; rank: string }[];
  color: string;
  onAdd: (memberId: string, role: string) => void;
  onSetRole: (id: string, role: string) => void;
  onRemove: (id: string) => void;
}) {
  const [memberId, setMemberId] = useState("");
  const [role, setRole] = useState<string>("Member");

  const inDepartment = new Set(memberships.map((m) => m.memberId));
  const available = roster
    .filter((m) => !inDepartment.has(m.id))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div>
      <DepartmentMarkLegend className="mb-4" />

      <div className="flex gap-2 mb-5 flex-wrap">
        <select
          value={memberId}
          onChange={(e) => setMemberId(e.target.value)}
          className="h-9 flex-1 min-w-56 rounded-md border border-[#1e1e1e] bg-[#0a0a0a] px-3 text-sm text-white"
        >
          <option value="">Add a roster member…</option>
          {available.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
              {m.callSign ? ` (${m.callSign})` : ""} — {m.rank}
            </option>
          ))}
        </select>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="h-9 rounded-md border border-[#1e1e1e] bg-[#0a0a0a] px-3 text-sm text-white"
        >
          {DEPARTMENT_ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <Button
          onClick={() => {
            onAdd(memberId, role);
            setMemberId("");
          }}
          disabled={!memberId}
          className="bg-[#dc2626] text-black hover:bg-[#b91c1c]"
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      {memberships.length === 0 ? (
        <p className="text-gray-500 text-sm">Nobody is in this department yet.</p>
      ) : (
        <div className="space-y-1.5">
          {memberships.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between gap-3 bg-[#0a0a0a] border border-[#1e1e1e] rounded-lg px-3 py-2"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <DepartmentMark role={m.role} color={color} />
                <span className="text-white text-sm truncate">{m.member.name}</span>
                <span className="text-gray-600 text-xs shrink-0">
                  {m.member.callSign ?? "—"} · {m.member.rank}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <select
                  value={m.role}
                  onChange={(e) => onSetRole(m.id, e.target.value)}
                  className="h-8 rounded-md border border-[#1e1e1e] bg-[#111111] px-2 text-xs text-white"
                >
                  {DEPARTMENT_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => onRemove(m.id)}
                  className="p-1 text-gray-600 hover:text-red-400"
                  title="Remove from department"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */

function SettingsTab({
  department,
  onSave,
  onDelete,
}: {
  department: Department;
  onSave: (id: string, patch: Partial<Department>) => void;
  onDelete: (dept: Department) => void;
}) {
  const [draft, setDraft] = useState({
    name: department.name,
    tag: department.tag ?? "",
    color: department.color,
    description: department.description ?? "",
    documentLink: department.documentLink ?? "",
    webhookUrl: department.webhookUrl ?? "",
    minRank: department.minRank ?? "",
    discordRoleId: department.discordRoleId ?? "",
    openForApplications: department.openForApplications,
  });

  useEffect(() => {
    setDraft({
      name: department.name,
      tag: department.tag ?? "",
      color: department.color,
      description: department.description ?? "",
      documentLink: department.documentLink ?? "",
      webhookUrl: department.webhookUrl ?? "",
      minRank: department.minRank ?? "",
      discordRoleId: department.discordRoleId ?? "",
      openForApplications: department.openForApplications,
    });
  }, [department]);

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label className="text-gray-400 text-sm">Name</Label>
          <Input
            value={draft.name}
            onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))}
            className="mt-1 bg-[#0a0a0a] border-[#1e1e1e]"
          />
        </div>
        <div>
          <Label className="text-gray-400 text-sm">Roster tag</Label>
          <Input
            value={draft.tag}
            onChange={(e) => setDraft((p) => ({ ...p, tag: e.target.value }))}
            placeholder={department.name}
            className="mt-1 bg-[#0a0a0a] border-[#1e1e1e]"
          />
          <p className="text-gray-600 text-xs mt-1">
            The roster column header. Defaults to the name.
          </p>
        </div>
      </div>

      <div>
        <Label className="text-gray-400 text-sm">Description</Label>
        <textarea
          value={draft.description}
          onChange={(e) => setDraft((p) => ({ ...p, description: e.target.value }))}
          rows={3}
          placeholder="Shown above the join form."
          className={`mt-1 resize-none ${inputClass}`}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label className="text-gray-400 text-sm">Minimum rank</Label>
          <select
            value={draft.minRank}
            onChange={(e) => setDraft((p) => ({ ...p, minRank: e.target.value }))}
            className={`mt-1 h-9 ${inputClass}`}
          >
            <option value="">Open to all ranks</option>
            {RANK_LIST.map((r) => (
              <option key={r} value={r}>
                {r} and above
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label className="text-gray-400 text-sm">Tag colour</Label>
          <div className="mt-1 flex items-center gap-2">
            <input
              type="color"
              value={draft.color}
              onChange={(e) => setDraft((p) => ({ ...p, color: e.target.value }))}
              className="w-10 h-9 rounded cursor-pointer bg-transparent"
            />
            <Input
              value={draft.color}
              onChange={(e) => setDraft((p) => ({ ...p, color: e.target.value }))}
              className="bg-[#0a0a0a] border-[#1e1e1e]"
            />
          </div>
        </div>
      </div>

      <div>
        <Label className="text-gray-400 text-sm">Discord webhook URL</Label>
        <Input
          value={draft.webhookUrl}
          onChange={(e) => setDraft((p) => ({ ...p, webhookUrl: e.target.value }))}
          placeholder="https://discord.com/api/webhooks/..."
          className="mt-1 bg-[#0a0a0a] border-[#1e1e1e]"
        />
        <p className="text-gray-600 text-xs mt-1">
          Where this department&apos;s applications and approvals are posted. Falls back to the shared
          department webhook in Notify Settings.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label className="text-gray-400 text-sm">Document link</Label>
          <Input
            value={draft.documentLink}
            onChange={(e) => setDraft((p) => ({ ...p, documentLink: e.target.value }))}
            placeholder="https://..."
            className="mt-1 bg-[#0a0a0a] border-[#1e1e1e]"
          />
        </div>
        <div>
          <Label className="text-gray-400 text-sm">Discord role ID</Label>
          <Input
            value={draft.discordRoleId}
            onChange={(e) => setDraft((p) => ({ ...p, discordRoleId: e.target.value }))}
            placeholder="Granted on approval (optional)"
            className="mt-1 bg-[#0a0a0a] border-[#1e1e1e]"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-300">
        <input
          type="checkbox"
          checked={draft.openForApplications}
          onChange={(e) => setDraft((p) => ({ ...p, openForApplications: e.target.checked }))}
          className="h-4 w-4 accent-[#dc2626]"
        />
        Accepting applications
      </label>

      <div className="flex items-center gap-3 pt-2">
        <Button
          onClick={() => onSave(department.id, draft)}
          className="bg-[#dc2626] text-black hover:bg-[#b91c1c]"
        >
          Save changes
        </Button>
        <Button
          variant="outline"
          onClick={() => onDelete(department)}
          className="border-red-900/50 text-red-400 hover:bg-red-500/10"
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Delete department
        </Button>
      </div>
    </div>
  );
}
