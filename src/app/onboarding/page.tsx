"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle, UserPlus } from "lucide-react";

export default function OnboardingPage() {
  const [name, setName] = useState("");
  const [discordId, setDiscordId] = useState("");
  const [stateId, setStateId] = useState("");
  const [steamId, setSteamId] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!name || !discordId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, discordId, stateId, steamId, reason }),
      });
      if (res.ok) setSubmitted(true);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h1 className="font-[family-name:var(--font-oswald)] text-2xl font-bold text-white mb-2">
            Application Submitted
          </h1>
          <p className="text-gray-400 mb-6">
            Your onboarding request has been submitted. An admin will review and assign your rank.
          </p>
          <Link href="/">
            <Button variant="outline" className="border-[#1e1e1e] text-gray-400">
              Back to Roster
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <header className="border-b border-[#1e1e1e]">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="text-sm text-gray-400 hover:text-white">
            ← Back to Roster
          </Link>
          <span className="font-[family-name:var(--font-oswald)] text-white font-semibold text-sm">
            LSMD
          </span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-12">
        <div className="flex items-center gap-2 mb-2">
          <UserPlus className="w-5 h-5 text-[#eab308]" />
          <h1 className="font-[family-name:var(--font-oswald)] text-2xl font-bold text-white uppercase">
            Join LSMD
          </h1>
        </div>
        <p className="text-gray-500 text-sm mb-8">
          Fill in your details to apply for the Los Santos Medical Department. An admin will review and assign your rank.
        </p>

        <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl p-6 space-y-4">
          <div>
            <Label className="text-gray-400 text-sm">Character Name *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your character name"
              className="mt-1 bg-[#0a0a0a] border-[#1e1e1e]"
            />
          </div>

          <div>
            <Label className="text-gray-400 text-sm">Discord ID *</Label>
            <Input
              value={discordId}
              onChange={(e) => setDiscordId(e.target.value)}
              placeholder="Your Discord user ID"
              className="mt-1 bg-[#0a0a0a] border-[#1e1e1e]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-gray-400 text-sm">State ID</Label>
              <Input
                value={stateId}
                onChange={(e) => setStateId(e.target.value)}
                placeholder="If known"
                className="mt-1 bg-[#0a0a0a] border-[#1e1e1e]"
              />
            </div>
            <div>
              <Label className="text-gray-400 text-sm">Steam ID</Label>
              <Input
                value={steamId}
                onChange={(e) => setSteamId(e.target.value)}
                placeholder="If known"
                className="mt-1 bg-[#0a0a0a] border-[#1e1e1e]"
              />
            </div>
          </div>

          <div>
            <Label className="text-gray-400 text-sm">Why do you want to join LSMD?</Label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Tell us about yourself..."
              rows={3}
              className="mt-1 w-full bg-[#0a0a0a] border border-[#1e1e1e] rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#eab308] resize-none"
            />
          </div>

          <div className="pt-4">
            <Button
              onClick={handleSubmit}
              disabled={loading || !name || !discordId}
              className="w-full bg-[#eab308] text-black hover:bg-[#ca8a04]"
            >
              {loading ? "Submitting..." : "Submit Application"}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
