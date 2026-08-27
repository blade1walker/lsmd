"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ErrorState } from "@/components/ui/error-state";
import { fetchJson, fetchList, errorMessage } from "@/lib/fetch-json";
import { LEGACY_DOC_ID } from "@/lib/sop";
import { Save, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface SopDoc {
  id: string;
  title: string;
  content: string;
  order: number;
}

export default function AdminSopPage() {
  const [docs, setDocs] = useState<SopDoc[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Edits held per document id, so switching documents does not discard them.
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  const fetchDocs = useCallback(async () => {
    setError(null);
    try {
      const list = await fetchList<SopDoc>("/api/sop");
      setDocs(list);
      setDrafts({});
      setSelectedId((prev) => (prev && list.some((d) => d.id === prev) ? prev : list[0]?.id ?? null));
    } catch (err) {
      setError(errorMessage(err));
      setDocs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  const selectedDoc = docs.find((d) => d.id === selectedId) ?? null;
  const content = selectedDoc ? drafts[selectedDoc.id] ?? selectedDoc.content : "";
  const isDirty = !!selectedDoc && drafts[selectedDoc.id] !== undefined && drafts[selectedDoc.id] !== selectedDoc.content;
  // Served from the legacy SopContent row because SopDocument does not exist
  // yet; it is synthetic, so it cannot be edited, renamed or deleted.
  const isLegacy = selectedDoc?.id === LEGACY_DOC_ID;

  const handleSave = async () => {
    if (!selectedDoc) return;
    setSaving(true);
    try {
      await fetchJson(`/api/sop/${selectedDoc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      setDocs((prev) => prev.map((d) => (d.id === selectedDoc.id ? { ...d, content } : d)));
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[selectedDoc.id];
        return next;
      });
      toast.success("SOP saved");
    } catch (err) {
      toast.error(errorMessage(err));
    }
    setSaving(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const doc = await fetchJson<SopDoc>("/api/sop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle, content: "" }),
      });
      toast.success(`"${doc.title}" created`);
      setNewTitle("");
      setShowCreate(false);
      await fetchDocs();
      setSelectedId(doc.id);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const handleRename = async (title: string) => {
    if (!selectedDoc || title.trim() === selectedDoc.title || !title.trim()) return;
    try {
      await fetchJson(`/api/sop/${selectedDoc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      setDocs((prev) => prev.map((d) => (d.id === selectedDoc.id ? { ...d, title: title.trim() } : d)));
      toast.success("Renamed");
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const handleDelete = async () => {
    if (!selectedDoc) return;
    if (!confirm(`Delete "${selectedDoc.title}"? This cannot be undone.`)) return;
    try {
      await fetchJson(`/api/sop/${selectedDoc.id}`, { method: "DELETE" });
      toast.success(`"${selectedDoc.title}" deleted`);
      setSelectedId(null);
      await fetchDocs();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading SOP...</div>
      </div>
    );
  }

  if (error) {
    return <ErrorState title="Failed to load SOP documents" message={error} onRetry={fetchDocs} />;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-[family-name:var(--font-oswald)] text-2xl font-bold text-white uppercase">
            SOP Editor
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Manage the Standard Operating Procedures shown to members
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-2" />
          New SOP
        </Button>
      </div>

      {docs.length === 0 ? (
        <div className="text-center py-16 bg-[#111111] border border-[#1e1e1e] rounded-xl">
          <p className="text-gray-500 mb-4">No SOP documents yet.</p>
          <Button onClick={() => setShowCreate(true)}>Create the first one</Button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <select
              value={selectedId ?? ""}
              onChange={(e) => setSelectedId(e.target.value)}
              aria-label="Select SOP document to edit"
              className="h-9 rounded-md border border-[#1e1e1e] bg-[#111111] px-3 py-1 text-sm text-white min-w-[220px]"
            >
              {docs.map((d) => (
                <option key={d.id} value={d.id}>{d.title}</option>
              ))}
            </select>

            {selectedDoc && !isLegacy && (
              <Input
                key={selectedDoc.id}
                defaultValue={selectedDoc.title}
                onBlur={(e) => handleRename(e.target.value)}
                className="max-w-xs"
                placeholder="Document title"
                aria-label="Rename document"
              />
            )}

            {isDirty && <span className="text-xs text-yellow-500">Unsaved changes</span>}

            <Button
              size="sm"
              variant="ghost"
              className="text-red-400 ml-auto"
              onClick={handleDelete}
              disabled={!selectedDoc || isLegacy}
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Delete
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !selectedDoc || !isDirty || isLegacy}
              className="bg-[#dc2626] text-black hover:bg-[#b91c1c]"
            >
              <Save className="w-4 h-4 mr-2" />
              {saving ? "Saving..." : "Save Content"}
            </Button>
          </div>

          {isLegacy && (
            <div className="mb-4 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-200">
              <p className="font-medium">Read-only — the SopDocument table does not exist yet.</p>
              <p className="text-yellow-200/80 mt-1">
                Your existing SOP is shown below from the old storage. Run{" "}
                <code className="bg-black/30 px-1 rounded">npm run db:push</code> then{" "}
                <code className="bg-black/30 px-1 rounded">npm run db:migrate-sop</code> against the
                database to enable editing and multiple documents.
              </p>
            </div>
          )}

          <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[#1e1e1e] flex items-center gap-2">
              <span className="text-xs text-gray-500">Markdown</span>
            </div>
            <textarea
              value={content}
              readOnly={isLegacy}
              onChange={(e) =>
                selectedDoc && setDrafts((prev) => ({ ...prev, [selectedDoc.id]: e.target.value }))
              }
              className="w-full h-[600px] bg-transparent text-gray-300 text-sm p-4 focus:outline-none resize-none font-[family-name:var(--font-mono)]"
              placeholder="Write this SOP's content using Markdown..."
            />
          </div>

          <div className="mt-4 text-xs text-gray-600">
            Supports Markdown formatting. Use headings (#, ##, ###), lists (-, *), bold (**text**), tables, and more.
          </div>
        </>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>New SOP Document</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <Label>Title</Label>
              <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} required autoFocus />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button type="submit">Create</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
