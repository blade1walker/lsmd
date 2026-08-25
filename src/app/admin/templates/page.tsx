"use client";

import { useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

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

export default function AdminTemplatesPage() {
  const [tempRanks, setTempRanks] = useState<TempRank[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTempRank, setNewTempRank] = useState("");
  const [newCategory, setNewCategory] = useState({ name: "", color: "#dc2626" });

  const fetchData = async () => {
    try {
      const [ranksRes, catsRes] = await Promise.all([
        fetch("/api/admin/temp-ranks"),
        fetch("/api/admin/categories"),
      ]);
      setTempRanks(await ranksRes.json());
      setCategories(await catsRes.json());
    } catch (error) {
      toast.error("Failed to load templates");
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

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

  if (loading) {
    return (
      <div>
        <div className="mb-8">
          <Skeleton className="h-8 w-32 mb-2" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </div>
    );
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
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
      </div>
    </div>
  );
}
