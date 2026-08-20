"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
  const [newCategory, setNewCategory] = useState({ name: "", color: "#eab308" });

  const fetchData = async () => {
    try {
      const [ranksRes, catsRes] = await Promise.all([
        fetch("/api/admin/temp-ranks"),
        fetch("/api/admin/categories"),
      ]);
      setTempRanks(await ranksRes.json());
      setCategories(await catsRes.json());
    } catch (error) {
      console.error("Error fetching data:", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddTempRank = async () => {
    if (!newTempRank) return;
    try {
      await fetch("/api/admin/temp-ranks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newTempRank, order: tempRanks.length }),
      });
      setNewTempRank("");
      fetchData();
    } catch (error) {
      console.error("Error adding temp rank:", error);
    }
  };

  const handleDeleteTempRank = async (id: string) => {
    try {
      await fetch(`/api/admin/temp-ranks?id=${id}`, { method: "DELETE" });
      fetchData();
    } catch (error) {
      console.error("Error deleting temp rank:", error);
    }
  };

  const handleAddCategory = async () => {
    if (!newCategory.name) return;
    try {
      await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newCategory, order: categories.length }),
      });
      setNewCategory({ name: "", color: "#eab308" });
      fetchData();
    } catch (error) {
      console.error("Error adding category:", error);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    try {
      await fetch(`/api/admin/categories?id=${id}`, { method: "DELETE" });
      fetchData();
    } catch (error) {
      console.error("Error deleting category:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading templates...</div>
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
              className="bg-[#eab308] text-black hover:bg-[#ca8a04]"
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
              className="bg-[#eab308] text-black hover:bg-[#ca8a04]"
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
