"use client";

import React from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { PRESENTATIONAL_TYPES, type FormField, type Answers } from "@/lib/medical";

/**
 * One form field, rendered from its definition.
 *
 * The same component backs the doctor's form and the builder's live preview,
 * so what Command sees while building is literally what a doctor will fill in.
 */
export default function FieldInput({
  field,
  answers,
  onChange,
  disabled,
}: {
  field: FormField;
  answers: Answers;
  onChange: (name: string, value: unknown) => void;
  disabled?: boolean;
}) {
  const value = answers[field.name];
  const text = value === undefined || value === null ? "" : String(value);
  const set = (v: unknown) => onChange(field.name, v);

  if (field.type === "heading") {
    return (
      <div className="pt-4 first:pt-0">
        <h3 className="font-[family-name:var(--font-oswald)] text-white text-sm font-semibold uppercase tracking-wide">
          {field.label}
        </h3>
        {field.description && <p className="text-gray-500 text-xs mt-1">{field.description}</p>}
      </div>
    );
  }

  if (field.type === "separator") {
    return (
      <div className="py-2">
        <div className="border-t border-[#1e1e28]" />
        {field.description && <p className="text-gray-500 text-xs mt-2">{field.description}</p>}
      </div>
    );
  }

  if (field.type === "departmentInfo") {
    return (
      <div className="rounded-lg border border-[#1e1e28] bg-[#111118] px-3 py-2">
        <div className="text-[11px] uppercase tracking-wide text-gray-500">{field.label}</div>
        <div className="text-sm text-gray-300 mt-1">
          {field.description || "Department details are printed from the export letterhead."}
        </div>
      </div>
    );
  }

  const label = (
    <div className="flex items-baseline justify-between gap-2">
      <label className="text-gray-400 text-sm" htmlFor={`f-${field.id}`}>
        {field.label}
        {field.required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {!field.inExport && <span className="text-[10px] text-gray-600 uppercase">Internal</span>}
    </div>
  );

  const help = field.description ? (
    <p className="text-gray-600 text-xs mt-1">{field.description}</p>
  ) : null;

  const control = (() => {
    switch (field.type) {
      case "longText":
      case "assessment":
        return (
          <Textarea
            id={`f-${field.id}`}
            value={text}
            disabled={disabled}
            placeholder={field.placeholder}
            rows={field.type === "assessment" ? 5 : 3}
            onChange={(e) => set(e.target.value)}
            className="mt-1"
          />
        );

      case "dropdown":
        return (
          <Select
            id={`f-${field.id}`}
            value={text}
            disabled={disabled}
            onChange={(e) => set(e.target.value)}
            className="mt-1"
          >
            <option value="">{field.placeholder || "Select…"}</option>
            {(field.options ?? []).map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </Select>
        );

      case "multiSelect": {
        const selected = Array.isArray(value) ? (value as string[]) : [];
        return (
          <div className="mt-1 flex flex-wrap gap-2">
            {(field.options ?? []).map((o) => {
              const on = selected.includes(o);
              return (
                <button
                  key={o}
                  type="button"
                  disabled={disabled}
                  onClick={() => set(on ? selected.filter((s) => s !== o) : [...selected, o])}
                  className={`px-2.5 py-1 rounded-md text-xs border transition-colors disabled:opacity-50 ${
                    on
                      ? "border-red-600/60 bg-red-600/15 text-red-300"
                      : "border-[#1e1e28] bg-[#111118] text-gray-400 hover:text-white"
                  }`}
                >
                  {o}
                </button>
              );
            })}
          </div>
        );
      }

      case "radio":
        return (
          <div className="mt-1 flex flex-wrap gap-2">
            {(field.options ?? []).map((o) => (
              <button
                key={o}
                type="button"
                disabled={disabled}
                onClick={() => set(o)}
                className={`px-2.5 py-1 rounded-md text-xs border transition-colors disabled:opacity-50 ${
                  text === o
                    ? "border-red-600/60 bg-red-600/15 text-red-300"
                    : "border-[#1e1e28] bg-[#111118] text-gray-400 hover:text-white"
                }`}
              >
                {o}
              </button>
            ))}
          </div>
        );

      case "yesNo":
      case "checkbox": {
        const on = value === true || value === "true" || value === "Yes";
        return (
          <div className="mt-1 flex gap-2">
            {[true, false].map((choice) => (
              <button
                key={String(choice)}
                type="button"
                disabled={disabled}
                onClick={() => set(choice)}
                className={`px-3 py-1 rounded-md text-xs border transition-colors disabled:opacity-50 ${
                  (value !== undefined && value !== "") && on === choice
                    ? choice
                      ? "border-green-600/60 bg-green-600/15 text-green-300"
                      : "border-red-600/60 bg-red-600/15 text-red-300"
                    : "border-[#1e1e28] bg-[#111118] text-gray-400 hover:text-white"
                }`}
              >
                {choice ? "Yes" : "No"}
              </button>
            ))}
          </div>
        );
      }

      case "patientInfo":
      case "doctorInfo":
        return (
          <Input
            id={`f-${field.id}`}
            value={text}
            disabled={disabled}
            onChange={(e) => set(e.target.value)}
            className="mt-1"
            placeholder={field.placeholder}
          />
        );

      case "signature":
        return (
          <Input
            id={`f-${field.id}`}
            value={text}
            disabled={disabled}
            onChange={(e) => set(e.target.value)}
            className="mt-1 font-[family-name:var(--font-mono)]"
            placeholder={field.placeholder || "Type your full name to sign"}
          />
        );

      case "fileAttachment":
      case "imageAttachment":
        return (
          <Input
            id={`f-${field.id}`}
            value={text}
            disabled={disabled}
            onChange={(e) => set(e.target.value)}
            className="mt-1"
            placeholder={field.placeholder || "Paste a link to the attachment"}
          />
        );

      default: {
        const inputType =
          field.type === "number"
            ? "number"
            : field.type === "date"
              ? "date"
              : field.type === "time"
                ? "time"
                : field.type === "datetime"
                  ? "datetime-local"
                  : "text";
        return (
          <Input
            id={`f-${field.id}`}
            type={inputType}
            value={text}
            disabled={disabled}
            placeholder={field.placeholder}
            min={field.validation?.min}
            max={field.validation?.max}
            onChange={(e) => set(e.target.value)}
            className="mt-1"
          />
        );
      }
    }
  })();

  return (
    <div>
      {label}
      {control}
      {help}
    </div>
  );
}

/** True when the field collects nothing, so callers can skip it in summaries. */
export function isPresentational(field: FormField): boolean {
  return PRESENTATIONAL_TYPES.includes(field.type);
}
