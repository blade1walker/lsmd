"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save, RotateCcw, ChevronDown, ChevronUp, MessageSquare, Webhook, Bot, Settings } from "lucide-react";
import * as XLSX from "xlsx";
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
  onboardingDMApprove: "Congratulations, {name}! 🎉\n\nYou have been accepted into the Emergency Medical Services!\n\n**Your Details:**\n• Rank: {rank}\n• Call Sign: {callSign}\n• State ID: {stateId}\n\nJoin our state Discord server to get started:\n{inviteLink}\n\nWelcome aboard! 🚑🚀",
  onboardingDMDecline: "Dear {name},\n\nWe regret to inform you that your application has been **Declined**.\n\nIf you have questions, please contact HR.",
  ftpWebhook: false,
  ftpDM: true,
  ftpDMApprove: "Congratulations, {name}! 🎉\n\nYour Field Training Program (FTP) application has been **Accepted**! You have been assigned the FTP role and a trainer will reach out to you shortly.\n\nJoin our state Discord server:\n{inviteLink}",
  ftpDMDecline: "Dear {name},\n\nWe regret to inform you that your FTP application has been **Declined**.\n\nIf you have questions, please contact HR.",
  ftpWebhookApprove: "🎓 {name} ({callSign}) has enrolled in the Field Training Program!",
  loaWebhook: true,
  loaDM: false,
  loaWebhookApprove: "LOA Approved for {name}",
  loaWebhookDecline: "LOA Declined for {name}",
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

const VARIABLES_HELP: Record<string, string[]> = {
  recruit: ["<@ID>", "{name}", "{inviteLink}"],
  onboarding: ["{name}", "{rank}", "{callSign}", "{stateId}", "{inviteLink}"],
  ftp: ["{name}", "{inviteLink}", "{callSign}"],
  loa: ["{name}", "{startDate}", "{endDate}", "{reason}"],
  promotion: ["{name}", "{callSign}", "{fromRank}", "{toRank}", "<@{discordId}>"],
};

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

  useEffect(() => {
    fetchSettings();
  }, []);

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

  const Toggle = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) => (
    <label className="flex items-center justify-between py-3 px-4 hover:bg-white/5 rounded-lg cursor-pointer">
      <span className="text-sm text-gray-300">{label}</span>
      <div
        onClick={() => onChange(!checked)}
        className={`w-11 h-6 rounded-full relative transition-colors cursor-pointer ${checked ? "bg-[#dc2626]" : "bg-[#2a2a2a]"}`}
      >
        <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${checked ? "translate-x-5.5" : "translate-x-0.5"}`} />
      </div>
    </label>
  );

  const MessageField = ({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) => (
    <div className="px-4 pb-3">
      <label className="text-gray-500 text-xs mb-1 block">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        placeholder={placeholder}
        className="w-full bg-[#0a0a0a] border border-[#1e1e1e] rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#dc2626] resize-none"
      />
    </div>
  );

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
          {/* Recruit */}
          <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[#1e1e1e] flex items-center justify-between cursor-pointer hover:bg-white/5" onClick={() => setExpanded(expanded === "recruit" ? null : "recruit")}>
              <div>
                <h3 className="font-[family-name:var(--font-oswald)] text-sm font-semibold text-white uppercase">Recruit</h3>
                <p className="text-gray-500 text-xs mt-0.5">Approval and decline notifications</p>
              </div>
              {expanded === "recruit" ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
            </div>
            <div className="divide-y divide-[#1e1e1e]/50">
              <Toggle label="Webhook" checked={settings.recruitWebhook} onChange={(v) => setSettings({ ...settings, recruitWebhook: v })} />
              <Toggle label="Direct Message" checked={settings.recruitDM} onChange={(v) => setSettings({ ...settings, recruitDM: v })} />
            </div>
            {expanded === "recruit" && (
              <div className="border-t border-[#1e1e1e] p-4 space-y-4">
                <p className="text-gray-500 text-xs"><strong>Variables:</strong> {"{discordId}"} = mention user, {"{name}"} = character name, {"{inviteLink}"} = server invite</p>
                <MessageField label="Webhook - Approved" value={settings.recruitWebhookApprove} onChange={(v) => setSettings({ ...settings, recruitWebhookApprove: v })} />
                <MessageField label="Webhook - Declined" value={settings.recruitWebhookDecline} onChange={(v) => setSettings({ ...settings, recruitWebhookDecline: v })} />
                <MessageField label="DM - Approved" value={settings.recruitDMApprove} onChange={(v) => setSettings({ ...settings, recruitDMApprove: v })} />
                <MessageField label="DM - Declined" value={settings.recruitDMDecline} onChange={(v) => setSettings({ ...settings, recruitDMDecline: v })} />
              </div>
            )}
          </div>

          {/* Onboarding */}
          <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[#1e1e1e] flex items-center justify-between cursor-pointer hover:bg-white/5" onClick={() => setExpanded(expanded === "onboarding" ? null : "onboarding")}>
              <div>
                <h3 className="font-[family-name:var(--font-oswald)] text-sm font-semibold text-white uppercase">Onboarding</h3>
                <p className="text-gray-500 text-xs mt-0.5">New member enrollment notifications</p>
              </div>
              {expanded === "onboarding" ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
            </div>
            <div className="divide-y divide-[#1e1e1e]/50">
              <Toggle label="Webhook" checked={settings.onboardingWebhook} onChange={(v) => setSettings({ ...settings, onboardingWebhook: v })} />
              <Toggle label="Direct Message" checked={settings.onboardingDM} onChange={(v) => setSettings({ ...settings, onboardingDM: v })} />
            </div>
            {expanded === "onboarding" && (
              <div className="border-t border-[#1e1e1e] p-4 space-y-4">
                <p className="text-gray-500 text-xs"><strong>Variables:</strong> {"{name}"} {"{rank}"} {"{callSign}"} {"{stateId}"} {"{inviteLink}"}</p>
                <MessageField label="DM - Approved" value={settings.onboardingDMApprove} onChange={(v) => setSettings({ ...settings, onboardingDMApprove: v })} />
                <MessageField label="DM - Declined" value={settings.onboardingDMDecline} onChange={(v) => setSettings({ ...settings, onboardingDMDecline: v })} />
              </div>
            )}
          </div>

          {/* FTP */}
          <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[#1e1e1e] flex items-center justify-between cursor-pointer hover:bg-white/5" onClick={() => setExpanded(expanded === "ftp" ? null : "ftp")}>
              <div>
                <h3 className="font-[family-name:var(--font-oswald)] text-sm font-semibold text-white uppercase">FTP</h3>
                <p className="text-gray-500 text-xs mt-0.5">Field Training Program notifications</p>
              </div>
              {expanded === "ftp" ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
            </div>
            <div className="divide-y divide-[#1e1e1e]/50">
              <Toggle label="Webhook" checked={settings.ftpWebhook} onChange={(v) => setSettings({ ...settings, ftpWebhook: v })} />
              <Toggle label="Direct Message" checked={settings.ftpDM} onChange={(v) => setSettings({ ...settings, ftpDM: v })} />
            </div>
            {expanded === "ftp" && (
              <div className="border-t border-[#1e1e1e] p-4 space-y-4">
                <p className="text-gray-500 text-xs"><strong>Variables:</strong> {"{name}"} {"{inviteLink}"} {"{callSign}"} (webhook only)</p>
                <MessageField label="Webhook - Enrolled" value={settings.ftpWebhookApprove} onChange={(v) => setSettings({ ...settings, ftpWebhookApprove: v })} />
                <MessageField label="DM - Approved" value={settings.ftpDMApprove} onChange={(v) => setSettings({ ...settings, ftpDMApprove: v })} />
                <MessageField label="DM - Declined" value={settings.ftpDMDecline} onChange={(v) => setSettings({ ...settings, ftpDMDecline: v })} />
              </div>
            )}
          </div>

          {/* LOA */}
          <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[#1e1e1e] flex items-center justify-between cursor-pointer hover:bg-white/5" onClick={() => setExpanded(expanded === "loa" ? null : "loa")}>
              <div>
                <h3 className="font-[family-name:var(--font-oswald)] text-sm font-semibold text-white uppercase">LOA</h3>
                <p className="text-gray-500 text-xs mt-0.5">Leave of Absence notifications</p>
              </div>
              {expanded === "loa" ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
            </div>
            <div className="divide-y divide-[#1e1e1e]/50">
              <Toggle label="Webhook" checked={settings.loaWebhook} onChange={(v) => setSettings({ ...settings, loaWebhook: v })} />
              <Toggle label="Direct Message" checked={settings.loaDM} onChange={(v) => setSettings({ ...settings, loaDM: v })} />
            </div>
            {expanded === "loa" && (
              <div className="border-t border-[#1e1e1e] p-4 space-y-4">
                <p className="text-gray-500 text-xs"><strong>Variables:</strong> {"{name}"} {"{startDate}"} {"{endDate}"} {"{reason}"}</p>
                <MessageField label="Webhook - Approved" value={settings.loaWebhookApprove} onChange={(v) => setSettings({ ...settings, loaWebhookApprove: v })} />
                <MessageField label="Webhook - Declined" value={settings.loaWebhookDecline} onChange={(v) => setSettings({ ...settings, loaWebhookDecline: v })} />
                <MessageField label="DM - Approved" value={settings.loaDMApprove} onChange={(v) => setSettings({ ...settings, loaDMApprove: v })} />
                <MessageField label="DM - Declined" value={settings.loaDMDecline} onChange={(v) => setSettings({ ...settings, loaDMDecline: v })} />
              </div>
            )}
          </div>

          {/* Promotion */}
          <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[#1e1e1e] flex items-center justify-between cursor-pointer hover:bg-white/5" onClick={() => setExpanded(expanded === "promotion" ? null : "promotion")}>
              <div>
                <h3 className="font-[family-name:var(--font-oswald)] text-sm font-semibold text-white uppercase">Promotion</h3>
                <p className="text-gray-500 text-xs mt-0.5">Posted to the channel whenever a member's rank increases</p>
              </div>
              {expanded === "promotion" ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
            </div>
            <div className="divide-y divide-[#1e1e1e]/50">
              <Toggle label="Webhook" checked={settings.promotionWebhook} onChange={(v) => setSettings({ ...settings, promotionWebhook: v })} />
            </div>
            {expanded === "promotion" && (
              <div className="border-t border-[#1e1e1e] p-4 space-y-4">
                <p className="text-gray-500 text-xs">
                  <strong>Variables:</strong> {"{name}"} {"{callSign}"} {"{fromRank}"} {"{toRank}"} {"<@{discordId}>"} (tags the member — blank if they have no linked Discord account)
                </p>
                <MessageField label="Webhook - Promoted" value={settings.promotionWebhookMessage} onChange={(v) => setSettings({ ...settings, promotionWebhookMessage: v })} />
              </div>
            )}
          </div>

          {/* Call Sign */}
          <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[#1e1e1e] flex items-center justify-between cursor-pointer hover:bg-white/5" onClick={() => setExpanded(expanded === "callsign" ? null : "callsign")}>
              <div>
                <h3 className="font-[family-name:var(--font-oswald)] text-sm font-semibold text-white uppercase">Call Sign</h3>
                <p className="text-gray-500 text-xs mt-0.5">Posted to the channel whenever a member's call sign is changed outside of a promotion</p>
              </div>
              {expanded === "callsign" ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
            </div>
            <div className="divide-y divide-[#1e1e1e]/50">
              <Toggle label="Webhook" checked={settings.callsignWebhook} onChange={(v) => setSettings({ ...settings, callsignWebhook: v })} />
            </div>
            {expanded === "callsign" && (
              <div className="border-t border-[#1e1e1e] p-4 space-y-4">
                <p className="text-gray-500 text-xs">
                  <strong>Variables:</strong> {"{name}"} {"{oldCallSign}"} {"{newCallSign}"} {"<@{discordId}>"} (tags the member — blank if they have no linked Discord account)
                </p>
                <MessageField label="Webhook - Call Sign Updated" value={settings.callsignWebhookMessage} onChange={(v) => setSettings({ ...settings, callsignWebhookMessage: v })} />
              </div>
            )}
          </div>

          {/* Test */}
          <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[#1e1e1e]">
              <h3 className="font-[family-name:var(--font-oswald)] text-sm font-semibold text-white uppercase">Test</h3>
              <p className="text-gray-500 text-xs mt-0.5">Test notifications from recruit page</p>
            </div>
            <div className="divide-y divide-[#1e1e1e]/50">
              <Toggle label="Webhook" checked={settings.testWebhook} onChange={(v) => setSettings({ ...settings, testWebhook: v })} />
              <Toggle label="Direct Message" checked={settings.testDM} onChange={(v) => setSettings({ ...settings, testDM: v })} />
            </div>
          </div>
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
