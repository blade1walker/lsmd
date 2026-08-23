"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle, GraduationCap } from "lucide-react";

const DEPARTMENTS = [
  "EMS",
];

export default function FTPPage() {
  const [characterName, setCharacterName] = useState("");
  const [discordId, setDiscordId] = useState("");
  const [currentRole, setCurrentRole] = useState("");
  const [previousExperience, setPreviousExperience] = useState("");
  const [department, setDepartment] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!characterName || !discordId || !currentRole || !department) return;
    setLoading(true);
    try {
      const res = await fetch("/api/ftp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterName, discordId, currentRole, previousExperience, department }),
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
            Your FTP request has been submitted. HR will review and assign your trainer.
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
            EMS
          </span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-12">
        <div className="flex items-center gap-2 mb-2">
          <GraduationCap className="w-5 h-5 text-[#eab308]" />
          <h1 className="font-[family-name:var(--font-oswald)] text-2xl font-bold text-white uppercase">
            Field Training Program
          </h1>
        </div>
        <p className="text-gray-500 text-sm mb-8">
          Apply for the Field Training Program to become a certified trainer. Fill in your details below.
        </p>

        <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl p-6 space-y-4">
          <div>
            <Label className="text-gray-400 text-sm">Character Name *</Label>
            <Input
              value={characterName}
              onChange={(e) => setCharacterName(e.target.value)}
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

          <div>
            <Label className="text-gray-400 text-sm">Current Role *</Label>
            <Input
              value={currentRole}
              onChange={(e) => setCurrentRole(e.target.value)}
              placeholder="e.g., EMT, Paramedic, etc."
              className="mt-1 bg-[#0a0a0a] border-[#1e1e1e]"
            />
          </div>

          <div>
            <Label className="text-gray-400 text-sm">Previous FTP Experience</Label>
            <textarea
              value={previousExperience}
              onChange={(e) => setPreviousExperience(e.target.value)}
              placeholder="Describe any previous training experience..."
              rows={3}
              className="mt-1 w-full bg-[#0a0a0a] border border-[#1e1e1e] rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#eab308] resize-none"
            />
          </div>

          <div>
            <Label className="text-gray-400 text-sm">Department *</Label>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="mt-1 w-full bg-[#0a0a0a] border border-[#1e1e1e] rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#eab308]"
            >
              <option value="">Select department</option>
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <div className="pt-4">
            <Button
              onClick={handleSubmit}
              disabled={loading || !characterName || !discordId || !currentRole || !department}
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
