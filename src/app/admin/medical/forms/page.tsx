"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { fetchJson, fetchList, errorMessage } from "@/lib/fetch-json";
import { DOCUMENT_CATEGORIES, FORM_STATUSES } from "@/lib/medical";
import { toast } from "sonner";
import { Plus, ExternalLink, Trash2, Upload, Image as ImageIcon } from "lucide-react";

interface DocumentType {
  id: string;
  name: string;
  description: string | null;
  category: string;
  numberPrefix: string;
  active: boolean;
  _count: { forms: number; documents: number };
}

interface FormVersion {
  id: string;
  version: string;
  published: boolean;
  signatureMode: string;
  createdAt: string;
  createdBy: string | null;
  _count: { documents: number };
}

interface MedicalFormRow {
  id: string;
  name: string;
  description: string | null;
  status: string;
  department: string | null;
  createdBy: string | null;
  publishedAt: string | null;
  updatedAt: string;
  documentType: { id: string; name: string; category: string; numberPrefix: string };
  versions: FormVersion[];
}

interface Settings {
  departmentName: string;
  subDepartment: string | null;
  logoUrl: string | null;
  address: string | null;
  contact: string | null;
  confidentialityNotice: string;
  disclaimer: string | null;
  secondaryName: string | null;
  secondaryLogoUrl: string | null;
  secondaryAddress: string | null;
  secondaryContact: string | null;
  secondaryDetail: string | null;
}

/** The two settings fields a logo can be uploaded into. */
type LogoSlot = "logoUrl" | "secondaryLogoUrl";

const STATUS_STYLES: Record<string, string> = {
  Draft: "bg-gray-500/15 text-gray-400",
  Active: "bg-green-500/15 text-green-400",
  Inactive: "bg-yellow-500/15 text-yellow-400",
  Archived: "bg-red-500/15 text-red-400",
};

/**
 * Upload-or-paste control for one letterhead mark, shared by both bands.
 *
 * The URL field is kept alongside the uploader rather than hidden behind it:
 * Vercel Blob may not be configured on every deployment, and pasting a hosted
 * image is the fallback that keeps the letterhead usable when it isn't.
 */
function LogoPicker({
  label,
  url,
  inputRef,
  uploading,
  disabled,
  onFile,
  onUrlChange,
}: {
  label: string;
  url: string | null;
  inputRef: React.RefObject<HTMLInputElement | null>;
  uploading: boolean;
  disabled: boolean;
  onFile: (file: File) => void;
  onUrlChange: (url: string | null) => void;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <p className="text-gray-600 text-xs mt-1 mb-2">
        PNG, JPEG or WebP up to 2MB. SVG can&apos;t be drawn into a PDF, so it isn&apos;t accepted.
      </p>
      <div className="flex items-start gap-4">
        <div className="w-32 h-24 rounded-lg border border-[#1e1e28] bg-[#0a0a0f] flex items-center justify-center overflow-hidden shrink-0">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element -- a Blob URL on an unknown host; next/image would need it in remotePatterns.
            <img src={url} alt="" className="max-w-full max-h-full object-contain" />
          ) : (
            <ImageIcon className="w-6 h-6 text-gray-700" />
          )}
        </div>
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onFile(file);
              }}
            />
            <Button variant="outline" onClick={() => inputRef.current?.click()} disabled={disabled}>
              <Upload className="w-4 h-4 mr-2" />
              {uploading ? "Uploading…" : url ? "Replace" : "Upload logo"}
            </Button>
            {url && (
              <Button variant="ghost" className="text-red-400" disabled={disabled} onClick={() => onUrlChange(null)}>
                Remove
              </Button>
            )}
          </div>
          <Input
            value={url ?? ""}
            onChange={(e) => onUrlChange(e.target.value)}
            placeholder="…or paste an image URL"
            className="text-xs"
          />
          <p className="text-gray-600 text-xs">
            A pasted URL must allow cross-origin reads, or the export prints without it.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function MedicalFormsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"forms" | "types" | "letterhead">("forms");
  const [forms, setForms] = useState<MedicalFormRow[]>([]);
  const [types, setTypes] = useState<DocumentType[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const secondaryLogoInputRef = useRef<HTMLInputElement>(null);
  const [uploadingSlot, setUploadingSlot] = useState<LogoSlot | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newForm, setNewForm] = useState({ name: "", documentTypeId: "", description: "" });
  const [newType, setNewType] = useState({ name: "", category: "Report", numberPrefix: "EMS-MED", description: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [formList, typeList, settingsRow] = await Promise.all([
        fetchList<MedicalFormRow>("/api/medical/forms"),
        fetchList<DocumentType>("/api/medical/document-types"),
        fetchJson<Settings>("/api/medical/settings"),
      ]);
      setForms(formList);
      setTypes(typeList);
      setSettings(settingsRow);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const createForm = async () => {
    if (!newForm.name.trim() || !newForm.documentTypeId) return;
    setSaving(true);
    try {
      const created = await fetchJson<{ id: string }>("/api/medical/forms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newForm),
      });
      toast.success("Form created — add its fields next");
      setShowNewForm(false);
      setNewForm({ name: "", documentTypeId: "", description: "" });
      router.push(`/admin/medical/forms/${created.id}`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (form: MedicalFormRow, status: string) => {
    try {
      await fetchJson(`/api/medical/forms/${form.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      toast.success(`${form.name} is now ${status}`);
      load();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const deleteForm = async (form: MedicalFormRow) => {
    if (!confirm(`Delete "${form.name}"? This cannot be undone.`)) return;
    try {
      await fetchJson(`/api/medical/forms/${form.id}`, { method: "DELETE" });
      toast.success("Form deleted");
      load();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const createType = async () => {
    if (!newType.name.trim()) return;
    setSaving(true);
    try {
      await fetchJson("/api/medical/document-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newType),
      });
      toast.success("Document type added");
      setNewType({ name: "", category: "Report", numberPrefix: "EMS-MED", description: "" });
      load();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const deleteType = async (type: DocumentType) => {
    if (!confirm(`Delete the "${type.name}" document type?`)) return;
    try {
      await fetchJson(`/api/medical/document-types/${type.id}`, { method: "DELETE" });
      toast.success("Document type deleted");
      load();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  /**
   * Uploads the picked file and writes the URL straight back to the settings
   * row, rather than holding it until Save. A logo that previews but vanishes
   * because someone navigated away is worse than one extra request.
   */
  const uploadLogo = async (file: File, slot: LogoSlot) => {
    if (!settings) return;
    setUploadingSlot(slot);
    try {
      const body = new FormData();
      body.append("file", file);
      const { url } = await fetchJson<{ url: string }>("/api/medical/upload", { method: "POST", body });
      setSettings({ ...settings, [slot]: url });
      await fetchJson("/api/medical/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [slot]: url }),
      });
      toast.success("Logo uploaded");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setUploadingSlot(null);
      const ref = slot === "logoUrl" ? logoInputRef : secondaryLogoInputRef;
      if (ref.current) ref.current.value = "";
    }
  };

  const saveSettings = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      await fetchJson("/api/medical/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      toast.success("Letterhead saved");
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
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (error) return <ErrorState title="Failed to load the form library" message={error} onRetry={load} />;

  return (
    <div>
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="font-[family-name:var(--font-oswald)] text-2xl font-bold text-white uppercase">
            Form Builder
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Build once, configure everything. Define a document type, build its form, publish it — doctors
            can use it immediately.
          </p>
        </div>
        {tab === "forms" && (
          <Button onClick={() => setShowNewForm(true)} disabled={types.length === 0}>
            <Plus className="w-4 h-4 mr-2" />
            New Form
          </Button>
        )}
      </div>

      <div className="flex gap-1 mb-6 border-b border-[#1e1e28]">
        {([
          ["forms", `Forms (${forms.length})`],
          ["types", `Document Types (${types.length})`],
          ["letterhead", "Letterhead"],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm border-b-2 -mb-px transition-colors ${
              tab === key
                ? "border-[#dc2626] text-white"
                : "border-transparent text-gray-500 hover:text-gray-300"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "forms" && (
        <>
          {types.length === 0 && (
            <div className="rounded-xl border border-yellow-600/30 bg-yellow-600/5 p-4 mb-4 text-sm text-yellow-300">
              Add a document type first — every form produces one kind of record, and the type decides how
              its documents are numbered.
            </div>
          )}
          {forms.length === 0 ? (
            <p className="text-gray-500 text-sm">No forms yet.</p>
          ) : (
            <div className="bg-card border border-[#1e1e1e] rounded-xl overflow-x-auto">
              <table className="w-full text-sm min-w-[900px]">
                <thead>
                  <tr className="border-b border-[#1e1e1e]">
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Form</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Document Type</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Version</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Status</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Used</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Created by</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {forms.map((form) => {
                    const latest = form.versions[0];
                    const live = form.versions.find((v) => v.published);
                    const used = form.versions.reduce((n, v) => n + v._count.documents, 0);
                    return (
                      <tr key={form.id} className="border-b border-[#1e1e1e]/50 hover:bg-white/5">
                        <td className="py-3 px-4">
                          <Link href={`/admin/medical/forms/${form.id}`} className="text-white hover:text-red-400">
                            {form.name}
                          </Link>
                          {form.description && (
                            <div className="text-gray-600 text-xs mt-0.5 max-w-xs truncate">{form.description}</div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-gray-400 text-xs">
                          {form.documentType.name}
                          <div className="text-gray-600">{form.documentType.numberPrefix}</div>
                        </td>
                        <td className="py-3 px-4 text-xs">
                          <span className="text-white">v{live?.version ?? "—"}</span>
                          {latest && !latest.published && (
                            <span className="block text-yellow-500">v{latest.version} draft</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`text-xs px-2 py-0.5 rounded ${STATUS_STYLES[form.status] ?? ""}`}>
                            {form.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-gray-400 text-xs">{used}</td>
                        <td className="py-3 px-4 text-gray-500 text-xs">{form.createdBy ?? "—"}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1">
                            <Link href={`/admin/medical/forms/${form.id}`}>
                              <Button size="sm" variant="ghost" className="h-7 text-xs text-blue-400">
                                <ExternalLink className="w-3 h-3 mr-1" />
                                Open
                              </Button>
                            </Link>
                            <Select
                              value={form.status}
                              onChange={(e) => setStatus(form, e.target.value)}
                              className="h-7 text-xs w-28"
                            >
                              {FORM_STATUSES.map((s) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ))}
                            </Select>
                            {used === 0 && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs text-red-400"
                                onClick={() => deleteForm(form)}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === "types" && (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="bg-card border border-[#1e1e1e] rounded-xl overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="border-b border-[#1e1e1e]">
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">Name</th>
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">Category</th>
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">Number prefix</th>
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">Forms</th>
                  <th className="text-left py-3 px-4 text-gray-500 font-medium">Docs</th>
                  <th className="text-left py-3 px-4 text-gray-500 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {types.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 px-4 text-gray-500 text-sm text-center">
                      No document types yet.
                    </td>
                  </tr>
                ) : (
                  types.map((type) => (
                    <tr key={type.id} className="border-b border-[#1e1e1e]/50">
                      <td className="py-3 px-4 text-white">{type.name}</td>
                      <td className="py-3 px-4 text-gray-400 text-xs">{type.category}</td>
                      <td className="py-3 px-4 text-gray-400 text-xs font-[family-name:var(--font-mono)]">
                        {type.numberPrefix}
                      </td>
                      <td className="py-3 px-4 text-gray-400 text-xs">{type._count.forms}</td>
                      <td className="py-3 px-4 text-gray-400 text-xs">{type._count.documents}</td>
                      <td className="py-3 px-4">
                        {type._count.forms === 0 && type._count.documents === 0 && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-red-400"
                            onClick={() => deleteType(type)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="bg-card border border-[#1e1e1e] rounded-xl p-4 h-fit">
            <h2 className="text-white font-semibold text-sm mb-3">Add document type</h2>
            <div className="space-y-3">
              <div>
                <Label>Name</Label>
                <Input
                  value={newType.name}
                  onChange={(e) => setNewType({ ...newType, name: e.target.value })}
                  placeholder="e.g. Psychological Evaluation"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Category</Label>
                <Select
                  value={newType.category}
                  onChange={(e) => setNewType({ ...newType, category: e.target.value })}
                  className="mt-1"
                >
                  {DOCUMENT_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Number prefix</Label>
                <Input
                  value={newType.numberPrefix}
                  onChange={(e) => setNewType({ ...newType, numberPrefix: e.target.value })}
                  placeholder="EMS-MED"
                  className="mt-1 font-[family-name:var(--font-mono)]"
                />
                <p className="text-gray-600 text-xs mt-1">
                  Documents number as {newType.numberPrefix || "EMS-MED"}-{new Date().getFullYear()}-000001.
                </p>
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={newType.description}
                  onChange={(e) => setNewType({ ...newType, description: e.target.value })}
                  rows={2}
                  className="mt-1"
                />
              </div>
              <Button onClick={createType} disabled={saving || !newType.name.trim()} className="w-full">
                Add type
              </Button>
            </div>
          </div>
        </div>
      )}

      {tab === "letterhead" && settings && (
        <div className="max-w-2xl space-y-6">
          <p className="text-gray-500 text-sm">
            Printed at the top of every exported document. Each form chooses which of these it shows, so
            filling them in here does not force them onto anything.
          </p>

          <div className="bg-card border border-[#1e1e1e] rounded-xl p-5">
            <h2 className="text-white text-sm font-semibold">Main letterhead</h2>
            <p className="text-gray-600 text-xs mt-1 mb-4">
              The department banner across the top of the page.
            </p>

            <div className="space-y-4">
              <LogoPicker
                label="Logo"
                url={settings.logoUrl}
                inputRef={logoInputRef}
                uploading={uploadingSlot === "logoUrl"}
                disabled={uploadingSlot !== null}
                onFile={(file) => uploadLogo(file, "logoUrl")}
                onUrlChange={(url) => setSettings({ ...settings, logoUrl: url })}
              />
              <div>
                <Label>Department name</Label>
                <Input
                  value={settings.departmentName}
                  onChange={(e) => setSettings({ ...settings, departmentName: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Sub-department</Label>
                  <Input
                    value={settings.subDepartment ?? ""}
                    onChange={(e) => setSettings({ ...settings, subDepartment: e.target.value })}
                    placeholder="e.g. Office of the Chief Medical Officer"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Contact</Label>
                  <Input
                    value={settings.contact ?? ""}
                    onChange={(e) => setSettings({ ...settings, contact: e.target.value })}
                    className="mt-1"
                  />
                </div>
              </div>
              <div>
                <Label>Address</Label>
                <Input
                  value={settings.address ?? ""}
                  onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>
          </div>

          <div className="bg-card border border-[#1e1e1e] rounded-xl p-5">
            <h2 className="text-white text-sm font-semibold">Second letterhead</h2>
            <p className="text-gray-600 text-xs mt-1 mb-4">
              Printed directly beneath the main banner and set smaller, for the facility or division
              issuing the document. Turn it on per form under{" "}
              <span className="text-gray-400">Export layout → Second letterhead</span>.
            </p>

            <div className="space-y-4">
              <LogoPicker
                label="Logo"
                url={settings.secondaryLogoUrl}
                inputRef={secondaryLogoInputRef}
                uploading={uploadingSlot === "secondaryLogoUrl"}
                disabled={uploadingSlot !== null}
                onFile={(file) => uploadLogo(file, "secondaryLogoUrl")}
                onUrlChange={(url) => setSettings({ ...settings, secondaryLogoUrl: url })}
              />
              <div>
                <Label>Name</Label>
                <Input
                  value={settings.secondaryName ?? ""}
                  onChange={(e) => setSettings({ ...settings, secondaryName: e.target.value })}
                  placeholder="e.g. Pillbox Hill Medical Center"
                  className="mt-1"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Address</Label>
                  <Input
                    value={settings.secondaryAddress ?? ""}
                    onChange={(e) => setSettings({ ...settings, secondaryAddress: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Contact</Label>
                  <Input
                    value={settings.secondaryContact ?? ""}
                    onChange={(e) => setSettings({ ...settings, secondaryContact: e.target.value })}
                    className="mt-1"
                  />
                </div>
              </div>
              <div>
                <Label>Closing detail</Label>
                <Textarea
                  value={settings.secondaryDetail ?? ""}
                  onChange={(e) => setSettings({ ...settings, secondaryDetail: e.target.value })}
                  rows={3}
                  placeholder="e.g. Licensed under the Los Santos Department of Public Health · Facility Registration No. 0042"
                  className="mt-1"
                />
                <p className="text-gray-600 text-xs mt-1">
                  The extra section that closes the second band — licence numbers, accreditation, a
                  registrar line. Printed centred, just above the rule that separates the letterhead from
                  the document.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-card border border-[#1e1e1e] rounded-xl p-5">
            <h2 className="text-white text-sm font-semibold mb-4">Page footer</h2>
            <div className="space-y-4">
              <div>
                <Label>Confidentiality notice</Label>
                <Textarea
                  value={settings.confidentialityNotice}
                  onChange={(e) => setSettings({ ...settings, confidentialityNotice: e.target.value })}
                  rows={2}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Disclaimer</Label>
                <Textarea
                  value={settings.disclaimer ?? ""}
                  onChange={(e) => setSettings({ ...settings, disclaimer: e.target.value })}
                  rows={2}
                  className="mt-1"
                />
              </div>
            </div>
          </div>

          <Button onClick={saveSettings} disabled={saving || uploadingSlot !== null}>
            {saving ? "Saving…" : "Save letterhead"}
          </Button>
        </div>
      )}

      <Dialog open={showNewForm} onOpenChange={setShowNewForm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Form</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Form name</Label>
              <Input
                value={newForm.name}
                onChange={(e) => setNewForm({ ...newForm, name: e.target.value })}
                placeholder="e.g. Medical Fitness Certificate"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Document type</Label>
              <Select
                value={newForm.documentTypeId}
                onChange={(e) => setNewForm({ ...newForm, documentTypeId: e.target.value })}
                className="mt-1"
              >
                <option value="">Select…</option>
                {types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={newForm.description}
                onChange={(e) => setNewForm({ ...newForm, description: e.target.value })}
                rows={2}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowNewForm(false)}>
              Cancel
            </Button>
            <Button onClick={createForm} disabled={saving || !newForm.name.trim() || !newForm.documentTypeId}>
              Create &amp; open builder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
