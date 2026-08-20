"use client";

import { Search } from "lucide-react";

interface FilterBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  activityFilter: string;
  onActivityFilterChange: (filter: string) => void;
}

export function FilterBar({
  searchQuery,
  onSearchChange,
  activityFilter,
  onActivityFilterChange,
}: FilterBarProps) {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-8">
      <div className="relative w-full sm:w-auto">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          type="text"
          placeholder="Search by name, callsign, rank..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full sm:w-80 pl-10 pr-4 py-2.5 bg-[#111111] border border-[#1e1e1e] rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-[#eab308]/50 focus:ring-1 focus:ring-[#eab308]/20 transition-all"
        />
      </div>

      <div className="flex gap-2">
        {["All", "Active", "Reserve", "LOA"].map((filter) => (
          <button
            key={filter}
            onClick={() => onActivityFilterChange(filter)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activityFilter === filter
                ? "bg-[#eab308] text-black"
                : "bg-[#111111] text-gray-400 hover:text-white border border-[#1e1e1e]"
            }`}
          >
            {filter}
          </button>
        ))}
      </div>
    </div>
  );
}
