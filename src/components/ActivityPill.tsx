"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface ActivityPillProps {
  activity: string;
}

function ActivityPillInner({ activity }: ActivityPillProps) {
  const styles: Record<string, string> = {
    Active: "bg-green-500/10 text-green-400 border-green-500/20",
    Reserve: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    LOA: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border",
        styles[activity] ?? "bg-gray-500/10 text-gray-400 border-gray-500/20"
      )}
    >
      {activity}
    </span>
  );
}

export default ActivityPillInner;
export { ActivityPillInner as ActivityPill };
