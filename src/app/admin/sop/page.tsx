"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Save } from "lucide-react";
import { toast } from "sonner";

export default function AdminSopPage() {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/sop")
      .then((res) => res.json())
      .then((data) => {
        setContent(data?.content ?? "");
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/sop", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("SOP saved successfully");
    } catch (error) {
      toast.error("Failed to save SOP");
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading SOP...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-[family-name:var(--font-oswald)] text-2xl font-bold text-white uppercase">
            SOP Editor
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Edit the Standard Operating Procedures content
          </p>
        </div>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-[#eab308] text-black hover:bg-[#ca8a04]"
        >
          <Save className="w-4 h-4 mr-2" />
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#1e1e1e] flex items-center gap-2">
          <span className="text-xs text-gray-500">Markdown</span>
        </div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="w-full h-[600px] bg-transparent text-gray-300 text-sm p-4 focus:outline-none resize-none font-[family-name:var(--font-mono)]"
          placeholder="Write your SOP content here using Markdown..."
        />
      </div>

      <div className="mt-4 text-xs text-gray-600">
        Supports Markdown formatting. Use headings (#, ##, ###), lists (-, *), bold (**text**), and more.
      </div>
    </div>
  );
}
