"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import FieldInput from "@/components/medical/FieldInput";
import { fetchJson, fetchList, errorMessage } from "@/lib/fetch-json";
import {
  FIELD_TYPES,
  FIELD_TYPE_LABELS,
  CHOICE_TYPES,
  PRESENTATIONAL_TYPES,
  DEFAULT_EXPORT_CONFIG,
  FORM_STATUSES,
  parseFields,
  parseExportConfig,
  parseQuestionText,
  fieldNameFrom,
  visibleFields,
  type FormField,
  type FieldType,
  type ExportConfig,
  type Answers,
} from "@/lib/medical";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeft, ArrowUp, ArrowDown, Trash2, Plus, ChevronDown, ChevronRight, ClipboardPaste } from "lucide-react";

const PASTE_EXAMPLE = `# Examination
1. Was the patient injured? *
   - Yes
   - No
2. Describe the injury [long]
3. Date of examination [date]

# Assessment
Fitness status
  - Fit for duty
  - Fit with restrictions
  - Not fit
Doctor's remarks [long]`;

interface VersionRow {
  id: string;
  version: string;
  fields: unknown;
  exportConfig: unknown;
  signatureMode: string;
  published: boolean;
  createdAt: string;
  createdBy: string | null;
  _count: { documents: number };
}

interface FormDetail {
  id: string;
  name: string;
  description: string | null;
  department: string | null;
  status: string;
  documentType: { id: string; name: string; numberPrefix: string };
  versions: VersionRow[];
}

function blankField(type: FieldType, order: number, taken: string[]): FormField {
  const label = FIELD_TYPE_LABELS[type];
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    name: fieldNameFrom(label, taken),
    label,
    required: false,
    order,
    visible: true,
    inExport: true,
    options: CHOICE_TYPES.includes(type) ? ["Option 1", "Option 2"] : undefined,
  };
}

export default function FormBuilderPage() {
  const { formId } = useParams<{ formId: string }>();

  const [form, setForm] = useState<FormDetail | null>(null);
  const [fields, setFields] = useState<FormField[]>([]);
  const [exportConfig, setExportConfig] = useState<ExportConfig>(DEFAULT_EXPORT_CONFIG);
  const [signatureMode, setSignatureMode] = useState("optional");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [previewAnswers, setPreviewAnswers] = useState<Answers>({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<"fields" | "export" | "details" | "versions">("fields");
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [types, setTypes] = useState<{ id: string; name: string; numberPrefix: string }[]>([]);
  const [meta, setMeta] = useState({ name: "", description: "", department: "", documentTypeId: "", status: "Draft" });
  const [metaDirty, setMetaDirty] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [detail, typeList] = await Promise.all([
        fetchJson<FormDetail>(`/api/medical/forms/${formId}`),
        fetchList<{ id: string; name: string; numberPrefix: string }>("/api/medical/document-types"),
      ]);
      setForm(detail);
      setTypes(typeList);
      setMeta({
        name: detail.name,
        description: detail.description ?? "",
        department: detail.department ?? "",
        documentTypeId: detail.documentType.id,
        status: detail.status,
      });
      setMetaDirty(false);
      const latest = detail.versions[0];
      setFields(parseFields(latest?.fields));
      setExportConfig(parseExportConfig(latest?.exportConfig));
      setSignatureMode(latest?.signatureMode ?? "optional");
      setDirty(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [formId]);

  useEffect(() => {
    load();
  }, [load]);

  const latest = form?.versions[0];
  // Editing a published version doesn't overwrite it — the save mints the next
  // one. Saying so up front is the difference between a builder people trust
  // and one they are scared to touch.
  const willBranch = !!latest && (latest.published || latest._count.documents > 0);

  const mutate = (next: FormField[]) => {
    setFields(next.map((f, i) => ({ ...f, order: i })));
    setDirty(true);
  };

  const updateField = (id: string, patch: Partial<FormField>) =>
    mutate(fields.map((f) => (f.id === id ? { ...f, ...patch } : f)));

  /**
   * Retypes a field in place, keeping its name so answers already recorded
   * under it stay attached, and carrying the rest of its configuration across.
   *
   * Existing documents are untouched regardless: they render against the form
   * version they were filled in on, and this edit lands in a new version.
   */
  const changeFieldType = (id: string, type: FieldType) => {
    const field = fields.find((f) => f.id === id);
    if (!field || field.type === type) return;

    const patch: Partial<FormField> = { type };

    // A choice field with no options renders as an empty control, so it gets a
    // starting pair to edit rather than nothing. Options already entered are
    // kept when moving between choice types, and kept but unused otherwise, so
    // switching away and back does not lose the list.
    if (CHOICE_TYPES.includes(type) && (field.options ?? []).length === 0) {
      patch.options = ["Option 1", "Option 2"];
    }

    // Headings and separators collect no answer, so they cannot be required
    // and cannot control a condition.
    if (PRESENTATIONAL_TYPES.includes(type)) {
      patch.required = false;

      const dependents = fields.filter((f) => f.condition?.field === field.name && f.id !== id);
      if (dependents.length > 0) {
        // Left in place, those conditions could never be satisfied and their
        // fields would silently disappear from the form — a far worse outcome
        // than losing a rule the builder can see was dropped.
        mutate(
          fields.map((f) => {
            if (f.id === id) return { ...f, ...patch };
            return f.condition?.field === field.name ? { ...f, condition: undefined } : f;
          })
        );
        toast.warning(
          `"${field.label}" no longer collects an answer, so the condition on ${dependents
            .map((d) => `"${d.label}"`)
            .join(", ")} was removed.`
        );
        return;
      }
    }

    updateField(id, patch);
  };

  const addField = (type: FieldType) => {
    const field = blankField(type, fields.length, fields.map((f) => f.name));
    mutate([...fields, field]);
    setExpanded(field.id);
  };

  // Parsed on every keystroke so the dialog can show exactly what will be
  // created before anything is committed — the import is only worth trusting
  // if you can see it read your text correctly first.
  const parsed = useMemo(
    () => parseQuestionText(pasteText, fields.map((f) => f.name)),
    [pasteText, fields]
  );

  const applyPaste = (replace: boolean) => {
    if (parsed.fields.length === 0) return;
    // Re-parsed against nothing when replacing, so names come out clean rather
    // than avoiding collisions with fields that are about to be discarded.
    const incoming = replace ? parseQuestionText(pasteText).fields : parsed.fields;
    mutate(replace ? incoming : [...fields, ...incoming]);
    setShowPaste(false);
    setPasteText("");
    toast.success(`${incoming.length} field${incoming.length === 1 ? "" : "s"} added`);
  };

  /**
   * Form metadata saves on its own, separately from the field set — renaming a
   * form or moving it to another document type is not a change to what it
   * asks, so it must not mint a version.
   */
  const saveMeta = async () => {
    setSaving(true);
    try {
      await fetchJson(`/api/medical/forms/${formId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: meta.name.trim(),
          description: meta.description,
          department: meta.department,
          documentTypeId: meta.documentTypeId,
          ...(meta.status !== form?.status ? { status: meta.status } : {}),
        }),
      });
      toast.success("Form details saved");
      await load();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= fields.length) return;
    const next = [...fields];
    [next[index], next[target]] = [next[target], next[index]];
    mutate(next);
  };

  const save = async () => {
    setSaving(true);
    try {
      const version = await fetchJson<{ version: string }>(`/api/medical/forms/${formId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields, exportConfig, signatureMode }),
      });
      toast.success(`Saved as v${version.version}`);
      await load();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const publish = async () => {
    setSaving(true);
    try {
      if (dirty) {
        await fetchJson(`/api/medical/forms/${formId}/versions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fields, exportConfig, signatureMode }),
        });
      }
      const published = await fetchJson<{ version: string }>(`/api/medical/forms/${formId}/publish`, {
        method: "POST",
      });
      toast.success(`v${published.version} published — doctors can use this form now`);
      await load();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }
  if (error || !form) {
    return <ErrorState title="Failed to load form" message={error ?? "Not found"} onRetry={load} />;
  }

  const previewFields = visibleFields(fields, previewAnswers);
  const sections = [...new Set(fields.map((f) => f.section).filter(Boolean))] as string[];
  const conditionSources = fields.filter((f) => !PRESENTATIONAL_TYPES.includes(f.type));

  return (
    <div>
      <Link
        href="/admin/medical/forms"
        className="inline-flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Form Builder
      </Link>

      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 className="font-[family-name:var(--font-oswald)] text-2xl font-bold text-white uppercase">
            {form.name}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {form.documentType.name} · {form.status} ·{" "}
            {latest ? `v${latest.version}${latest.published ? " (published)" : " (draft)"}` : "no version"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={save} disabled={saving || !dirty}>
            {saving ? "Saving…" : willBranch ? "Save as new version" : "Save draft"}
          </Button>
          <Button onClick={publish} disabled={saving || fields.length === 0}>
            Publish
          </Button>
        </div>
      </div>

      {willBranch && dirty && (
        <div className="rounded-xl border border-blue-600/30 bg-blue-600/5 p-3 mb-4 text-sm text-blue-300">
          v{latest?.version} is published{latest && latest._count.documents > 0 ? ` and has ${latest._count.documents} document(s) against it` : ""}.
          Saving creates a new version — every completed document keeps the questions it was filled in with.
        </div>
      )}

      <div className="flex gap-1 mb-4 border-b border-[#1e1e28]">
        {([
          ["fields", `Fields (${fields.length})`],
          ["export", "Export layout"],
          ["details", "Form details"],
          ["versions", `Versions (${form.versions.length})`],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setPanel(key)}
            className={`px-4 py-2 text-sm border-b-2 -mb-px transition-colors ${
              panel === key ? "border-[#dc2626] text-white" : "border-transparent text-gray-500 hover:text-gray-300"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {panel === "fields" && (
        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <div>
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <Select
                value=""
                onChange={(e) => e.target.value && addField(e.target.value as FieldType)}
                className="h-9 w-56"
              >
                <option value="">＋ Add a field…</option>
                {FIELD_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {FIELD_TYPE_LABELS[t]}
                  </option>
                ))}
              </Select>
              <Button variant="outline" onClick={() => setShowPaste(true)}>
                <ClipboardPaste className="w-4 h-4 mr-2" />
                Paste questions
              </Button>
              <span className="text-gray-600 text-xs">
                Answers are keyed by field name — renaming one orphans existing answers.
              </span>
            </div>

            {fields.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#1e1e28] p-10 text-center">
                <Plus className="w-6 h-6 text-gray-600 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">
                  No fields yet. Add one above to start building this document.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {fields.map((field, index) => {
                  const open = expanded === field.id;
                  return (
                    <div key={field.id} className="rounded-xl border border-[#1e1e28] bg-card">
                      <div className="flex items-center gap-2 px-3 py-2">
                        <button
                          onClick={() => setExpanded(open ? null : field.id)}
                          className="text-gray-500 hover:text-white"
                          aria-label={open ? "Collapse field" : "Expand field"}
                        >
                          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="text-white text-sm truncate">
                            {field.label}
                            {field.required && <span className="text-red-500 ml-1">*</span>}
                          </div>
                          <div className="text-gray-600 text-xs truncate">
                            {FIELD_TYPE_LABELS[field.type]} · {field.name}
                            {field.section && ` · ${field.section}`}
                            {field.condition?.field && " · conditional"}
                          </div>
                        </div>
                        <button
                          onClick={() => move(index, -1)}
                          disabled={index === 0}
                          className="text-gray-500 hover:text-white disabled:opacity-30"
                          aria-label="Move up"
                        >
                          <ArrowUp className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => move(index, 1)}
                          disabled={index === fields.length - 1}
                          className="text-gray-500 hover:text-white disabled:opacity-30"
                          aria-label="Move down"
                        >
                          <ArrowDown className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => mutate(fields.filter((f) => f.id !== field.id))}
                          className="text-red-500/70 hover:text-red-400"
                          aria-label="Delete field"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {open && (
                        <div className="border-t border-[#1e1e28] p-3 space-y-3">
                          <div>
                            <Label className="text-xs">Field type</Label>
                            <Select
                              value={field.type}
                              onChange={(e) => changeFieldType(field.id, e.target.value as FieldType)}
                              className="mt-1 h-8 text-sm"
                            >
                              {FIELD_TYPES.map((t) => (
                                <option key={t} value={t}>
                                  {FIELD_TYPE_LABELS[t]}
                                </option>
                              ))}
                            </Select>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label className="text-xs">Display label</Label>
                              <Input
                                value={field.label}
                                onChange={(e) => updateField(field.id, { label: e.target.value })}
                                className="mt-1 h-8 text-sm"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Field name</Label>
                              <Input
                                value={field.name}
                                onChange={(e) => updateField(field.id, { name: e.target.value })}
                                className="mt-1 h-8 text-sm font-[family-name:var(--font-mono)]"
                              />
                            </div>
                          </div>

                          <div>
                            <Label className="text-xs">Description</Label>
                            <Input
                              value={field.description ?? ""}
                              onChange={(e) => updateField(field.id, { description: e.target.value })}
                              className="mt-1 h-8 text-sm"
                              placeholder="Shown under the field"
                            />
                          </div>

                          {!PRESENTATIONAL_TYPES.includes(field.type) && (
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <Label className="text-xs">Placeholder</Label>
                                <Input
                                  value={field.placeholder ?? ""}
                                  onChange={(e) => updateField(field.id, { placeholder: e.target.value })}
                                  className="mt-1 h-8 text-sm"
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Default value</Label>
                                <Input
                                  value={field.defaultValue ?? ""}
                                  onChange={(e) => updateField(field.id, { defaultValue: e.target.value })}
                                  className="mt-1 h-8 text-sm"
                                />
                              </div>
                            </div>
                          )}

                          <div>
                            <Label className="text-xs">Section</Label>
                            <Input
                              value={field.section ?? ""}
                              onChange={(e) => updateField(field.id, { section: e.target.value })}
                              className="mt-1 h-8 text-sm"
                              placeholder="e.g. Examination Findings"
                              list="builder-sections"
                            />
                            <datalist id="builder-sections">
                              {sections.map((s) => (
                                <option key={s} value={s} />
                              ))}
                            </datalist>
                          </div>

                          {CHOICE_TYPES.includes(field.type) && (
                            <div>
                              <Label className="text-xs">Options (one per line)</Label>
                              <Textarea
                                value={(field.options ?? []).join("\n")}
                                onChange={(e) =>
                                  updateField(field.id, {
                                    options: e.target.value.split("\n").map((o) => o.trim()).filter(Boolean),
                                  })
                                }
                                rows={4}
                                className="mt-1 text-sm"
                              />
                            </div>
                          )}

                          {!PRESENTATIONAL_TYPES.includes(field.type) && (
                            <div className="flex flex-wrap gap-4">
                              {([
                                ["required", "Required"],
                                ["visible", "Visible"],
                                ["inExport", "Show in export"],
                              ] as const).map(([key, label]) => (
                                <label key={key} className="flex items-center gap-2 text-sm text-gray-400">
                                  <input
                                    type="checkbox"
                                    checked={field[key]}
                                    onChange={(e) => updateField(field.id, { [key]: e.target.checked })}
                                    className="accent-red-600"
                                  />
                                  {label}
                                </label>
                              ))}
                            </div>
                          )}

                          {field.type === "number" && (
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <Label className="text-xs">Minimum</Label>
                                <Input
                                  type="number"
                                  value={field.validation?.min ?? ""}
                                  onChange={(e) =>
                                    updateField(field.id, {
                                      validation: {
                                        ...field.validation,
                                        min: e.target.value === "" ? undefined : Number(e.target.value),
                                      },
                                    })
                                  }
                                  className="mt-1 h-8 text-sm"
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Maximum</Label>
                                <Input
                                  type="number"
                                  value={field.validation?.max ?? ""}
                                  onChange={(e) =>
                                    updateField(field.id, {
                                      validation: {
                                        ...field.validation,
                                        max: e.target.value === "" ? undefined : Number(e.target.value),
                                      },
                                    })
                                  }
                                  className="mt-1 h-8 text-sm"
                                />
                              </div>
                            </div>
                          )}

                          <div className="rounded-lg border border-[#1e1e28] p-3">
                            <div className="text-xs text-gray-400 mb-2">
                              Show this field only when…
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              <Select
                                value={field.condition?.field ?? ""}
                                onChange={(e) =>
                                  updateField(field.id, {
                                    condition: e.target.value
                                      ? {
                                          field: e.target.value,
                                          operator: field.condition?.operator ?? "equals",
                                          value: field.condition?.value ?? "",
                                        }
                                      : undefined,
                                  })
                                }
                                className="h-8 text-xs"
                              >
                                <option value="">Always show</option>
                                {conditionSources
                                  .filter((f) => f.id !== field.id)
                                  .map((f) => (
                                    <option key={f.id} value={f.name}>
                                      {f.label}
                                    </option>
                                  ))}
                              </Select>
                              <Select
                                value={field.condition?.operator ?? "equals"}
                                disabled={!field.condition?.field}
                                onChange={(e) =>
                                  updateField(field.id, {
                                    condition: {
                                      field: field.condition?.field ?? "",
                                      operator: e.target.value as NonNullable<FormField["condition"]>["operator"],
                                      value: field.condition?.value ?? "",
                                    },
                                  })
                                }
                                className="h-8 text-xs"
                              >
                                <option value="equals">equals</option>
                                <option value="notEquals">does not equal</option>
                                <option value="isAnyOf">is any of</option>
                                <option value="isFilled">is answered</option>
                                <option value="isEmpty">is blank</option>
                              </Select>
                              <Input
                                value={
                                  Array.isArray(field.condition?.value)
                                    ? field.condition.value.join(", ")
                                    : (field.condition?.value ?? "")
                                }
                                disabled={
                                  !field.condition?.field ||
                                  field.condition.operator === "isFilled" ||
                                  field.condition.operator === "isEmpty"
                                }
                                onChange={(e) =>
                                  updateField(field.id, {
                                    condition: {
                                      field: field.condition?.field ?? "",
                                      operator: field.condition?.operator ?? "equals",
                                      value:
                                        field.condition?.operator === "isAnyOf"
                                          ? e.target.value.split(",").map((v) => v.trim()).filter(Boolean)
                                          : e.target.value,
                                    },
                                  })
                                }
                                placeholder="Yes"
                                className="h-8 text-xs"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="lg:sticky lg:top-4 h-fit">
            <div className="rounded-xl border border-[#1e1e28] bg-card p-4">
              <h2 className="text-white text-sm font-semibold mb-1">Live preview</h2>
              <p className="text-gray-600 text-xs mb-4">
                Exactly what a doctor sees. Answer a conditional field to watch its branch appear.
              </p>
              <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
                {previewFields.length === 0 ? (
                  <p className="text-gray-600 text-sm">Nothing to preview yet.</p>
                ) : (
                  previewFields.map((field) => (
                    <FieldInput
                      key={field.id}
                      field={field}
                      answers={previewAnswers}
                      onChange={(name, value) => setPreviewAnswers((p) => ({ ...p, [name]: value }))}
                    />
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {panel === "export" && (
        <div className="max-w-2xl space-y-4">
          <div className="rounded-xl border border-[#1e1e28] bg-card p-4">
            <h2 className="text-white text-sm font-semibold mb-3">Document</h2>
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Title printed on the export</Label>
                <Input
                  value={exportConfig.documentTitle ?? ""}
                  onChange={(e) => {
                    setExportConfig({ ...exportConfig, documentTitle: e.target.value });
                    setDirty(true);
                  }}
                  placeholder={form.name}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Certification statement</Label>
                <Textarea
                  value={exportConfig.certificationStatement ?? ""}
                  onChange={(e) => {
                    setExportConfig({ ...exportConfig, certificationStatement: e.target.value });
                    setDirty(true);
                  }}
                  rows={3}
                  placeholder="I certify that the above examination was carried out by me and that the findings are accurate."
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Signature</Label>
                <Select
                  value={signatureMode}
                  onChange={(e) => {
                    setSignatureMode(e.target.value);
                    setDirty(true);
                  }}
                  className="mt-1"
                >
                  <option value="optional">Optional</option>
                  <option value="required">Required before finalizing</option>
                  <option value="disabled">Not used</option>
                </Select>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[#1e1e28] bg-card p-4">
            <h2 className="text-white text-sm font-semibold mb-3">What appears on the PDF</h2>
            <div className="grid grid-cols-2 gap-2">
              {([
                ["showLogo", "Department logo"],
                ["showDepartmentName", "Department name"],
                ["showAddress", "Address"],
                ["showContact", "Contact"],
                ["showSecondaryLetterhead", "Second letterhead"],
                ["showSecondaryLogo", "— its logo"],
                ["showSecondaryDetail", "— its closing detail"],
                ["showDocumentNumber", "Document number"],
                ["showDate", "Date"],
                ["showPatient", "Patient block"],
                ["showDoctor", "Doctor block"],
                ["showSignature", "Signature block"],
                ["showConfidentiality", "Confidentiality notice"],
                ["showDisclaimer", "Disclaimer"],
                ["showPageNumbers", "Page numbers"],
              ] as const).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-sm text-gray-400">
                  <input
                    type="checkbox"
                    checked={exportConfig[key]}
                    onChange={(e) => {
                      setExportConfig({ ...exportConfig, [key]: e.target.checked });
                      setDirty(true);
                    }}
                    className="accent-red-600"
                  />
                  {label}
                </label>
              ))}
            </div>
            <p className="text-gray-600 text-xs mt-3">
              Individual answers are controlled per field by &ldquo;Show in export&rdquo;.
            </p>
          </div>
        </div>
      )}

      {panel === "details" && (
        <div className="max-w-2xl space-y-4">
          <div className="rounded-xl border border-[#1e1e28] bg-card p-4 space-y-4">
            <div>
              <Label className="text-xs">Form name</Label>
              <Input
                value={meta.name}
                onChange={(e) => {
                  setMeta({ ...meta, name: e.target.value });
                  setMetaDirty(true);
                }}
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-xs">Description</Label>
              <Textarea
                value={meta.description}
                onChange={(e) => {
                  setMeta({ ...meta, description: e.target.value });
                  setMetaDirty(true);
                }}
                rows={2}
                className="mt-1"
                placeholder="Shown to doctors when they pick this form"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Document type</Label>
                <Select
                  value={meta.documentTypeId}
                  onChange={(e) => {
                    setMeta({ ...meta, documentTypeId: e.target.value });
                    setMetaDirty(true);
                  }}
                  className="mt-1"
                >
                  {types.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.numberPrefix})
                    </option>
                  ))}
                </Select>
                {meta.documentTypeId !== form.documentType.id && (
                  <p className="text-yellow-500/80 text-xs mt-1">
                    Only affects documents created from now on. Ones already issued keep the type and
                    number they were given.
                  </p>
                )}
              </div>
              <div>
                <Label className="text-xs">Status</Label>
                <Select
                  value={meta.status}
                  onChange={(e) => {
                    setMeta({ ...meta, status: e.target.value });
                    setMetaDirty(true);
                  }}
                  className="mt-1"
                >
                  {FORM_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
                <p className="text-gray-600 text-xs mt-1">
                  Only Active forms can be filled in. A form goes Active by publishing a version.
                </p>
              </div>
            </div>

            <div>
              <Label className="text-xs">Department</Label>
              <Input
                value={meta.department}
                onChange={(e) => {
                  setMeta({ ...meta, department: e.target.value });
                  setMetaDirty(true);
                }}
                className="mt-1"
                placeholder="Leave blank for all of EMS"
              />
            </div>

            <Button onClick={saveMeta} disabled={saving || !metaDirty || !meta.name.trim()}>
              {saving ? "Saving…" : "Save details"}
            </Button>
          </div>

          <p className="text-gray-600 text-xs">
            These are the form&apos;s own details and save on their own — changing them never creates a
            version, because they are not part of what the form asks.
          </p>
        </div>
      )}

      {panel === "versions" && (
        <div className="bg-card border border-[#1e1e1e] rounded-xl overflow-x-auto max-w-3xl">
          <table className="w-full text-sm min-w-[500px]">
            <thead>
              <tr className="border-b border-[#1e1e1e]">
                <th className="text-left py-3 px-4 text-gray-500 font-medium">Version</th>
                <th className="text-left py-3 px-4 text-gray-500 font-medium">State</th>
                <th className="text-left py-3 px-4 text-gray-500 font-medium">Documents</th>
                <th className="text-left py-3 px-4 text-gray-500 font-medium">Created</th>
                <th className="text-left py-3 px-4 text-gray-500 font-medium">By</th>
              </tr>
            </thead>
            <tbody>
              {form.versions.map((v) => (
                <tr key={v.id} className="border-b border-[#1e1e1e]/50">
                  <td className="py-3 px-4 text-white">v{v.version}</td>
                  <td className="py-3 px-4">
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${
                        v.published ? "bg-green-500/15 text-green-400" : "bg-gray-500/15 text-gray-400"
                      }`}
                    >
                      {v.published ? "Published" : "Draft"}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-gray-400 text-xs">{v._count.documents}</td>
                  <td className="py-3 px-4 text-gray-400 text-xs">
                    {new Date(v.createdAt).toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-gray-500 text-xs">{v.createdBy ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={showPaste} onOpenChange={setShowPaste}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Paste questions</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label className="text-xs">Your questions</Label>
              <Textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                rows={16}
                placeholder={PASTE_EXAMPLE}
                className="mt-1 text-sm font-[family-name:var(--font-mono)]"
              />
              <div className="text-gray-600 text-xs mt-2 space-y-0.5">
                <div>
                  <span className="text-gray-400">#&nbsp;Heading</span> starts a section ·{" "}
                  <span className="text-gray-400">##&nbsp;Heading</span> is a heading field ·{" "}
                  <span className="text-gray-400">---</span> a separator
                </div>
                <div>
                  <span className="text-gray-400">-&nbsp;option</span> lines under a question become its
                  answers · <span className="text-gray-400">*</span> at the end marks it required
                </div>
                <div>
                  <span className="text-gray-400">[date]</span>, <span className="text-gray-400">[long]</span>
                  , <span className="text-gray-400">[number]</span>,{" "}
                  <span className="text-gray-400">[yesno]</span>,{" "}
                  <span className="text-gray-400">[select]</span>… set the field type. Without one it is
                  guessed from the wording.
                </div>
              </div>
            </div>

            <div>
              <Label className="text-xs">
                Preview — {parsed.fields.length} field{parsed.fields.length === 1 ? "" : "s"}
              </Label>
              <div className="mt-1 rounded-lg border border-[#1e1e28] bg-[#0a0a0f] h-[calc(16rem+8px)] overflow-y-auto p-2 space-y-1">
                {parsed.fields.length === 0 ? (
                  <p className="text-gray-600 text-xs p-2">
                    Paste your question list on the left and it will be read here before anything is added.
                  </p>
                ) : (
                  parsed.fields.map((f) => (
                    <div key={f.id} className="rounded border border-[#1e1e28] px-2 py-1.5">
                      <div className="text-white text-xs">
                        {f.label || <span className="text-gray-600 italic">(no label)</span>}
                        {f.required && <span className="text-red-500 ml-1">*</span>}
                      </div>
                      <div className="text-gray-600 text-[11px]">
                        {FIELD_TYPE_LABELS[f.type]}
                        {f.section && ` · ${f.section}`}
                        {f.options && f.options.length > 0 && ` · ${f.options.join(" / ")}`}
                      </div>
                    </div>
                  ))
                )}
              </div>
              {parsed.warnings.length > 0 && pasteText.trim() !== "" && (
                <ul className="text-yellow-500/80 text-[11px] mt-2 list-disc list-inside space-y-0.5">
                  {parsed.warnings.slice(0, 4).map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowPaste(false)}>
              Cancel
            </Button>
            {fields.length > 0 && (
              <Button
                variant="outline"
                onClick={() => {
                  if (confirm(`Replace all ${fields.length} existing field(s) with these ${parsed.fields.length}?`)) {
                    applyPaste(true);
                  }
                }}
                disabled={parsed.fields.length === 0}
              >
                Replace all fields
              </Button>
            )}
            <Button onClick={() => applyPaste(false)} disabled={parsed.fields.length === 0}>
              Add {parsed.fields.length > 0 ? parsed.fields.length : ""} to form
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
