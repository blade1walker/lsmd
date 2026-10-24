"use client";

import { Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { AnswerValue, PublicQuestion } from "@/lib/tests";

/**
 * One question as the member answers it. Shared by the test page and the
 * builder's preview, so what the builder shows is exactly what members get.
 */
export function QuestionInput({
  question: q,
  value,
  onChange,
  disabled,
}: {
  question: PublicQuestion;
  value: AnswerValue | undefined;
  onChange: (value: AnswerValue) => void;
  disabled?: boolean;
}) {
  if (q.type === "single" || q.type === "truefalse") {
    return (
      <div className={q.type === "truefalse" ? "grid grid-cols-2 gap-2" : "space-y-2"}>
        {q.options.map((o) => {
          const selected = value === o.id;
          return (
            <button
              key={o.id}
              type="button"
              disabled={disabled}
              onClick={() => onChange(o.id)}
              className={`flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-colors ${
                selected
                  ? "border-red-500/60 bg-red-600/10 text-white"
                  : "border-[#1e1e28] text-gray-300 hover:border-[#2e2e3a] hover:bg-white/[0.02]"
              }`}
            >
              <span
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                  selected ? "border-red-500" : "border-gray-600"
                }`}
              >
                {selected && <span className="h-2 w-2 rounded-full bg-red-500" />}
              </span>
              {o.text}
            </button>
          );
        })}
      </div>
    );
  }

  if (q.type === "multiple") {
    const picked = Array.isArray(value) ? value : [];
    return (
      <div className="space-y-2">
        <p className="text-xs text-gray-500">Select all that apply.</p>
        {q.options.map((o) => {
          const selected = picked.includes(o.id);
          return (
            <button
              key={o.id}
              type="button"
              disabled={disabled}
              onClick={() => onChange(selected ? picked.filter((id) => id !== o.id) : [...picked, o.id])}
              className={`flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-colors ${
                selected
                  ? "border-red-500/60 bg-red-600/10 text-white"
                  : "border-[#1e1e28] text-gray-300 hover:border-[#2e2e3a] hover:bg-white/[0.02]"
              }`}
            >
              <span
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                  selected ? "border-red-500 bg-red-500" : "border-gray-600"
                }`}
              >
                {selected && <Check className="h-3 w-3 text-white" />}
              </span>
              {o.text}
            </button>
          );
        })}
      </div>
    );
  }

  if (q.type === "dropdown") {
    return (
      <Select value={typeof value === "string" ? value : ""} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
        <option value="">Choose an answer…</option>
        {q.options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.text}
          </option>
        ))}
      </Select>
    );
  }

  if (q.type === "long") {
    return (
      <Textarea
        rows={6}
        disabled={disabled}
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Write your answer…"
      />
    );
  }

  return (
    <Input
      inputMode={q.type === "number" ? "decimal" : undefined}
      disabled={disabled}
      value={typeof value === "string" ? value : ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={q.type === "number" ? "Enter a number" : "Your answer"}
      className={q.type === "number" ? "max-w-xs" : undefined}
    />
  );
}
