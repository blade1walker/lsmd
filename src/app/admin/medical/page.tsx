"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { fetchList, errorMessage } from "@/lib/fetch-json";
import { DOCUMENT_STATUSES } from "@/lib/medical";
import { Plus, FileText } from "lucide-react";

interface DocumentRow {
  id: string;
  documentNumber: string | null;
  status: string;
  patientName: string;
  patientStateId: string | null;
  authorName: string;
  signedBy: string | null;
  finalizedAt: string | null;
  createdAt: string;
  documentType: { id: string; name: string; category: string };
  formVersion: { id: string; version: string; form: { id: string; name: string } };
}

interface DocumentType {
  id: string;
  name: string;
}

const STATUS_STYLES: Record<string, string> = {
  Draft: "bg-gray-500/15 text-gray-400",
  Review: "bg-yellow-500/15 text-yellow-400",
  Finalized: "bg-green-500/15 text-green-400",
  Archived: "bg-red-500/15 text-red-400",
};

export default function MedicalDocumentsPage() {
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [types, setTypes] = useState<DocumentType[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [typeId, setTypeId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (status) params.set("status", status);
    if (typeId) params.set("typeId", typeId);
    if (from) params.set("from", from);
    if (to) params.set("to", to);

    try {
      const [docs, typeList] = await Promise.all([
        fetchList<DocumentRow>(`/api/medical/documents?${params.toString()}`),
        fetchList<DocumentType>("/api/medical/document-types"),
      ]);
      setDocuments(docs);
      setTypes(typeList);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [q, status, typeId, from, to]);

  // Debounced so typing a patient name doesn't fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  return (
    <div>
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 className="font-[family-name:var(--font-oswald)] text-2xl font-bold text-white uppercase">
            Medical Documentation
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Reports, certificates and evaluations. {documents.length} shown.
          </p>
        </div>
        <Link href="/admin/medical/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Create Document
          </Button>
        </Link>
      </div>

      <div className="flex items-end gap-3 flex-wrap mb-5">
        <Input
          placeholder="Search patient, State ID, document number…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-72"
        />
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-40">
          <option value="">All statuses</option>
          {DOCUMENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
        <Select value={typeId} onChange={(e) => setTypeId(e.target.value)} className="w-52">
          <option value="">All document types</option>
          {types.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
        <div>
          <label className="block text-[11px] text-gray-500 mb-1">From</label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
        </div>
        <div>
          <label className="block text-[11px] text-gray-500 mb-1">To</label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : error ? (
        <ErrorState title="Failed to load documents" message={error} onRetry={load} />
      ) : documents.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#1e1e28] p-12 text-center">
          <FileText className="w-7 h-7 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No documents match these filters.</p>
        </div>
      ) : (
        <div className="bg-card border border-[#1e1e1e] rounded-xl overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="border-b border-[#1e1e1e]">
                <th className="text-left py-3 px-4 text-gray-500 font-medium">Document No.</th>
                <th className="text-left py-3 px-4 text-gray-500 font-medium">Patient</th>
                <th className="text-left py-3 px-4 text-gray-500 font-medium">Type</th>
                <th className="text-left py-3 px-4 text-gray-500 font-medium">Form</th>
                <th className="text-left py-3 px-4 text-gray-500 font-medium">Status</th>
                <th className="text-left py-3 px-4 text-gray-500 font-medium">Doctor</th>
                <th className="text-left py-3 px-4 text-gray-500 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr key={doc.id} className="border-b border-[#1e1e1e]/50 hover:bg-white/5">
                  <td className="py-3 px-4 font-[family-name:var(--font-mono)] text-xs">
                    <Link href={`/admin/medical/${doc.id}`} className="text-blue-400 hover:text-blue-300">
                      {doc.documentNumber ?? "Draft"}
                    </Link>
                  </td>
                  <td className="py-3 px-4">
                    <div className="text-white">{doc.patientName}</div>
                    {doc.patientStateId && (
                      <div className="text-gray-600 text-xs">State ID {doc.patientStateId}</div>
                    )}
                  </td>
                  <td className="py-3 px-4 text-gray-400 text-xs">{doc.documentType.name}</td>
                  <td className="py-3 px-4 text-gray-400 text-xs">
                    {doc.formVersion.form.name}
                    <span className="text-gray-600"> v{doc.formVersion.version}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`text-xs px-2 py-0.5 rounded ${STATUS_STYLES[doc.status] ?? ""}`}>
                      {doc.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-gray-400 text-xs">{doc.authorName}</td>
                  <td className="py-3 px-4 text-gray-500 text-xs">
                    {new Date(doc.finalizedAt ?? doc.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
