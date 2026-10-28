"use client";

import { useState } from "react";
import { ImageIcon, RotateCcw, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  CONTENT_GROUPS,
  SITE_CONTENT,
  validateValue,
  type ContentField,
  type ContentFieldState,
  type ContentValue,
} from "@/lib/site-content";
import { ImagePicker, type MediaItem } from "./MediaLibrary";

/** Unsaved edits by key. */
export type Edits = Record<string, ContentValue>;

/** The error for each edit that would not save, by key. */
export function editErrors(edits: Edits): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of SITE_CONTENT) {
    if (!(field.key in edits)) continue;
    const result = validateValue(field, edits[field.key]);
    if ("error" in result) errors[field.key] = result.error;
  }
  return errors;
}

/**
 * The website's text, links, pictures and section switches, grouped as they
 * appear on the site. Edits stay in this page until saved as drafts.
 */
export function ContentEditor({
  fields,
  media,
  edits,
  errors,
  onEdit,
  onDiscardDraft,
  onMediaChanged,
}: {
  fields: ContentFieldState[];
  media: MediaItem[];
  edits: Edits;
  errors: Record<string, string>;
  onEdit: (key: string, value: ContentValue) => void;
  onDiscardDraft: (key: string) => void;
  onMediaChanged: () => void;
}) {
  const byKey = new Map(fields.map((f) => [f.key, f]));

  return (
    <div className="space-y-6">
      {CONTENT_GROUPS.map((group) => {
        const groupFields = SITE_CONTENT.filter((f) => f.group === group.id);
        return (
          <section key={group.id} className="rounded-xl border border-[#1e1e28] bg-card">
            <header className="border-b border-[#1e1e28] px-5 py-4">
              <h2 className="font-[family-name:var(--font-oswald)] text-lg font-semibold uppercase tracking-wide text-white">
                {group.label}
              </h2>
              <p className="mt-0.5 text-sm text-gray-500">{group.description}</p>
            </header>
            <div className="divide-y divide-[#1e1e28]">
              {groupFields.map((field) => {
                const state = byKey.get(field.key);
                if (!state) return null;
                return (
                  <FieldRow
                    key={field.key}
                    field={field}
                    state={state}
                    value={field.key in edits ? edits[field.key] : state.value}
                    edited={field.key in edits}
                    error={errors[field.key]}
                    media={media}
                    onChange={(value) => onEdit(field.key, value)}
                    onDiscardDraft={() => onDiscardDraft(field.key)}
                    onMediaChanged={onMediaChanged}
                  />
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function FieldRow({
  field,
  state,
  value,
  edited,
  error,
  media,
  onChange,
  onDiscardDraft,
  onMediaChanged,
}: {
  field: ContentField;
  state: ContentFieldState;
  value: ContentValue;
  edited: boolean;
  error?: string;
  media: MediaItem[];
  onChange: (value: ContentValue) => void;
  onDiscardDraft: () => void;
  onMediaChanged: () => void;
}) {
  const id = `field-${field.key}`;
  const atDefault = value === field.default;

  return (
    <div className="px-5 py-4">
      <div className="flex flex-wrap items-center gap-2">
        {field.type === "toggle" ? (
          <label htmlFor={id} className="flex cursor-pointer items-center gap-3 text-sm text-gray-200">
            <input
              id={id}
              type="checkbox"
              checked={value === true}
              onChange={(e) => onChange(e.target.checked)}
              className="h-4 w-4 accent-red-600"
            />
            {field.label}
          </label>
        ) : (
          <Label htmlFor={id}>{field.label}</Label>
        )}
        {edited && <Badge className="bg-sky-500/15 text-sky-300">Not saved</Badge>}
        {!edited && state.pending && <Badge className="bg-amber-500/15 text-amber-300">Draft · not live yet</Badge>}
        <div className="ml-auto flex gap-1">
          {!edited && state.pending && (
            <SmallAction onClick={onDiscardDraft} title="Throw this draft away and keep what is live">
              <Undo2 className="h-3.5 w-3.5" /> Discard draft
            </SmallAction>
          )}
          {!atDefault && (
            <SmallAction onClick={() => onChange(field.default)} title="Put back what the site showed originally">
              <RotateCcw className="h-3.5 w-3.5" /> Default
            </SmallAction>
          )}
        </div>
      </div>

      {field.type !== "toggle" && (
        <div className="mt-2">
          <FieldInput id={id} field={field} value={value} media={media} onChange={onChange} onMediaChanged={onMediaChanged} />
        </div>
      )}

      {error ? (
        <p className="mt-1.5 text-xs text-red-400">{error}</p>
      ) : (
        <FieldHint field={field} value={value} />
      )}
    </div>
  );
}

function FieldHint({ field, value }: { field: ContentField; value: ContentValue }) {
  const count = typeof value === "string" && field.max && (field.type === "text" || field.type === "textarea");
  if (!field.help && !count) return null;
  return (
    <p className="mt-1.5 flex justify-between gap-4 text-xs text-gray-600">
      <span>{field.help}</span>
      {count && (
        <span className="shrink-0">
          {(value as string).length}/{field.max}
        </span>
      )}
    </p>
  );
}

function FieldInput({
  id,
  field,
  value,
  media,
  onChange,
  onMediaChanged,
}: {
  id: string;
  field: ContentField;
  value: ContentValue;
  media: MediaItem[];
  onChange: (value: ContentValue) => void;
  onMediaChanged: () => void;
}) {
  const text = typeof value === "string" ? value : "";
  switch (field.type) {
    case "textarea":
      return <Textarea id={id} value={text} rows={3} onChange={(e) => onChange(e.target.value)} />;
    case "image":
      return <ImageInput field={field} value={text} media={media} onChange={onChange} onMediaChanged={onMediaChanged} />;
    default:
      return (
        <Input
          id={id}
          // Not type="url": that would refuse a path on this site such as /connect.
          type={field.type === "email" ? "email" : "text"}
          inputMode={field.type === "url" ? "url" : undefined}
          value={text}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.type === "url" ? "https://…" : undefined}
        />
      );
  }
}

function ImageInput({
  field,
  value,
  media,
  onChange,
  onMediaChanged,
}: {
  field: ContentField;
  value: string;
  media: MediaItem[];
  onChange: (value: ContentValue) => void;
  onMediaChanged: () => void;
}) {
  const [picking, setPicking] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex h-20 w-32 items-center justify-center overflow-hidden rounded-lg border border-[#26262f] bg-[#0a0a0f]">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="h-full w-full object-contain" />
        ) : (
          <span className="px-2 text-center text-[11px] text-gray-600">
            {field.key === "brand.logo" ? "Star of Life (default)" : "None"}
          </span>
        )}
      </div>
      <Button type="button" variant="outline" size="sm" onClick={() => setPicking(true)}>
        <ImageIcon className="mr-1.5 h-4 w-4" />
        {value ? "Replace" : "Choose image"}
      </Button>
      {value && (
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")}>
          <X className="mr-1.5 h-4 w-4" />
          Remove
        </Button>
      )}
      <ImagePicker
        open={picking}
        onOpenChange={setPicking}
        media={media}
        current={value}
        onPick={onChange}
        onUploaded={onMediaChanged}
      />
    </div>
  );
}

function Badge({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${className}`}>{children}</span>
  );
}

function SmallAction({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-gray-500 transition-colors hover:bg-white/5 hover:text-white"
    >
      {children}
    </button>
  );
}
