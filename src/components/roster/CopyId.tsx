"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

/** A long ID shown truncated, copied in full on click. */
export function CopyId({ value, label = "Copy" }: { value: string | null; label?: string }) {
  const [copied, setCopied] = useState(false);

  if (!value) return <span className="text-gray-600">—</span>;

  return (
    <button
      type="button"
      title={`${label}: ${value}`}
      onClick={(e) => {
        // Rows open the member drawer on click; copying must not.
        e.stopPropagation();
        navigator.clipboard
          ?.writeText(value)
          .then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          })
          .catch(() => {});
      }}
      className="group inline-flex max-w-[150px] items-center gap-1.5 font-[family-name:var(--font-mono)] text-xs text-gray-400 hover:text-white"
    >
      <span className="truncate">{value}</span>
      {copied ? (
        <Check className="h-3 w-3 shrink-0 text-emerald-400" />
      ) : (
        <Copy className="h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
      )}
    </button>
  );
}
