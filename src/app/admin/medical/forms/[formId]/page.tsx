"use client";

import React, { useState, useEffect, useCallback } from "react";
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
import { fetchJson, errorMessage } from "@/lib/fetch-json";
import {
  FIELD_TYPES,
  FIELD_TYPE_LABELS,
  CHOICE_TYPES,
  PRESENTATIONAL_TYPES,
  DEFAULT_EXPORT_CONFIG,
  parseFields,
  parseExportConfig,
  visibleFields,
  type FormField,
  type FieldType,
  type ExportConfig,
  type Answers,
} from "@/lib/medical";
import { toast } from "sonner";
import { ArrowLeft, ArrowUp, ArrowDown, Trash2, Plus, ChevronDown, ChevronRight } from "lucide-react";

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
  status: string;
  documentType: { id: string; name: string; numberPrefix: string };
  versions: VersionRow[];
}

/** A machine key derived from the label, so builders never have to invent one. */
function keyFrom(label: string, taken: string[]): string {
  const base =
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40) || "field";
  if (!taken.includes(base)) return base;
  let n = 2;
  while (taken.includes(`${base}_${n}`)) n++;
  return `${base}_${n}`;
}

function blankField(type: FieldType, order: number, taken: string[]): FormField {
  const label = FIELD_TYPE_LABELS[type];
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    name: keyFrom(label, taken),
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
  const [panel, setPanel] = useState<"fields" | "export" | "versions">("fields");

  const load = useCallback(async () => {
    setError(null);
    try {
      const detail = await fetchJson<FormDetail>(`/api/medical/forms/${formId}`);
      setForm(detail);
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

  const addField = (type: FieldType) => {
    const field = blankField(type, fields.length, fields.map((f) => f.name));
    mutate([...fields, field]);
    setExpanded(field.id);
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
                ["showDepartmentName", "Department name"],
                ["showAddress", "Address"],
                ["showContact", "Contact"],
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
    </div>
  );
}
