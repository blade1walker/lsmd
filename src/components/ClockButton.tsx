"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";

interface ClockButtonProps {
  memberId: string;
  isClockedIn?: boolean;
  onToggle?: () => void;
}

function ClockButtonInner({ memberId, isClockedIn = false, onToggle }: ClockButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      const endpoint = isClockedIn ? "/api/clock/out" : "/api/clock/in";
      await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId }),
      });
      onToggle?.();
    } catch (err) {
      console.error("Clock error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant={isClockedIn ? "destructive" : "default"}
      size="sm"
      onClick={handleClick}
      disabled={loading}
      className="text-xs"
    >
      {loading ? "..." : isClockedIn ? "Clock Out" : "Clock In"}
    </Button>
  );
}

export default ClockButtonInner;
export { ClockButtonInner as ClockButton };
