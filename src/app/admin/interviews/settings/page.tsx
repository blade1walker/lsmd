"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ErrorState } from "@/components/ui/error-state";
import { fetchJson, fetchList, errorMessage } from "@/lib/fetch-json";
import { DEFAULT_PROMOTION_SETTINGS, type PromotionSettingsValues } from "@/lib/interviews";
import { ArrowLeft, Save, Sliders } from "lucide-react";

interface Department {
  id: string;
  name: string;
}

/**
 * The thresholds EMS management sets rather than a developer hard-coding them:
 * what counts as a pass, what a candidate must have done before an interview
 * can be opened, and where the promotion announcement goes.
 */
export default function InterviewSettingsPage() {
  const [values, setValues] = useState<PromotionSettingsValues>(DEFAULT_PROMOTION_SETTINGS);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setValues(await fetchJson<PromotionSettingsValues>("/api/interviews/settings"));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    fetchList<Department>("/api/departments")
      .then(setDepartments)
      .catch(() => {
        // The required-departments picker falls back to whatever is already
        // configured; the rest of the page works without the list.
      });
  }, [load]);

  function set<K extends keyof PromotionSettingsValues>(key: K, value: PromotionSettingsValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function save() {
    setSaving(true);
    try {
      setValues(
        await fetchJson<PromotionSettingsValues>("/api/interviews/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        })
      );
      toast.success("Promotion settings saved");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-gray-500">Loading the promotion settings...</div>
      </div>
    );
  }

  if (error) {
    return <ErrorState title="Failed to load the promotion settings" message={error} onRetry={load} />;
  }

  return (
    <div className="max-w-3xl space-y-6">
      <Link href="/admin/interviews" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white">
        <ArrowLeft className="h-4 w-4" />
        Promotion &amp; Interview
      </Link>

      <div>
        <h1 className="flex items-center gap-2 font-[family-name:var(--font-oswald)] text-2xl font-bold uppercase text-white">
          <Sliders className="h-6 w-6 text-[#dc2626]" />
          Promotion Settings
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          What counts as a pass, what a candidate must have done before an interview can be opened, and where the
          promotion announcement is posted.
        </p>
      </div>

      <Section title="Scoring thresholds" description="Applied to the panel score and each category average.">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <NumberField label="Passing score" suffix="%" value={values.passingScore} onChange={(v) => set("passingScore", v)} />
          <NumberField label="Minimum SOP" suffix="%" value={values.minSopScore} onChange={(v) => set("minSopScore", v)} />
          <NumberField
            label="Minimum Medical"
            suffix="%"
            value={values.minMedicalScore}
            onChange={(v) => set("minMedicalScore", v)}
          />
          <NumberField
            label="Minimum Situation"
            suffix="%"
            value={values.minSituationScore}
            onChange={(v) => set("minSituationScore", v)}
          />
          <NumberField
            label="Minimum Overall"
            suffix="%"
            value={values.minOverallScore}
            onChange={(v) => set("minOverallScore", v)}
          />
        </div>
        <p className="mt-3 text-xs text-gray-600">
          A candidate passes only when the panel score clears the passing score <em>and</em> every category average
          clears its own minimum. The Lead still records the result — these decide what the panel is advised to do.
        </p>
      </Section>

      <Section
        title="Promotion eligibility"
        description="Checked when an interview is created. A candidate who fails a rule is shown as Not Yet Eligible with the reason."
      >
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <NumberField
            label="Minimum time in rank"
            suffix="days"
            value={values.minDaysInRank}
            onChange={(v) => set("minDaysInRank", v)}
          />
          <NumberField
            label="Minimum EMS tenure"
            suffix="days"
            value={values.minDaysInDepartment}
            onChange={(v) => set("minDaysInDepartment", v)}
          />
          <NumberField
            label="Minimum training"
            suffix="%"
            value={values.minTrainingPercent}
            onChange={(v) => set("minTrainingPercent", v)}
          />
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-[11px] uppercase tracking-wider text-gray-500">Required departments</label>
          {departments.length === 0 ? (
            <p className="text-sm text-gray-600">No departments are configured.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {departments.map((d) => {
                const on = values.requiredDepartments.includes(d.name);
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() =>
                      set(
                        "requiredDepartments",
                        on
                          ? values.requiredDepartments.filter((n) => n !== d.name)
                          : [...values.requiredDepartments, d.name]
                      )
                    }
                    className={`rounded-md border px-3 py-1.5 text-sm ${
                      on
                        ? "border-[#dc2626] bg-[#dc2626]/10 text-[#dc2626]"
                        : "border-[#1e1e28] text-gray-400 hover:text-gray-200"
                    }`}
                  >
                    {d.name}
                  </button>
                );
              })}
            </div>
          )}
          <p className="mt-1 text-xs text-gray-600">
            A candidate must hold a membership in each selected department — this is how the FTP/FTO completion
            requirement is enforced.
          </p>
        </div>

        <Toggle
          className="mt-4"
          label="Candidate must be Active on the roster"
          description="Someone on Reserve or LOA is not eligible."
          checked={values.requireActive}
          onChange={(v) => set("requireActive", v)}
        />
      </Section>

      <Section title="After a failed interview" description="How long a candidate waits before another attempt.">
        <NumberField
          label="Re-interview cooldown"
          suffix="days"
          value={values.cooldownDays}
          onChange={(v) => set("cooldownDays", v)}
        />
        <p className="mt-2 text-xs text-gray-600">Set to 0 to allow a new interview immediately.</p>

        <Toggle
          className="mt-4"
          label="Require the training check before finalizing"
          description="The Lead must tick that required training and certifications were verified."
          checked={values.requireTrainingCheck}
          onChange={(v) => set("requireTrainingCheck", v)}
        />
      </Section>

      <Section
        title="Promotion announcement"
        description="Posted only once an interview has been finalized as Passed and the roster has actually changed."
      >
        <Toggle
          label="Announce promotions"
          description="Turn off to promote silently."
          checked={values.announceWebhook}
          onChange={(v) => set("announceWebhook", v)}
        />

        <div className="mt-4">
          <label className="mb-1 block text-[11px] uppercase tracking-wider text-gray-500">
            Discord webhook URL
          </label>
          <Input
            value={values.announcementWebhookUrl ?? ""}
            onChange={(e) => set("announcementWebhookUrl", e.target.value)}
            placeholder="https://discord.com/api/webhooks/..."
            className="h-9 text-sm"
          />
          <p className="mt-1 text-xs text-gray-600">
            Leave empty to post to the shared promotion channel configured in Notify Settings.
          </p>
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-[11px] uppercase tracking-wider text-gray-500">Announcement</label>
          <Textarea
            value={values.announcementTemplate}
            onChange={(e) => set("announcementTemplate", e.target.value)}
            className="min-h-[200px] font-[family-name:var(--font-mono)] text-xs"
          />
          <p className="mt-1 text-xs text-gray-600">
            Placeholders: <code>{"{name}"}</code> <code>{"{callSign}"}</code> <code>{"{discordId}"}</code>{" "}
            <code>{"{fromRank}"}</code> <code>{"{toRank}"}</code> <code>{"{finalScore}"}</code>{" "}
            <code>{"{sessionId}"}</code> <code>{"{panel}"}</code>
          </p>
        </div>
      </Section>

      <div className="sticky bottom-0 flex justify-end border-t border-[#1e1e1e] bg-[#0a0a0f]/90 py-4 backdrop-blur">
        <Button disabled={saving} onClick={save}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Saving..." : "Save settings"}
        </Button>
      </div>
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-[#1e1e1e] bg-[#111111] p-5">
      <h2 className="font-[family-name:var(--font-oswald)] text-sm font-semibold uppercase tracking-wider text-white">
        {title}
      </h2>
      <p className="mb-4 mt-0.5 text-xs text-gray-500">{description}</p>
      {children}
    </section>
  );
}

function NumberField({
  label,
  suffix,
  value,
  onChange,
}: {
  label: string;
  suffix: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-[11px] uppercase tracking-wider text-gray-500">{label}</label>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={0}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-9 w-24 text-center"
        />
        <span className="text-xs text-gray-600">{suffix}</span>
      </div>
    </div>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
  className,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  className?: string;
}) {
  return (
    <label className={`flex items-start gap-2 text-sm ${className ?? ""}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 accent-red-600"
      />
      <span>
        <span className="text-gray-300">{label}</span>
        <span className="block text-xs text-gray-600">{description}</span>
      </span>
    </label>
  );
}
