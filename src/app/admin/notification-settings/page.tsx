"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save, RotateCcw, ChevronDown, ChevronUp, MessageSquare, Webhook, Bot } from "lucide-react";
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
  loaWebhook: boolean;
  loaDM: boolean;
  loaWebhookApprove: string;
  loaWebhookDecline: string;
  loaDMApprove: string;
  loaDMDecline: string;
  promotionWebhook: boolean;
  promotionWebhookMessage: string;
  callsignWebhook: boolean;
  callsignWebhookMessage: string;
  testWebhook: boolean;
  testDM: boolean;
  webhookUrls: { recruit?: string; onboarding?: string; ftp?: string; loa?: string; accept?: string } | null;
  botSettings: { token?: string; inviteLink?: string; stateInvite?: string } | null;
}

const DEFAULTS: Settings = {
  recruitWebhook: true,
  recruitDM: true,
  recruitWebhookApprove: "Congratulations! Your EMS application has been Accepted, <@{discordId}> For further details, please check your DMs",
  recruitWebhookDecline: "Unfortunately, your EMS application has been Declined, <@{discordId}> For further details, please check your DMs",
  recruitDMApprove: "Congratulations, {name}! 🎉\n\nYour recruitment application has been **Accepted**!\n\nJoin our state Discord server to get started:\n{inviteLink}\n\nWelcome aboard! 🚑🚀",
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
  loaWebhook: true,
  loaDM: false,
  loaWebhookApprove: "<@{discordId}> **{name}** has been granted a Leave of Absence.",
  loaWebhookDecline: "<@{discordId}> **{name}**'s Leave of Absence request has been declined.",
  loaDMApprove: "Your Leave of Absence has been **Approved**.\n\nStart: {startDate}\nEnd: {endDate}\nReason: {reason}",
  loaDMDecline: "Your Leave of Absence request has been **Declined**.\n\nIf you have questions, please contact HR.",
  promotionWebhook: true,
  promotionWebhookMessage: "🎉 Congratulations <@{discordId}>! {name} ({callSign}) has been promoted from **{fromRank}** to **{toRank}**!",
  callsignWebhook: true,
  callsignWebhookMessage: "📻 <@{discordId}>'s call sign has been updated: **{oldCallSign}** → **{newCallSign}**",
  testWebhook: true,
  testDM: true,
  webhookUrls: null,
  botSettings: null,
};

type BooleanKey = { [K in keyof Settings]: Settings[K] extends boolean ? K : never }[keyof Settings];
type StringKey = { [K in keyof Settings]: Settings[K] extends string ? K : never }[keyof Settings];

interface ChannelDef {
  id: string;
  label: string;
  hint: string;
  toggleKey: BooleanKey;
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
        variables: ["<@{discordId}>", "{name}", "{inviteLink}"],
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
        variables: ["{name}", "{inviteLink}"],
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
        variables: ["<@{discordId}>", "{name}", "{rank}", "{callSign}", "{stateId}"],
        fields: [{ key: "onboardingWebhookMessage", label: "Enrolled" }],
      },
      {
        id: "dm",
        label: "Direct Message",
        hint: "Sent privately to the new member by the bot",
        toggleKey: "onboardingDM",
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
        variables: ["{name}", "{callSign}"],
        fields: [{ key: "ftpWebhookApprove", label: "Enrolled" }],
      },
      {
        id: "dm",
        label: "Direct Message",
        hint: "Sent privately to the trainee by the bot",
        toggleKey: "ftpDM",
        variables: ["{name}", "{inviteLink}"],
        fields: [
          { key: "ftpDMApprove", label: "Approved" },
          { key: "ftpDMDecline", label: "Declined" },
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
        variables: ["{name}", "{rank}", "{callSign}", "{startDate}", "{endDate}", "{reason}"],
        fields: [
          { key: "loaDMApprove", label: "Approved" },
          { key: "loaDMDecline", label: "Declined" },
        ],
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
        variables: ["<@{discordId}>", "{name}", "{callSign}", "{fromRank}", "{toRank}"],
        fields: [{ key: "promotionWebhookMessage", label: "Promoted" }],
      },
    ],
  },
  {
    id: "callsign",
    title: "Call Sign",
    description: "Posted to the channel whenever a member's call sign is changed outside of a promotion",
    channels: [
      {
        id: "webhook",
        label: "Webhook",
        hint: "Posted publicly in the call sign channel",
        toggleKey: "callsignWebhook",
        variables: ["<@{discordId}>", "{name}", "{oldCallSign}", "{newCallSign}"],
        fields: [{ key: "callsignWebhookMessage", label: "Call Sign Updated" }],
      },
    ],
  },
  {
    id: "test",
    title: "Test",
    description: "Test notifications from recruit page",
    channels: [
      { id: "webhook", label: "Webhook", hint: "", toggleKey: "testWebhook", variables: [], fields: [] },
      { id: "dm", label: "Direct Message", hint: "", toggleKey: "testDM", variables: [], fields: [] },
    ],
  },
];

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
  onChange,
}: {
  label: string;
  value: string;
  defaultValue: string;
  onChange: (v: string) => void;
}) {
  const isDefault = value === defaultValue;
  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-1">
        <label className="text-gray-400 text-xs font-medium">{label}</label>
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
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        placeholder={defaultValue}
        className="w-full bg-[#0a0a0a] border border-[#1e1e1e] rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#dc2626] resize-y"
      />
    </div>
  );
}

function ChannelSection({
  channel,
  settings,
  onChange,
  open,
  onToggleOpen,
}: {
  channel: ChannelDef;
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  open: boolean;
  onToggleOpen: () => void;
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
              onChange={(v) => onChange({ [f.key]: v } as Partial<Settings>)}
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
  const [activeSection, setActiveSection] = useState<"messages" | "webhooks" | "bot">("messages");
  const [testTarget, setTestTarget] = useState({ discordId: "", characterName: "" });
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState("");
  const [testType, setTestType] = useState<"dm" | "webhook">("dm");

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/admin/notification-settings");
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

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

  const handleTestSend = async () => {
    if (!testTarget.discordId) {
      alert("Enter a Discord ID to test");
      return;
    }
    setTestSending(true);
    setTestResult("");
    try {
      const res = await fetch("/api/recruit/test-webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          discordId: testTarget.discordId,
          characterName: testTarget.characterName,
          message: "",
          type: testType,
        }),
      });
      const data = await res.json();
      setTestResult(res.ok ? `${testType === "dm" ? "DM" : "Webhook"} sent successfully!` : `Failed: ${data.error || "Unknown error"}`);
    } catch (err) {
      setTestResult("Failed to send test");
    }
    setTestSending(false);
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <Loader2 className="w-8 h-8 text-gray-500 animate-spin mx-auto" />
      </div>
    );
  }

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
        <button
          onClick={() => setActiveSection("messages")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
            activeSection === "messages" ? "bg-[#dc2626] text-black" : "text-gray-400 hover:text-white"
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          Messages
        </button>
        <button
          onClick={() => setActiveSection("webhooks")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
            activeSection === "webhooks" ? "bg-[#dc2626] text-black" : "text-gray-400 hover:text-white"
          }`}
        >
          <Webhook className="w-4 h-4" />
          Webhooks
        </button>
        <button
          onClick={() => setActiveSection("bot")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
            activeSection === "bot" ? "bg-[#dc2626] text-black" : "text-gray-400 hover:text-white"
          }`}
        >
          <Bot className="w-4 h-4" />
          Bot
        </button>
      </div>

      {/* Messages Section */}
      {activeSection === "messages" && (
        <div className="space-y-4">
          <p className="text-gray-500 text-xs">
            Every notification type lists its channels separately — open one to edit the exact message that channel
            sends, or restore the default wording.
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
              <p className="text-gray-500 text-xs mt-0.5">Configure webhook endpoints for each feature</p>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <Label className="text-gray-400 text-sm">Recruit Webhook (Accept/Decline)</Label>
                <Input
                  value={settings.webhookUrls?.recruit || ""}
                  onChange={(e) => setSettings({ ...settings, webhookUrls: { ...settings.webhookUrls, recruit: e.target.value } })}
                  placeholder="https://discord.com/api/webhooks/..."
                  className="mt-1 bg-[#0a0a0a] border-[#1e1e1e] text-white"
                />
              </div>
              <div>
                <Label className="text-gray-400 text-sm">Onboarding Webhook (Enrollment)</Label>
                <Input
                  value={settings.webhookUrls?.onboarding || ""}
                  onChange={(e) => setSettings({ ...settings, webhookUrls: { ...settings.webhookUrls, onboarding: e.target.value } })}
                  placeholder="https://discord.com/api/webhooks/..."
                  className="mt-1 bg-[#0a0a0a] border-[#1e1e1e] text-white"
                />
              </div>
              <div>
                <Label className="text-gray-400 text-sm">FTP Webhook</Label>
                <Input
                  value={settings.webhookUrls?.ftp || ""}
                  onChange={(e) => setSettings({ ...settings, webhookUrls: { ...settings.webhookUrls, ftp: e.target.value } })}
                  placeholder="https://discord.com/api/webhooks/..."
                  className="mt-1 bg-[#0a0a0a] border-[#1e1e1e] text-white"
                />
              </div>
              <div>
                <Label className="text-gray-400 text-sm">LOA Webhook</Label>
                <Input
                  value={settings.webhookUrls?.loa || ""}
                  onChange={(e) => setSettings({ ...settings, webhookUrls: { ...settings.webhookUrls, loa: e.target.value } })}
                  placeholder="https://discord.com/api/webhooks/..."
                  className="mt-1 bg-[#0a0a0a] border-[#1e1e1e] text-white"
                />
              </div>
            </div>
          </div>

          {/* Test Section */}
          <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[#1e1e1e]">
              <h3 className="font-[family-name:var(--font-oswald)] text-sm font-semibold text-white uppercase">Test Webhook</h3>
              <p className="text-gray-500 text-xs mt-0.5">Send test messages to verify webhooks work</p>
            </div>
            <div className="p-4 space-y-4">
              <div className="flex gap-2">
                <Button size="sm" onClick={() => setTestType("dm")} className={testType === "dm" ? "bg-[#dc2626] text-black" : "bg-[#1a1a1a] text-gray-400"}>Direct Message</Button>
                <Button size="sm" onClick={() => setTestType("webhook")} className={testType === "webhook" ? "bg-[#dc2626] text-black" : "bg-[#1a1a1a] text-gray-400"}>Webhook</Button>
              </div>
              <div>
                <Label className="text-gray-400 text-sm">Discord ID</Label>
                <Input value={testTarget.discordId} onChange={(e) => setTestTarget({ ...testTarget, discordId: e.target.value })} placeholder="Your Discord ID" className="mt-1 bg-[#0a0a0a] border-[#1e1e1e] text-white" />
              </div>
              {testResult && (
                <div className={`p-3 rounded text-sm ${testResult.includes("success") ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
                  {testResult}
                </div>
              )}
              <Button onClick={handleTestSend} disabled={testSending || !testTarget.discordId} className="bg-[#dc2626] text-black hover:bg-[#b91c1c]">
                {testSending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Send Test
              </Button>
            </div>
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
    </div>
  );
}
