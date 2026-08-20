"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

interface RadioCode {
  id: string;
  code: string;
  description: string;
  section: string;
  highlighted: boolean;
}

export default function AdminRadioCodesPage() {
  const [codes, setCodes] = useState<RadioCode[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ code: "", description: "", section: "ten", highlighted: false });

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/radio-codes");
      const data = await res.json();
      setCodes(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch("/api/radio-codes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setForm({ code: "", description: "", section: "ten", highlighted: false });
    setShowAdd(false);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/radio-codes/${id}`, { method: "DELETE" });
    fetchData();
  };

  const handleToggleHighlight = async (code: RadioCode) => {
    await fetch(`/api/radio-codes/${code.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ highlighted: !code.highlighted }),
    });
    fetchData();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-[family-name:var(--font-oswald)] text-2xl font-bold text-white uppercase">
            Radio Codes
          </h1>
          <p className="text-gray-500 text-sm mt-1">{codes.length} codes</p>
        </div>
        <Button onClick={() => setShowAdd(true)}>Add Code</Button>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-500">Loading...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {["ten", "eleven", "response"].map((section) => (
            <div key={section}>
              <h2 className="font-[family-name:var(--font-oswald)] text-lg font-semibold text-white uppercase mb-4">
                {section === "ten" ? "10-Codes" : section === "eleven" ? "11-Codes" : "Response Codes"}
              </h2>
              <div className="space-y-2">
                {codes.filter((c) => c.section === section).map((code) => (
                  <div
                    key={code.id}
                    className={`p-3 rounded-lg border flex items-center justify-between ${
                      code.highlighted ? "border-gold/30 bg-gold/5" : "border-[#1e1e1e] bg-card"
                    }`}
                  >
                    <div>
                      <span className="font-[family-name:var(--font-mono)] text-gold font-semibold text-sm mr-3">
                        {code.code}
                      </span>
                      <span className="text-gray-300 text-sm">{code.description}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => handleToggleHighlight(code)}>
                        {code.highlighted ? "★" : "☆"}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-6 text-xs text-red-400" onClick={() => handleDelete(code.id)}>
                        ×
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Radio Code</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAdd} className="space-y-4">
            <div>
              <Label>Code</Label>
              <Input value={form.code} onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))} placeholder="e.g. 10-4" required />
            </div>
            <div>
              <Label>Description</Label>
              <Input value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} required />
            </div>
            <div>
              <Label>Section</Label>
              <select
                value={form.section}
                onChange={(e) => setForm((p) => ({ ...p, section: e.target.value }))}
                className="flex h-9 w-full rounded-md border border-[#1e1e1e] bg-[#111111] px-3 py-1 text-sm text-white"
              >
                <option value="ten">10-Codes</option>
                <option value="eleven">11-Codes</option>
                <option value="response">Response Codes</option>
              </select>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button type="submit">Add</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
