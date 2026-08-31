"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save, RotateCcw, ChevronDown, ChevronUp, MessageSquare, Webhook, Bot, Send, ScrollText, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { fetchJson, errorMessage } from "@/lib/fetch-json";

interface Settings {
  recruitWebhook: boolean;
  recruitDM: boolean;
  recruitWebhookApprove: string;
  recruitWebhookDecline: string;
  recruitDMApprove: string;
  recruitDMDecline: string;
  onboardingWebhook: boolean;
  onboardingDM: boolean;
  onboardingWebhookMessage: string;
  onboardingDMApprove: string;
  onboardingDMDecline: string;
  ftpWebhook: boolean;
  ftpDM: boolean;
  ftpDMApprove: string;
  ftpDMDecline: string;
  ftpWebhookApprove: string;
  departmentWebhook: boolean;
  departmentDM: boolean;
  departmentWebhookSubmitted: string;
  departmentWebhookApprove: string;
  departmentDMApprove: string;
  departmentDMDecline: string;
  loaWebhook: boolean;
  loaDM: boolean;
  loaWebhookApprove: string;
  loaWebhookDecline: string;
  loaDMApprove: string;
  loaDMDecline: string;
  loaReminderDM: boolean;
  loaReminderMessage: string;
  loaExpiredDM: boolean;
  loaExpiredMessage: string;
  promotionWebhook: boolean;
  promotionWebhookMessage: string;
  demotionWebhook: boolean;
  demotionWebhookMessage: string;
  callsignWebhook: boolean;
  callsignWebhookMessage: string;
  testWebhook: boolean;
  testDM: boolean;
  webhookUrls: {
    recruit?: string;
    onboarding?: string;
    ftp?: string;
    department?: string;
    loa?: string;
    promotion?: string;
    callsign?: string;
    accept?: string;
  } | null;
  botSettings: { token?: string; inviteLink?: string; stateInvite?: string } | null;
}

const DEFAULTS: Settings = {
  recruitWebhook: true,
  recruitDM: true,
  recruitWebhookApprove: "Congratulations! Your EMS application has been Accepted, <@{discordId}> For further details, please check your DMs",
  recruitWebhookDecline: "Unfortunately, your EMS application has been Declined, <@{discordId}> For further details, please check your DMs",
  recruitDMApprove: "Congratulations, {name}! 🎉\n\nYour recruitment application has been **Accepted**!\n\n**Assigned Rank:** {rank}\n\nJoin our state Discord server to get started:\n{inviteLink}\n\nWelcome aboard! 🚑🚀",
  recruitDMDecline: "Dear {name},\n\nWe regret to inform you that your recruitment application has been **Declined**.\n\nIf you have questions, please contact HR.",
  onboardingWebhook: false,
  onboardingDM: true,
  onboardingWebhookMessage: "<@{discordId}> **{name}** has been enrolled in the EMS roster.",
  onboardingDMApprove: "Congratulations, {name}! 🎉\n\nYou have been accepted into the Emergency Medical Services!\n\n**Your Details:**\n• Rank: {rank}\n• Call Sign: {callSign}\n• State ID: {stateId}\n\nJoin our state Discord server to get started:\n{inviteLink}\n\nWelcome aboard! 🚑🚀",
  onboardingDMDecline: "Dear {name},\n\nWe regret to inform you that your application has been **Declined**.\n\nIf you have questions, please contact HR.",
  ftpWebhook: false,
  ftpDM: true,
  ftpDMApprove: "Congratulations, {name}! 🎉\n\nYour Field Training Program (FTP) application has been **Accepted**! You have been assigned the FTP role and a trainer will reach out to you shortly.\n\nJoin our state Discord server:\n{inviteLink}",
  ftpDMDecline: "Dear {name},\n\nWe regret to inform you that your FTP application has been **Declined**.\n\nIf you have questions, please contact HR.",
  ftpWebhookApprove: "🎓 {name} ({callSign}) has enrolled in the Field Training Program!",
  departmentWebhook: true,
  departmentDM: true,
  departmentWebhookSubmitted: "📥 **{department}** — new join application from **{name}** ({rank}) <@{discordId}>",
  departmentWebhookApprove: "✅ <@{discordId}> **{name}** has joined **{department}**.",
  departmentDMApprove: "Congratulations, {name}! 🎉\n\nYour application to join **{department}** has been **Accepted**.\n\nWelcome to the team!",
  departmentDMDecline: "Dear {name},\n\nYour application to join **{department}** has been **Declined**.\n\nIf you have questions, please contact HR.",
  loaWebhook: true,
  loaDM: false,
  loaWebhookApprove: "<@{discordId}> **{name}** has been granted a Leave of Absence.",
  loaWebhookDecline: "<@{discordId}> **{name}**'s Leave of Absence request has been declined.",
  loaDMApprove: "Your Leave of Absence has been **Approved**.\n\nStart: {startDate}\nEnd: {endDate}\nReason: {reason}",
  loaDMDecline: "Your Leave of Absence request has been **Declined**.\n\nIf you have questions, please contact HR.",
  loaReminderDM: true,
  loaReminderMessage: "Hi {name}, your Leave of Absence ends on {endDate} — {daysLeft} day(s) from now. Let HR know if you need an extension.",
  loaExpiredDM: true,
  loaExpiredMessage: "Welcome back, {name}! Your Leave of Absence ended on {endDate} and your roster status is Active again.",
  promotionWebhook: true,
  promotionWebhookMessage: "🎉 Congratulations <@{discordId}>! {name} ({callSign}) has been promoted from **{fromRank}** to **{toRank}**!",
  demotionWebhook: false,
  demotionWebhookMessage: "📋 {name} ({callSign}) has been moved from **{fromRank}** to **{toRank}**.",
  callsignWebhook: true,
  callsignWebhookMessage: "📻 <@{discordId}>'s call sign has been updated: **{oldCallSign}** → **{newCallSign}**",
  testWebhook: true,
  testDM: true,
  webhookUrls: null,
  botSettings: null,
};

/** Mirrors the sample values the test endpoint substitutes, so preview matches what gets sent. */
const SAMPLE_VALUES: Record<string, string> = {
  name: "Sample Medic",
  rank: "Paramedic",
  department: "Surgical",
  tag: "Surgical",
  fromRank: "EMT",
  toRank: "Paramedic",
  callSign: "947",
  oldCallSign: "912",
  newCallSign: "947",
  stateId: "12345",
  startDate: new Date().toLocaleDateString(),
  endDate: new Date(Date.now() + 7 * 86_400_000).toLocaleDateString(),
  daysLeft: "2",
  reason: "Vacation",
  discordId: "123456789012345678",
  inviteLink: "https://discord.gg/example",
};

type BooleanKey = { [K in keyof Settings]: Settings[K] extends boolean ? K : never }[keyof Settings];
type StringKey = { [K in keyof Settings]: Settings[K] extends string ? K : never }[keyof Settings];
type WebhookKind = "recruit" | "onboarding" | "ftp" | "department" | "loa" | "promotion" | "callsign";

interface ChannelDef {
  id: string;
  label: string;
  hint: string;
  toggleKey: BooleanKey;
  /** "dm" sends through the bot; "webhook" posts to the channel named by webhookKind. */
  transport: "webhook" | "dm";
  webhookKind?: WebhookKind;
  variables: string[];
  fields: { key: StringKey; label: string }[];
}

interface GroupDef {
  id: string;
  title: string;
  description: string;
  channels: ChannelDef[];
}

/**
 * Each notification splits into its own channel section: the webhook posted in a
 * channel and the DM sent to the member are different messages with different
 * variables, so each gets its own editor instead of one shared drawer.
 */
const MESSAGE_GROUPS: GroupDef[] = [
  {
    id: "recruit",
    title: "Recruit",
    description: "Approval and decline notifications",
    channels: [
      {
        id: "webhook",
        label: "Webhook",
        hint: "Posted publicly in the recruitment channel",
        toggleKey: "recruitWebhook",
        transport: "webhook",
        webhookKind: "recruit",
        variables: ["<@{discordId}>", "{name}", "{rank}", "{inviteLink}"],
        fields: [
          { key: "recruitWebhookApprove", label: "Approved" },
          { key: "recruitWebhookDecline", label: "Declined" },
        ],
      },
      {
        id: "dm",
        label: "Direct Message",
        hint: "Sent privately to the applicant by the bot",
        toggleKey: "recruitDM",
        transport: "dm",
        variables: ["{name}", "{rank}", "{inviteLink}"],
        fields: [
          { key: "recruitDMApprove", label: "Approved" },
          { key: "recruitDMDecline", label: "Declined" },
        ],
      },
    ],
  },
  {
    id: "onboarding",
    title: "Onboarding",
    description: "New member enrollment notifications",
    channels: [
      {
        id: "webhook",
        label: "Webhook",
        hint: "Embed description posted in the enrollment channel",
        toggleKey: "onboardingWebhook",
        transport: "webhook",
        webhookKind: "onboarding",
        variables: ["<@{discordId}>", "{name}", "{rank}", "{callSign}", "{stateId}"],
        fields: [{ key: "onboardingWebhookMessage", label: "Enrolled" }],
      },
      {
        id: "dm",
        label: "Direct Message",
        hint: "Sent privately to the new member by the bot",
        toggleKey: "onboardingDM",
        transport: "dm",
        variables: ["{name}", "{rank}", "{callSign}", "{stateId}", "{inviteLink}"],
        fields: [
          { key: "onboardingDMApprove", label: "Approved" },
          { key: "onboardingDMDecline", label: "Declined" },
        ],
      },
    ],
  },
  {
    id: "ftp",
    title: "FTP",
    description: "Field Training Program notifications",
    channels: [
      {
        id: "webhook",
        label: "Webhook",
        hint: "Posted publicly in the FTP channel",
        toggleKey: "ftpWebhook",
        transport: "webhook",
        webhookKind: "ftp",
        variables: ["{name}", "{callSign}"],
        fields: [{ key: "ftpWebhookApprove", label: "Enrolled" }],
      },
      {
        id: "dm",
        label: "Direct Message",
        hint: "Sent privately to the trainee by the bot",
        toggleKey: "ftpDM",
        transport: "dm",
        variables: ["{name}", "{inviteLink}"],
        fields: [
          { key: "ftpDMApprove", label: "Approved" },
          { key: "ftpDMDecline", label: "Declined" },
        ],
      },
    ],
  },
  {
    id: "department",
    title: "Department Joins",
    description: "Join applications, and the decision on them",
    channels: [
      {
        id: "webhook",
        label: "Webhook",
        hint: "Posted in the department's own channel, or the shared department channel when it has none",
        toggleKey: "departmentWebhook",
        transport: "webhook",
        webhookKind: "department",
        variables: ["<@{discordId}>", "{department}", "{tag}", "{name}", "{rank}", "{callSign}"],
        fields: [
          { key: "departmentWebhookSubmitted", label: "Application received" },
          { key: "departmentWebhookApprove", label: "Approved" },
        ],
      },
      {
        id: "dm",
        label: "Direct Message",
        hint: "Sent privately to the applicant by the bot",
        toggleKey: "departmentDM",
        transport: "dm",
        variables: ["{department}", "{tag}", "{name}", "{rank}"],
        fields: [
          { key: "departmentDMApprove", label: "Approved" },
          { key: "departmentDMDecline", label: "Declined" },
        ],
      },
    ],
  },
  {
    id: "loa",
    title: "LOA",
    description: "Leave of Absence notifications",
    channels: [
      {
        id: "webhook",
        label: "Webhook",
        hint: "Embed description posted in the LOA channel",
        toggleKey: "loaWebhook",
        transport: "webhook",
        webhookKind: "loa",
        variables: ["<@{discordId}>", "{name}", "{rank}", "{callSign}", "{startDate}", "{endDate}", "{reason}"],
        fields: [
          { key: "loaWebhookApprove", label: "Approved" },
          { key: "loaWebhookDecline", label: "Declined" },
        ],
      },
      {
        id: "dm",
        label: "Direct Message",
        hint: "Sent privately to the member by the bot",
        toggleKey: "loaDM",
        transport: "dm",
        variables: ["{name}", "{rank}", "{callSign}", "{startDate}", "{endDate}", "{reason}"],
        fields: [
          { key: "loaDMApprove", label: "Approved" },
          { key: "loaDMDecline", label: "Declined" },
        ],
      },
      {
        id: "reminder",
        label: "Ending-soon reminder",
        hint: "DM sent by the nightly job 1-2 days before the leave ends",
        toggleKey: "loaReminderDM",
        transport: "dm",
        variables: ["{name}", "{rank}", "{callSign}", "{endDate}", "{daysLeft}", "{reason}"],
        fields: [{ key: "loaReminderMessage", label: "Reminder" }],
      },
      {
        id: "expired",
        label: "Leave ended",
        hint: "DM sent when the nightly job expires the leave and restores Active status",
        toggleKey: "loaExpiredDM",
        transport: "dm",
        variables: ["{name}", "{rank}", "{callSign}", "{startDate}", "{endDate}", "{reason}"],
        fields: [{ key: "loaExpiredMessage", label: "Ended" }],
      },
    ],
  },
  {
    id: "promotion",
    title: "Promotion",
    description: "Posted to the channel whenever a member's rank increases",
    channels: [
      {
        id: "webhook",
        label: "Webhook",
        hint: "Posted publicly in the promotion channel",
        toggleKey: "promotionWebhook",
        transport: "webhook",
        webhookKind: "promotion",
        variables: ["<@{discordId}>", "{name}", "{callSign}", "{fromRank}", "{toRank}"],
        fields: [{ key: "promotionWebhookMessage", label: "Promoted" }],
      },
    ],
  },
  {
    id: "demotion",
    title: "Demotion",
    description: "Posted when a member's rank moves down, on the promotion channel",
    channels: [
      {
        id: "webhook",
        label: "Webhook",
        hint: "Off by default — a rank drop is not always something to announce",
        toggleKey: "demotionWebhook",
        transport: "webhook",
        webhookKind: "promotion",
        variables: ["<@{discordId}>", "{name}", "{callSign}", "{fromRank}", "{toRank}"],
        fields: [{ key: "demotionWebhookMessage", label: "Demoted" }],
      },
    ],
  },
  {
    id: "callsign",
    title: "Call Sign",
    description: "Posted to the channel whenever a member's call sign is changed outside of a rank change",
    channels: [
      {
        id: "webhook",
        label: "Webhook",
        hint: "Posted publicly in the call sign channel — falls back to the promotion channel if none is set",
        toggleKey: "callsignWebhook",
        transport: "webhook",
        webhookKind: "callsign",
        variables: ["<@{discordId}>", "{name}", "{oldCallSign}", "{newCallSign}"],
        fields: [{ key: "callsignWebhookMessage", label: "Call Sign Updated" }],
      },
    ],
  },
  {
    id: "test",
    title: "Test",
    description: "Master switches for the test sends on this page",
    channels: [
      { id: "webhook", label: "Webhook", hint: "", toggleKey: "testWebhook", transport: "webhook", variables: [], fields: [] },
      { id: "dm", label: "Direct Message", hint: "", toggleKey: "testDM", transport: "dm", variables: [], fields: [] },
    ],
  },
];

const WEBHOOK_URL_FIELDS: { key: WebhookKind; label: string; env: string; note?: string }[] = [
  { key: "recruit", label: "Recruit (accept / decline)", env: "DISCORD_ACCEPT_WEBHOOK_URL" },
  { key: "onboarding", label: "Onboarding (enrollment)", env: "DISCORD_ENROLL_WEBHOOK_URL" },
  { key: "ftp", label: "FTP", env: "DISCORD_FTP_WEBHOOK_URL" },
  {
    key: "department",
    label: "Department joins",
    env: "DISCORD_DEPARTMENT_WEBHOOK_URL",
    note: "Only used by departments with no webhook of their own. Leave both empty to post on the FTP channel instead.",
  },
  { key: "loa", label: "LOA", env: "DISCORD_LOA_WEBHOOK_URL" },
  { key: "promotion", label: "Promotion / demotion", env: "DISCORD_PROMOTION_WEBHOOK_URL" },
  {
    key: "callsign",
    label: "Call sign",
    env: "DISCORD_CALLSIGN_WEBHOOK_URL",
    note: "Leave both empty to post call sign changes on the promotion channel instead.",
  },
];

interface Delivery {
  id: string;
  event: string;
  channel: string;
  target: string | null;
  ok: boolean;
  status: number | null;
  error: string | null;
  preview: string;
  createdAt: string;
}

/** Substitutes {placeholders}, leaving unknown ones visible so a typo stands out. */
function renderPreview(template: string): string {
  return template.replace(/{(\w+)}/g, (match, key: string) => SAMPLE_VALUES[key] ?? match);
}

/** Placeholder names used in a message that this channel never substitutes. */
function unknownVariables(template: string, allowed: string[]): string[] {
  const permitted = new Set(allowed.map((v) => v.replace(/[^\w]/g, "")));
  const used = [...template.matchAll(/{(\w+)}/g)].map((m) => m[1]);
  return [...new Set(used.filter((name) => !permitted.has(name)))];
}

/**
 * Declared at module scope rather than inside the page: a component re-created
 * on every render remounts its textarea, which drops focus after a keystroke.
 */
function Switch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`w-11 h-6 shrink-0 rounded-full relative transition-colors cursor-pointer ${checked ? "bg-[#dc2626]" : "bg-[#2a2a2a]"}`}
    >
      <span className={`block w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${checked ? "translate-x-5.5" : "translate-x-0.5"}`} />
    </button>
  );
}

function MessageField({
  label,
  value,
  defaultValue,
  variables,
  onChange,
  onTest,
  testing,
}: {
  label: string;
  value: string;
  defaultValue: string;
  variables: string[];
  onChange: (v: string) => void;
  onTest: () => void;
  testing: boolean;
}) {
  const isDefault = value === defaultValue;
  const unknown = unknownVariables(value, variables);

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-1">
        <label className="text-gray-400 text-xs font-medium">{label}</label>
        <div className="flex items-center gap-3">
          {isDefault ? (
            <span className="text-[10px] uppercase tracking-wide text-gray-600">Default</span>
          ) : (
            <button
              type="button"
              onClick={() => onChange(defaultValue)}
              className="text-[10px] uppercase tracking-wide text-gray-500 hover:text-[#dc2626] transition-colors"
            >
              Restore default
            </button>
          )}
          <button
            type="button"
            onClick={onTest}
            disabled={testing}
            className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-gray-500 hover:text-[#dc2626] transition-colors disabled:opacity-40"
          >
            {testing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
            Send test
          </button>
        </div>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        placeholder={defaultValue}
        className="w-full bg-[#0a0a0a] border border-[#1e1e1e] rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#dc2626] resize-y"
      />
      {unknown.length > 0 && (
        <p className="text-amber-500/90 text-xs mt-1">
          Not substituted here: {unknown.map((v) => `{${v}}`).join(", ")} — it will be sent literally.
        </p>
      )}
      <details className="mt-1 group">
        <summary className="text-[10px] uppercase tracking-wide text-gray-600 cursor-pointer hover:text-gray-400 list-none">
          Preview
        </summary>
        <pre className="mt-1 whitespace-pre-wrap break-words bg-[#0a0a0a] border border-[#1e1e1e] rounded-md px-3 py-2 text-xs text-gray-300 font-[family-name:var(--font-sans)]">
          {renderPreview(value) || "(empty)"}
        </pre>
      </details>
    </div>
  );
}

function ChannelSection({
  channel,
  settings,
  onChange,
  open,
  onToggleOpen,
  onTest,
  testingField,
}: {
  channel: ChannelDef;
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  open: boolean;
  onToggleOpen: () => void;
  onTest: (channel: ChannelDef, field: StringKey) => void;
  testingField: string | null;
}) {
  const enabled = settings[channel.toggleKey];
  const editable = channel.fields.length > 0;
  const allDefault = channel.fields.every((f) => settings[f.key] === DEFAULTS[f.key]);

  const restoreAll = () => {
    const patch: Partial<Settings> = {};
    for (const f of channel.fields) patch[f.key] = DEFAULTS[f.key];
    onChange(patch);
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3 py-3 px-4 hover:bg-white/5">
        <button
          type="button"
          onClick={onToggleOpen}
          disabled={!editable}
          className="flex items-center gap-2 flex-1 min-w-0 text-left disabled:cursor-default"
        >
          {editable ? (
            open ? (
              <ChevronUp className="w-4 h-4 text-gray-500 shrink-0" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-500 shrink-0" />
            )
          ) : (
            <span className="w-4 shrink-0" />
          )}
          <span className="min-w-0">
            <span className="block text-sm text-gray-300">{channel.label}</span>
            {channel.hint && <span className="block text-gray-500 text-xs mt-0.5 truncate">{channel.hint}</span>}
          </span>
        </button>
        <Switch checked={enabled} onChange={(v) => onChange({ [channel.toggleKey]: v } as Partial<Settings>)} />
      </div>

      {editable && open && (
        <div className="bg-[#0d0d0d] border-t border-[#1e1e1e] px-4 py-4 space-y-4">
          {!enabled && (
            <p className="text-amber-500/80 text-xs">
              {channel.label} is off — these messages are saved, but nothing is sent until you enable it.
            </p>
          )}
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <p className="text-gray-500 text-xs">
              <strong className="text-gray-400">Variables:</strong>{" "}
              {channel.variables.map((v) => (
                <code key={v} className="bg-white/5 border border-[#1e1e1e] rounded px-1 py-0.5 mr-1 text-gray-400">
                  {v}
                </code>
              ))}
            </p>
            <button
              type="button"
              onClick={restoreAll}
              disabled={allDefault}
              className="text-xs text-gray-500 hover:text-[#dc2626] transition-colors disabled:opacity-40 disabled:hover:text-gray-500 shrink-0"
            >
              Restore defaults
            </button>
          </div>
          {channel.fields.map((f) => (
            <MessageField
              key={f.key}
              label={f.label}
              value={settings[f.key]}
              defaultValue={DEFAULTS[f.key]}
              variables={channel.variables}
              onChange={(v) => onChange({ [f.key]: v } as Partial<Settings>)}
              onTest={() => onTest(channel, f.key)}
              testing={testingField === f.key}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminNotificationSettingsPage() {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<"messages" | "webhooks" | "bot" | "log">("messages");
  const [testDiscordId, setTestDiscordId] = useState("");
  const [testingField, setTestingField] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [failuresOnly, setFailuresOnly] = useState(false);
  const [loadingLog, setLoadingLog] = useState(false);

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/admin/notification-settings");
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      } else {
        toast.error("Failed to load notification settings");
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  // Loaded when the tab is opened or refreshed rather than from an effect —
  // the log is a snapshot the admin asks for, not state to keep in sync.
  const fetchDeliveries = useCallback(async (failed = failuresOnly) => {
    setLoadingLog(true);
    try {
      const res = await fetch(`/api/admin/notification-settings/deliveries${failed ? "?failed=1" : ""}`);
      if (res.ok) setDeliveries(await res.json());
    } catch (err) {
      console.error(err);
    }
    setLoadingLog(false);
  }, [failuresOnly]);

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetchJson("/api/admin/notification-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error(err);
      toast.error(errorMessage(err));
    }
    setSaving(false);
  };

  const handleReset = () => {
    setSettings(DEFAULTS);
  };

  const patchSettings = (patch: Partial<Settings>) => setSettings((prev) => ({ ...prev, ...patch }));

  /**
   * Sends the channel's own message, rendered with sample values. Saves first —
   * the server reads the stored template, so testing an unsaved edit would
   * otherwise send the previous text.
   */
  const handleTest = async (channel: ChannelDef, field: StringKey) => {
    if (channel.transport === "dm" && !testDiscordId) {
      toast.error("Enter a Discord ID at the top of this tab to receive test DMs");
      return;
    }

    setTestingField(field);
    try {
      await fetchJson("/api/admin/notification-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const res = await fetch("/api/admin/notification-settings/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: channel.transport,
          field,
          kind: channel.webhookKind,
          discordId: testDiscordId,
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) toast.success(`Test sent — ${data.detail}`);
      else toast.error(data.error || data.detail || "Test failed");
    } catch (err) {
      toast.error(errorMessage(err));
    }
    setTestingField(null);
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <Loader2 className="w-8 h-8 text-gray-500 animate-spin mx-auto" />
      </div>
    );
  }

  const tabs = [
    { id: "messages" as const, label: "Messages", icon: MessageSquare },
    { id: "webhooks" as const, label: "Webhooks", icon: Webhook },
    { id: "bot" as const, label: "Bot", icon: Bot },
    { id: "log" as const, label: "Delivery log", icon: ScrollText },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-[family-name:var(--font-oswald)] text-2xl font-bold text-white uppercase">
            Notification Settings
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Manage messages, webhooks, and bot configuration
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={handleReset} variant="outline" className="border-[#1e1e1e] text-gray-400">
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset
          </Button>
          <Button onClick={handleSave} disabled={saving} className="bg-[#dc2626] text-black hover:bg-[#b91c1c]">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            {saved ? "Saved!" : "Save"}
          </Button>
        </div>
      </div>

      {/* Section Tabs */}
      <div className="flex gap-1 mb-6 bg-[#111111] border border-[#1e1e1e] rounded-xl p-1 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveSection(tab.id);
              if (tab.id === "log") fetchDeliveries();
            }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              activeSection === tab.id ? "bg-[#dc2626] text-black" : "text-gray-400 hover:text-white"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Messages Section */}
      {activeSection === "messages" && (
        <div className="space-y-4">
          <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap">
            <div className="min-w-0">
              <p className="text-sm text-gray-300">Test recipient</p>
              <p className="text-gray-500 text-xs mt-0.5">
                Discord ID that receives the DM tests. Webhook tests post to the configured channel.
              </p>
            </div>
            <Input
              value={testDiscordId}
              onChange={(e) => setTestDiscordId(e.target.value)}
              placeholder="Your Discord ID"
              className="ml-auto w-56 bg-[#0a0a0a] border-[#1e1e1e] text-white"
            />
          </div>

          <p className="text-gray-500 text-xs">
            Every notification type lists its channels separately — open one to edit the exact message that channel
            sends, preview it, restore the default wording, or send yourself a test.
          </p>

          {MESSAGE_GROUPS.map((group) => (
            <div key={group.id} className="bg-[#111111] border border-[#1e1e1e] rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-[#1e1e1e]">
                <h3 className="font-[family-name:var(--font-oswald)] text-sm font-semibold text-white uppercase">{group.title}</h3>
                <p className="text-gray-500 text-xs mt-0.5">{group.description}</p>
              </div>
              <div className="divide-y divide-[#1e1e1e]/50">
                {group.channels.map((channel) => {
                  const key = `${group.id}:${channel.id}`;
                  return (
                    <ChannelSection
                      key={key}
                      channel={channel}
                      settings={settings}
                      onChange={patchSettings}
                      open={expanded === key}
                      onToggleOpen={() => setExpanded(expanded === key ? null : key)}
                      onTest={handleTest}
                      testingField={testingField}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Webhooks Section */}
      {activeSection === "webhooks" && (
        <div className="space-y-4">
          <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[#1e1e1e]">
              <h3 className="font-[family-name:var(--font-oswald)] text-sm font-semibold text-white uppercase">Webhook URLs</h3>
              <p className="text-gray-500 text-xs mt-0.5">
                A URL set here overrides the matching environment variable. Leave one blank to keep using the variable.
              </p>
            </div>
            <div className="p-4 space-y-4">
              {WEBHOOK_URL_FIELDS.map((field) => (
                <div key={field.key}>
                  <Label className="text-gray-400 text-sm">{field.label}</Label>
                  <Input
                    value={settings.webhookUrls?.[field.key] || ""}
                    onChange={(e) =>
                      setSettings({ ...settings, webhookUrls: { ...settings.webhookUrls, [field.key]: e.target.value } })
                    }
                    placeholder="https://discord.com/api/webhooks/..."
                    className="mt-1 bg-[#0a0a0a] border-[#1e1e1e] text-white"
                  />
                  <p className="text-gray-600 text-[11px] mt-1">
                    Falls back to <code className="bg-white/5 px-1 rounded">{field.env}</code>
                    {field.note ? ` — ${field.note}` : ""}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl px-4 py-3 space-y-2">
            <p className="text-gray-500 text-xs">
              <strong className="text-gray-400">Getting a URL:</strong> in Discord, open the target channel &rarr; Edit Channel &rarr;
              Integrations &rarr; Webhooks &rarr; New Webhook &rarr; Copy Webhook URL, then paste it above and Save. It looks like{" "}
              <code className="bg-white/5 px-1 rounded">https://discord.com/api/webhooks/…</code> and is a credential — anyone holding it
              can post to that channel.
            </p>
            <p className="text-gray-500 text-xs">
              To try one out, open the matching channel on the Messages tab and use <strong className="text-gray-400">Send test</strong> —
              it posts that channel&apos;s real message and reports what Discord answered.
            </p>
          </div>
        </div>
      )}

      {/* Bot Section */}
      {activeSection === "bot" && (
        <div className="space-y-4">
          <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[#1e1e1e]">
              <h3 className="font-[family-name:var(--font-oswald)] text-sm font-semibold text-white uppercase">Discord Bot</h3>
              <p className="text-gray-500 text-xs mt-0.5">Bot configuration and invite link</p>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <Label className="text-gray-400 text-sm">Bot Token (from Discord Developer Portal)</Label>
                <Input
                  value={settings.botSettings?.token || ""}
                  onChange={(e) => setSettings({ ...settings, botSettings: { ...settings.botSettings, token: e.target.value } })}
                  placeholder="MTU0MDExNDEzNTQ0NDg4OTcwMQ..."
                  type="password"
                  className="mt-1 bg-[#0a0a0a] border-[#1e1e1e] text-white"
                />
                <p className="text-gray-600 text-[11px] mt-1">
                  Used for every DM. Falls back to <code className="bg-white/5 px-1 rounded">DISCORD_BOT_TOKEN</code>.
                </p>
              </div>
              <div>
                <Label className="text-gray-400 text-sm">Bot Invite Link</Label>
                <Input
                  value={settings.botSettings?.inviteLink || "https://discord.com/oauth2/authorize?client_id=1540114135444889701&scope=bot&permissions=274877991936"}
                  onChange={(e) => setSettings({ ...settings, botSettings: { ...settings.botSettings, inviteLink: e.target.value } })}
                  className="mt-1 bg-[#0a0a0a] border-[#1e1e1e] text-white"
                />
              </div>
              <div>
                <Label className="text-gray-400 text-sm">State Discord Invite Link</Label>
                <Input
                  value={settings.botSettings?.stateInvite || ""}
                  onChange={(e) => setSettings({ ...settings, botSettings: { ...settings.botSettings, stateInvite: e.target.value } })}
                  placeholder="https://discord.gg/YOUR_INVITE"
                  className="mt-1 bg-[#0a0a0a] border-[#1e1e1e] text-white"
                />
                <p className="text-gray-600 text-[11px] mt-1">
                  Substituted for <code className="bg-white/5 px-1 rounded">{"{inviteLink}"}</code> in recruit, onboarding and FTP messages.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[#1e1e1e]">
              <h3 className="font-[family-name:var(--font-oswald)] text-sm font-semibold text-white uppercase">Bot Status</h3>
            </div>
            <div className="p-4">
              <p className="text-gray-400 text-sm">
                Bot ID: <code className="bg-white/10 px-1 rounded">1540114135444889701</code>
              </p>
              <p className="text-gray-400 text-sm mt-2">
                Username: <code className="bg-white/10 px-1 rounded">LSMD Roster</code>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Delivery log */}
      {activeSection === "log" && (
        <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[#1e1e1e] flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h3 className="font-[family-name:var(--font-oswald)] text-sm font-semibold text-white uppercase">Recent deliveries</h3>
              <p className="text-gray-500 text-xs mt-0.5">Last 50 notification attempts, newest first</p>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={failuresOnly}
                  onChange={(e) => {
                    setFailuresOnly(e.target.checked);
                    fetchDeliveries(e.target.checked);
                  }}
                  className="accent-[#dc2626]"
                />
                Failures only
              </label>
              <Button variant="outline" size="sm" onClick={() => fetchDeliveries()} disabled={loadingLog} className="border-[#1e1e1e] text-gray-400">
                <RefreshCw className={`w-4 h-4 mr-2 ${loadingLog ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </div>

          {deliveries.length === 0 ? (
            <p className="text-gray-500 text-sm px-4 py-8 text-center">
              {loadingLog ? "Loading…" : "Nothing logged yet. Every send from here on is recorded."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1e1e1e]">
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">When</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Event</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Channel</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Target</th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {deliveries.map((d) => (
                    <tr key={d.id} className="border-b border-[#1e1e1e]/50 align-top">
                      <td className="py-3 px-4 text-gray-500 text-xs whitespace-nowrap">
                        {new Date(d.createdAt).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-gray-300 text-xs font-[family-name:var(--font-mono)]">{d.event}</td>
                      <td className="py-3 px-4 text-gray-400 text-xs">{d.channel}</td>
                      <td className="py-3 px-4 text-gray-400 text-xs font-[family-name:var(--font-mono)] break-all">
                        {d.target || "—"}
                      </td>
                      <td className="py-3 px-4 text-xs">
                        {d.ok ? (
                          <span className="text-green-400">Sent</span>
                        ) : (
                          <span className="text-red-400">{d.error || `Failed (${d.status ?? "no response"})`}</span>
                        )}
                        <span className="block text-gray-600 mt-1 line-clamp-2 max-w-md">{d.preview}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
