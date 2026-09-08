"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import FieldInput from "@/components/medical/FieldInput";
import { fetchJson, errorMessage } from "@/lib/fetch-json";
import {
  parseFields,
  parseExportConfig,
  visibleFields,
  validateAnswers,
  groupBySection,
  displayAnswer,
  isLocked,
  PRESENTATIONAL_TYPES,
  type Answers,
} from "@/lib/medical";
import { exportDocumentPdf, type PdfSettings } from "@/lib/medical-pdf";
import { toast } from "sonner";
import { ArrowLeft, Download, Save, ShieldCheck, Unlock, Archive, Trash2 } from "lucide-react";

interface DocumentDetail {
  id: string;
  documentNumber: string | null;
  status: string;
  patientName: string;
  patientStateId: string | null;
  authorName: string;
  authorRank: string | null;
  authorDiscordId: string;
  signedBy: string | null;
  signedAt: string | null;
  finalizedAt: string | null;
  createdAt: string;
  answers: Answers;
  documentType: { id: string; name: string; numberPrefix: string };
  formVersion: {
    id: string;
    version: string;
    fields: unknown;
    exportConfig: unknown;
    signatureMode: string;
    form: { id: string; name: string };
  };
  patient: { id: string; name: string; rank: string | null; callSign: string | null; dept: string | null } | null;
}

const STATUS_STYLES: Record<string, string> = {
  Draft: "bg-gray-500/15 text-gray-400",
  Review: "bg-yellow-500/15 text-yellow-400",
  Finalized: "bg-green-500/15 text-green-400",
  Archived: "bg-red-500/15 text-red-400",
};

export default function MedicalDocumentPage() {
  const { documentId } = useParams<{ documentId: string }>();
  const router = useRouter();

  const [doc, setDoc] = useState<DocumentDetail | null>(null);
  const [settings, setSettings] = useState<PdfSettings | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [signature, setSignature] = useState("");
  const [patientName, setPatientName] = useState("");
  const [patientStateId, setPatientStateId] = useState("");
  const [signed, setSigned] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"fill" | "review">("fill");

  const load = useCallback(async () => {
    setError(null);
    try {
      const [detail, letterhead] = await Promise.all([
        fetchJson<DocumentDetail>(`/api/medical/documents/${documentId}`),
        fetchJson<PdfSettings>("/api/medical/settings"),
      ]);
      setDoc(detail);
      setSettings(letterhead);
      setAnswers(detail.answers ?? {});
      setSignature(detail.signedBy ?? "");
      setPatientName(detail.patientName);
      setPatientStateId(detail.patientStateId ?? "");
      setSigned(!!detail.signedAt);
      setDirty(false);
      if (isLocked(detail.status)) setMode("review");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    load();
  }, [load]);

  const fields = useMemo(() => parseFields(doc?.formVersion.fields), [doc]);
  const shown = useMemo(() => visibleFields(fields, answers), [fields, answers]);
  const problems = useMemo(() => validateAnswers(fields, answers), [fields, answers]);
  const locked = doc ? isLocked(doc.status) : false;
  const signatureMode = doc?.formVersion.signatureMode ?? "optional";

  const setAnswer = (name: string, value: unknown) => {
    setAnswers((prev) => ({ ...prev, [name]: value }));
    setDirty(true);
  };

  const save = async () => {
    setBusy(true);
    try {
      const updated = await fetchJson<DocumentDetail>(`/api/medical/documents/${documentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers, patientName, patientStateId }),
      });
      setDoc(updated);
      setDirty(false);
      toast.success("Draft saved");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const finalize = async () => {
    if (problems.length > 0) {
      toast.error(problems[0]);
      setMode("fill");
      return;
    }
    if (!confirm("Finalize this document? It receives its official number and becomes read-only.")) return;

    setBusy(true);
    try {
      const finalized = await fetchJson<DocumentDetail>(
        `/api/medical/documents/${documentId}/finalize`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            answers,
            patientName,
            patientStateId,
            signed,
            signedBy: signature.trim() || undefined,
          }),
        }
      );
      setDoc(finalized);
      setAnswers(finalized.answers ?? {});
      setDirty(false);
      setMode("review");
      toast.success(`Issued as ${finalized.documentNumber}`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const transition = async (action: "reopen" | "archive") => {
    const reason =
      action === "reopen" ? prompt("Why is this document being reopened? (recorded in the audit log)") : "";
    if (action === "reopen" && reason === null) return;

    setBusy(true);
    try {
      const updated = await fetchJson<DocumentDetail>(`/api/medical/documents/${documentId}/reopen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason }),
      });
      setDoc(updated);
      setMode(action === "reopen" ? "fill" : "review");
      toast.success(action === "reopen" ? "Reopened for correction" : "Archived");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const exportPdf = async () => {
    if (!doc || !settings) return;
    setBusy(true);
    try {
      const { warnings } = await exportDocumentPdf({ ...doc, answers }, settings);
      // The PDF is already downloaded at this point; these say what did not
      // make it onto it, which is otherwise invisible.
      for (const warning of warnings) toast.warning(warning);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    const issued = !!doc?.documentNumber;

    if (issued) {
      // Destroying an issued medical record is not something to hand to a
      // stray click, so it asks for the document number back rather than a
      // yes/no anyone dismisses on reflex.
      const typed = prompt(
        `Permanently delete ${doc.documentNumber}?\n\n` +
          "This destroys the record and cannot be undone — archiving keeps it readable instead.\n\n" +
          "Type the document number to confirm:"
      );
      if (typed === null) return;
      if (typed.trim() !== doc.documentNumber) {
        toast.error("That did not match the document number — nothing was deleted.");
        return;
      }
    } else if (!confirm("Delete this draft? This cannot be undone.")) {
      return;
    }

    setBusy(true);
    try {
      await fetchJson(`/api/medical/documents/${documentId}${issued ? "?permanent=1" : ""}`, {
        method: "DELETE",
      });
      toast.success(issued ? `${doc?.documentNumber} deleted` : "Draft deleted");
      router.push("/admin/medical");
    } catch (err) {
      toast.error(errorMessage(err));
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }
  if (error || !doc) {
    return <ErrorState title="Failed to load document" message={error ?? "Not found"} onRetry={load} />;
  }

  const config = parseExportConfig(doc.formVersion.exportConfig);
  const exportable = shown.filter((f) => f.inExport && !PRESENTATIONAL_TYPES.includes(f.type));

  return (
    <div className="max-w-4xl">
      <Link
        href="/admin/medical"
        className="inline-flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Medical Documentation
      </Link>

      <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-[family-name:var(--font-oswald)] text-2xl font-bold text-white uppercase">
              {doc.formVersion.form.name}
            </h1>
            <span className={`text-xs px-2 py-0.5 rounded ${STATUS_STYLES[doc.status] ?? ""}`}>
              {doc.status}
            </span>
          </div>
          <p className="text-gray-500 text-sm mt-1">
            {doc.documentNumber ? (
              <span className="font-[family-name:var(--font-mono)] text-gray-300">{doc.documentNumber}</span>
            ) : (
              "Not yet issued"
            )}
            {" · "}
            {doc.patientName}
            {doc.patientStateId && ` · State ID ${doc.patientStateId}`}
            {" · "}
            {doc.documentType.name} v{doc.formVersion.version}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {!locked && (
            <Button variant="outline" onClick={save} disabled={busy || !dirty}>
              <Save className="w-4 h-4 mr-2" />
              Save draft
            </Button>
          )}
          <Button variant="outline" onClick={exportPdf} disabled={busy}>
            <Download className="w-4 h-4 mr-2" />
            Export PDF
          </Button>
          {!locked && (
            <Button onClick={finalize} disabled={busy || problems.length > 0}>
              <ShieldCheck className="w-4 h-4 mr-2" />
              Finalize
            </Button>
          )}
          {locked && (
            <Button variant="outline" onClick={() => transition("reopen")} disabled={busy}>
              <Unlock className="w-4 h-4 mr-2" />
              Edit document
            </Button>
          )}
          {doc.status === "Finalized" && (
            <Button variant="outline" onClick={() => transition("archive")} disabled={busy}>
              <Archive className="w-4 h-4 mr-2" />
              Archive
            </Button>
          )}
          <Button
            variant="ghost"
            className="text-red-400"
            onClick={remove}
            disabled={busy}
            title={
              doc.documentNumber
                ? "Permanently destroys this issued record — archiving keeps it readable"
                : undefined
            }
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      {locked && (
        <div className="rounded-xl border border-green-600/30 bg-green-600/5 p-3 mb-4 text-sm text-green-300">
          This document is {doc.status.toLowerCase()} and read-only.{" "}
          <span className="text-green-200/80">
            &ldquo;Edit document&rdquo; reopens it for correction — it keeps its document number{" "}
            {doc.documentNumber ? <span className="font-[family-name:var(--font-mono)]">({doc.documentNumber})</span> : null}{" "}
            and the change is recorded in the audit log. Needs the{" "}
            <span className="font-[family-name:var(--font-mono)]">medical.review</span> permission.
          </span>
        </div>
      )}

      {!locked && doc.documentNumber && (
        <div className="rounded-xl border border-yellow-600/30 bg-yellow-600/5 p-3 mb-4 text-sm text-yellow-300">
          Reopened for correction. It already carries{" "}
          <span className="font-[family-name:var(--font-mono)]">{doc.documentNumber}</span> and keeps that
          number — finalize again when the correction is done.
        </div>
      )}

      <div className="flex gap-1 mb-4 border-b border-[#1e1e28]">
        {([
          ["fill", locked ? "Answers" : "Complete form"],
          ["review", "Review"],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setMode(key)}
            className={`px-4 py-2 text-sm border-b-2 -mb-px transition-colors ${
              mode === key ? "border-[#dc2626] text-white" : "border-transparent text-gray-500 hover:text-gray-300"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "fill" ? (
        <div className="rounded-xl border border-[#1e1e28] bg-card p-5 space-y-5">
          {!locked && (
            <div className="grid grid-cols-2 gap-4 pb-4 border-b border-[#1e1e28]">
              <div>
                <Label className="text-sm">Patient name</Label>
                <Input
                  value={patientName}
                  onChange={(e) => {
                    setPatientName(e.target.value);
                    setDirty(true);
                  }}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-sm">State ID</Label>
                <Input
                  value={patientStateId}
                  onChange={(e) => {
                    setPatientStateId(e.target.value);
                    setDirty(true);
                  }}
                  className="mt-1"
                  placeholder="e.g. 12345"
                />
              </div>
            </div>
          )}

          {shown.length === 0 ? (
            <p className="text-gray-500 text-sm">This form version has no fields.</p>
          ) : (
            shown.map((field) => (
              <FieldInput
                key={field.id}
                field={field}
                answers={answers}
                onChange={setAnswer}
                disabled={locked}
              />
            ))
          )}

          {signatureMode !== "disabled" && !locked && (
            <div className="pt-4 border-t border-[#1e1e28]">
              <Label className="text-sm">
                Doctor signature
                {signatureMode === "required" && <span className="text-red-500 ml-1">*</span>}
              </Label>
              <p className="text-gray-600 text-xs mt-1 mb-2">
                Typing your name here signs the document as {doc.authorName}
                {doc.authorRank ? `, ${doc.authorRank}` : ""}.
              </p>
              <Input
                value={signature}
                onChange={(e) => {
                  setSignature(e.target.value);
                  setSigned(e.target.value.trim().length > 0);
                }}
                placeholder="Type your full name to sign"
                className="max-w-sm font-[family-name:var(--font-mono)]"
              />
            </div>
          )}

          {problems.length > 0 && !locked && (
            <div className="rounded-lg border border-yellow-600/30 bg-yellow-600/5 p-3">
              <div className="text-yellow-300 text-sm font-medium mb-1">
                {problems.length} thing{problems.length === 1 ? "" : "s"} to finish before finalizing
              </div>
              <ul className="text-yellow-200/80 text-xs list-disc list-inside space-y-0.5">
                {problems.slice(0, 6).map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-[#1e1e28] bg-card p-6">
          <div className="text-center border-b border-[#1e1e28] pb-4 mb-5">
            {config.showLogo && settings?.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- a Blob URL on an unknown host; next/image would need it in remotePatterns.
              <img
                src={settings.logoUrl}
                alt=""
                className="max-h-16 mx-auto mb-3 object-contain"
              />
            )}
            <div className="text-[#dc2626] font-[family-name:var(--font-oswald)] font-bold text-lg uppercase">
              {settings?.departmentName ?? "Emergency Medical Services"}
            </div>
            {settings?.subDepartment && (
              <div className="text-gray-500 text-xs mt-0.5">{settings.subDepartment}</div>
            )}
            {[settings?.address, settings?.contact].filter(Boolean).length > 0 && (
              <div className="text-gray-600 text-[11px] mt-0.5">
                {[settings?.address, settings?.contact].filter(Boolean).join("  ·  ")}
              </div>
            )}

            {config.showSecondaryLetterhead && settings?.secondaryName && (
              <div className="mt-3 pt-3 border-t border-[#1e1e28]/60">
                {config.showSecondaryLogo && settings.secondaryLogoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element -- a Blob URL on an unknown host; next/image would need it in remotePatterns.
                  <img
                    src={settings.secondaryLogoUrl}
                    alt=""
                    className="max-h-10 mx-auto mb-2 object-contain"
                  />
                )}
                <div className="text-gray-200 text-sm font-semibold uppercase">{settings.secondaryName}</div>
                {[settings.secondaryAddress, settings.secondaryContact].filter(Boolean).length > 0 && (
                  <div className="text-gray-600 text-[11px] mt-0.5">
                    {[settings.secondaryAddress, settings.secondaryContact].filter(Boolean).join("  ·  ")}
                  </div>
                )}
                {config.showSecondaryDetail && settings.secondaryDetail && (
                  <div className="text-gray-600 text-[11px] mt-1 whitespace-pre-wrap">
                    {settings.secondaryDetail}
                  </div>
                )}
              </div>
            )}
            <div className="text-white font-semibold mt-3 uppercase text-sm">
              {config.documentTitle?.trim() || doc.formVersion.form.name}
            </div>
          </div>

          {groupBySection(exportable, config.sectionOrder).map((group) => (
            <div key={group.section || "_"} className="mb-5">
              {group.section && (
                <div className="text-[11px] uppercase tracking-wide text-[#dc2626] font-semibold mb-2">
                  {group.section}
                </div>
              )}
              <dl className="divide-y divide-[#1e1e28]/60">
                {group.fields.map((field) => (
                  <div key={field.id} className="grid grid-cols-[180px_1fr] gap-3 py-2">
                    <dt className="text-gray-500 text-xs">{field.label}</dt>
                    <dd className="text-gray-200 text-sm whitespace-pre-wrap">
                      {displayAnswer(field, answers)}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}

          {config.certificationStatement?.trim() && (
            <p className="text-gray-400 text-xs italic border-t border-[#1e1e28] pt-4">
              {config.certificationStatement}
            </p>
          )}

          <div className="mt-6 pt-4 border-t border-[#1e1e28] text-right">
            <div className="text-white text-sm">{doc.signedBy ?? (signature || doc.authorName)}</div>
            <div className="text-gray-500 text-xs">
              {[doc.authorRank, settings?.departmentName].filter(Boolean).join(" · ")}
            </div>
            {doc.signedAt && (
              <div className="text-gray-600 text-xs mt-0.5">
                Signed {new Date(doc.signedAt).toLocaleString()}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
