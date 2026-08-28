"use client";

import { useState, useEffect, useCallback } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ErrorState } from "@/components/ui/error-state";
import { fetchList, errorMessage } from "@/lib/fetch-json";

interface TempRank {
  id: string;
  name: string;
  order: number;
}

interface Category {
  id: string;
  name: string;
  color: string;
  order: number;
}

interface Department {
  id: string;
  name: string;
  documentLink: string | null;
  order: number;
}

export default function AdminTemplatesPage() {
  const [tempRanks, setTempRanks] = useState<TempRank[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newTempRank, setNewTempRank] = useState("");
  const [newCategory, setNewCategory] = useState({ name: "", color: "#dc2626" });
  const [newDepartment, setNewDepartment] = useState({ name: "", documentLink: "" });
  const [editingDeptId, setEditingDeptId] = useState<string | null>(null);
  const [deptLinkDraft, setDeptLinkDraft] = useState("");

  const fetchData = useCallback(async () => {
    setError(null);
    try {
      const [rankList, catList, deptList] = await Promise.all([
        fetchList<TempRank>("/api/admin/temp-ranks"),
        fetchList<Category>("/api/admin/categories"),
        fetchList<Department>("/api/admin/departments"),
      ]);
      setTempRanks(rankList);
      setCategories(catList);
      setDepartments(deptList);
    } catch (err) {
      setError(errorMessage(err));
      setTempRanks([]);
      setCategories([]);
      setDepartments([]);
      toast.error("Failed to load templates");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAddTempRank = async () => {
    if (!newTempRank) return;
    try {
      const res = await fetch("/api/admin/temp-ranks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newTempRank, order: tempRanks.length }),
      });
      if (!res.ok) throw new Error("Failed");
      setNewTempRank("");
      toast.success("Temp rank added");
      fetchData();
    } catch (error) {
      toast.error("Failed to add temp rank");
    }
  };

  const handleDeleteTempRank = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/temp-ranks?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      toast.success("Temp rank removed");
      fetchData();
    } catch (error) {
      toast.error("Failed to delete temp rank");
    }
  };

  const handleAddCategory = async () => {
    if (!newCategory.name) return;
    try {
      const res = await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newCategory, order: categories.length }),
      });
      if (!res.ok) throw new Error("Failed");
      setNewCategory({ name: "", color: "#dc2626" });
      toast.success("Category added");
      fetchData();
    } catch (error) {
      toast.error("Failed to add category");
    }
  };

  const handleDeleteCategory = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/categories?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      toast.success("Category removed");
      fetchData();
    } catch (error) {
      toast.error("Failed to delete category");
    }
  };

  const handleAddDepartment = async () => {
    if (!newDepartment.name) return;
    try {
      const res = await fetch("/api/admin/departments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newDepartment, order: departments.length }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed");
      setNewDepartment({ name: "", documentLink: "" });
      toast.success("Department added");
      fetchData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add department");
    }
  };

  const handleDeleteDepartment = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/departments?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      toast.success("Department removed");
      fetchData();
    } catch (error) {
      toast.error("Failed to delete department");
    }
  };

  const startEditDeptLink = (dept: Department) => {
    setEditingDeptId(dept.id);
    setDeptLinkDraft(dept.documentLink ?? "");
  };

  const handleSaveDeptLink = async (id: string) => {
    try {
      const res = await fetch("/api/admin/departments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, documentLink: deptLinkDraft || null }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed");
      setEditingDeptId(null);
      toast.success("Document link saved");
      fetchData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save link");
    }
  };

  const handleRenameDepartment = async (id: string, name: string) => {
    const current = departments.find((d) => d.id === id);
    if (!current || !name.trim() || name.trim() === current.name) return;
    try {
      const res = await fetch("/api/admin/departments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed");
      toast.success("Department renamed");
      fetchData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to rename department");
    }
  };

  if (loading) {
    return (
      <div>
        <div className="mb-8">
          <Skeleton className="h-8 w-32 mb-2" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return <ErrorState title="Failed to load templates" message={error} onRetry={fetchData} />;
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-[family-name:var(--font-oswald)] text-2xl font-bold text-white uppercase">
          Templates
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Manage temporary ranks and category templates
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl p-6">
          <h2 className="font-[family-name:var(--font-oswald)] text-lg font-bold text-white uppercase mb-4">
            Temporary Ranks
          </h2>
          <div className="flex gap-2 mb-4">
            <Input
              value={newTempRank}
              onChange={(e) => setNewTempRank(e.target.value)}
              placeholder="e.g., Acting Paramedic"
              className="bg-[#0a0a0a] border-[#1e1e1e]"
              onKeyDown={(e) => e.key === "Enter" && handleAddTempRank()}
            />
            <Button
              onClick={handleAddTempRank}
              disabled={!newTempRank}
              className="bg-[#dc2626] text-black hover:bg-[#b91c1c]"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          <div className="space-y-2">
            {tempRanks.map((rank) => (
              <div
                key={rank.id}
                className="flex items-center justify-between p-3 bg-[#0a0a0a] rounded-lg"
              >
                <span className="text-white text-sm">{rank.name}</span>
                <button
                  onClick={() => handleDeleteTempRank(rank.id)}
                  className="p-1 text-gray-600 hover:text-red-400"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl p-6">
          <h2 className="font-[family-name:var(--font-oswald)] text-lg font-bold text-white uppercase mb-4">
            Categories
          </h2>
          <div className="flex gap-2 mb-4">
            <Input
              value={newCategory.name}
              onChange={(e) =>
                setNewCategory({ ...newCategory, name: e.target.value })
              }
              placeholder="Category name"
              className="bg-[#0a0a0a] border-[#1e1e1e]"
              onKeyDown={(e) => e.key === "Enter" && handleAddCategory()}
            />
            <input
              type="color"
              value={newCategory.color}
              onChange={(e) =>
                setNewCategory({ ...newCategory, color: e.target.value })
              }
              className="w-10 h-9 rounded cursor-pointer"
            />
            <Button
              onClick={handleAddCategory}
              disabled={!newCategory.name}
              className="bg-[#dc2626] text-black hover:bg-[#b91c1c]"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          <div className="space-y-2">
            {categories.map((cat) => (
              <div
                key={cat.id}
                className="flex items-center justify-between p-3 bg-[#0a0a0a] rounded-lg"
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: cat.color }}
                  />
                  <span className="text-white text-sm">{cat.name}</span>
                </div>
                <button
                  onClick={() => handleDeleteCategory(cat.id)}
                  className="p-1 text-gray-600 hover:text-red-400"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl p-6">
          <h2 className="font-[family-name:var(--font-oswald)] text-lg font-bold text-white uppercase mb-1">
            Departments
          </h2>
          <p className="text-gray-500 text-xs mb-4">
            Assignable on each roster member. Each can carry one document link.
          </p>
          <div className="flex gap-2 mb-4">
            <Input
              value={newDepartment.name}
              onChange={(e) => setNewDepartment((p) => ({ ...p, name: e.target.value }))}
              placeholder="Department name"
              className="bg-[#0a0a0a] border-[#1e1e1e]"
              onKeyDown={(e) => e.key === "Enter" && handleAddDepartment()}
            />
            <Button
              onClick={handleAddDepartment}
              disabled={!newDepartment.name}
              className="bg-[#dc2626] text-black hover:bg-[#b91c1c]"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          <div className="space-y-2">
            {departments.map((dept) => (
              <div key={dept.id} className="p-3 bg-[#0a0a0a] rounded-lg">
                <div className="flex items-center justify-between gap-2">
                  <Input
                    defaultValue={dept.name}
                    onBlur={(e) => handleRenameDepartment(dept.id, e.target.value)}
                    className="h-7 text-sm bg-transparent border-transparent hover:border-[#1e1e1e] focus:border-[#1e1e1e] px-1"
                  />
                  <button
                    onClick={() => handleDeleteDepartment(dept.id)}
                    className="p-1 text-gray-600 hover:text-red-400 shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                {editingDeptId === dept.id ? (
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      value={deptLinkDraft}
                      onChange={(e) => setDeptLinkDraft(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSaveDeptLink(dept.id)}
                      placeholder="https://..."
                      className="h-7 text-xs bg-[#111111] border-[#1e1e1e]"
                      autoFocus
                    />
                    <Button size="sm" className="h-7 text-xs" onClick={() => handleSaveDeptLink(dept.id)}>Save</Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingDeptId(null)}>Cancel</Button>
                  </div>
                ) : dept.documentLink ? (
                  <a
                    href={dept.documentLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 mt-1 px-1 text-xs text-red-400 hover:text-red-300 truncate"
                  >
                    <ExternalLink className="w-3 h-3 shrink-0" />
                    <span className="truncate">{dept.documentLink}</span>
                  </a>
                ) : (
                  <button
                    onClick={() => startEditDeptLink(dept)}
                    className="mt-1 px-1 text-xs text-gray-600 hover:text-gray-400"
                  >
                    + Add document link
                  </button>
                )}
                {editingDeptId !== dept.id && dept.documentLink && (
                  <button
                    onClick={() => startEditDeptLink(dept)}
                    className="mt-1 px-1 text-xs text-gray-600 hover:text-gray-400"
                  >
                    Edit link
                  </button>
                )}
              </div>
            ))}
            {departments.length === 0 && (
              <p className="text-gray-600 text-sm">No departments yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
