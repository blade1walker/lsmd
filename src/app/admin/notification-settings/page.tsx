"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Save, RotateCcw } from "lucide-react";

interface Settings {
  recruitWebhook: boolean;
  recruitDM: boolean;
  onboardingWebhook: boolean;
  onboardingDM: boolean;
  ftpWebhook: boolean;
  ftpDM: boolean;
  loaWebhook: boolean;
  loaDM: boolean;
  testWebhook: boolean;
  testDM: boolean;
}

const DEFAULTS: Settings = {
  recruitWebhook: true,
  recruitDM: true,
  onboardingWebhook: false,
  onboardingDM: true,
  ftpWebhook: false,
  ftpDM: true,
  loaWebhook: true,
  loaDM: false,
  testWebhook: true,
  testDM: true,
};

export default function AdminNotificationSettingsPage() {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

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
      await fetch("/api/admin/notification-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error(err);
    }
    setSaving(false);
  };

  const handleReset = () => {
    setSettings(DEFAULTS);
  };

  const Toggle = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) => (
    <label className="flex items-center justify-between py-3 px-4 hover:bg-white/5 rounded-lg cursor-pointer">
      <span className="text-sm text-gray-300">{label}</span>
      <div
        onClick={() => onChange(!checked)}
        className={`w-11 h-6 rounded-full relative transition-colors cursor-pointer ${checked ? "bg-[#eab308]" : "bg-[#2a2a2a]"}`}
      >
        <div
          className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${checked ? "translate-x-5.5" : "translate-x-0.5"}`}
        />
      </div>
    </label>
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
            Enable or disable webhooks and DMs for each feature
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={handleReset} variant="outline" className="border-[#1e1e1e] text-gray-400">
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset
          </Button>
          <Button onClick={handleSave} disabled={saving} className="bg-[#eab308] text-black hover:bg-[#ca8a04]">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            {saved ? "Saved!" : "Save"}
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        {/* Recruit */}
        <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[#1e1e1e]">
            <h3 className="font-[family-name:var(--font-oswald)] text-sm font-semibold text-white uppercase">Recruit</h3>
            <p className="text-gray-500 text-xs mt-0.5">Approval and decline notifications</p>
          </div>
          <div className="divide-y divide-[#1e1e1e]/50">
            <Toggle label="Webhook (posts to recruitment channel)" checked={settings.recruitWebhook} onChange={(v) => setSettings({ ...settings, recruitWebhook: v })} />
            <Toggle label="DM (sends direct message to user)" checked={settings.recruitDM} onChange={(v) => setSettings({ ...settings, recruitDM: v })} />
          </div>
        </div>

        {/* Onboarding */}
        <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[#1e1e1e]">
            <h3 className="font-[family-name:var(--font-oswald)] text-sm font-semibold text-white uppercase">Onboarding</h3>
            <p className="text-gray-500 text-xs mt-0.5">New member enrollment notifications</p>
          </div>
          <div className="divide-y divide-[#1e1e1e]/50">
            <Toggle label="Webhook (posts to enrollment channel)" checked={settings.onboardingWebhook} onChange={(v) => setSettings({ ...settings, onboardingWebhook: v })} />
            <Toggle label="DM (sends welcome message to new member)" checked={settings.onboardingDM} onChange={(v) => setSettings({ ...settings, onboardingDM: v })} />
          </div>
        </div>

        {/* FTP */}
        <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[#1e1e1e]">
            <h3 className="font-[family-name:var(--font-oswald)] text-sm font-semibold text-white uppercase">FTP</h3>
            <p className="text-gray-500 text-xs mt-0.5">Field Training Program notifications</p>
          </div>
          <div className="divide-y divide-[#1e1e1e]/50">
            <Toggle label="Webhook (posts to FTP channel)" checked={settings.ftpWebhook} onChange={(v) => setSettings({ ...settings, ftpWebhook: v })} />
            <Toggle label="DM (sends result to applicant)" checked={settings.ftpDM} onChange={(v) => setSettings({ ...settings, ftpDM: v })} />
          </div>
        </div>

        {/* LOA */}
        <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[#1e1e1e]">
            <h3 className="font-[family-name:var(--font-oswald)] text-sm font-semibold text-white uppercase">LOA</h3>
            <p className="text-gray-500 text-xs mt-0.5">Leave of Absence notifications</p>
          </div>
          <div className="divide-y divide-[#1e1e1e]/50">
            <Toggle label="Webhook (posts LOA status to channel)" checked={settings.loaWebhook} onChange={(v) => setSettings({ ...settings, loaWebhook: v })} />
            <Toggle label="DM (sends result to member)" checked={settings.loaDM} onChange={(v) => setSettings({ ...settings, loaDM: v })} />
          </div>
        </div>

        {/* Test */}
        <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[#1e1e1e]">
            <h3 className="font-[family-name:var(--font-oswald)] text-sm font-semibold text-white uppercase">Test</h3>
            <p className="text-gray-500 text-xs mt-0.5">Test notifications from recruit page</p>
          </div>
          <div className="divide-y divide-[#1e1e1e]/50">
            <Toggle label="Webhook (test webhook posting)" checked={settings.testWebhook} onChange={(v) => setSettings({ ...settings, testWebhook: v })} />
            <Toggle label="DM (test direct message)" checked={settings.testDM} onChange={(v) => setSettings({ ...settings, testDM: v })} />
          </div>
        </div>
      </div>
    </div>
  );
}
