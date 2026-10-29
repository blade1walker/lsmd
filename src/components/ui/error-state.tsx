"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ErrorState({
  title = "Couldn't load this page",
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  /** Reloads the page's data; while its promise is pending the button says so. */
  onRetry?: () => unknown;
}) {
  const [retrying, setRetrying] = useState(false);

  const retry = async () => {
    setRetrying(true);
    try {
      await onRetry?.();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center mb-4">
        <AlertTriangle className="w-6 h-6 text-red-500" />
      </div>
      <h2 className="font-[family-name:var(--font-oswald)] text-lg font-semibold text-white uppercase">
        {title}
      </h2>
      <p className="text-sm text-gray-500 mt-2 max-w-md break-words">{message}</p>
      {onRetry && (
        <Button variant="ghost" className="mt-4" onClick={retry} disabled={retrying}>
          {retrying ? "Retrying…" : "Try again"}
        </Button>
      )}
    </div>
  );
}
