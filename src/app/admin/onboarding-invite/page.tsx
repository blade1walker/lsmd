"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, CheckCircle, Send, Loader2 } from "lucide-react";

const DEFAULT_MESSAGE = `Hello and welcome to the team! :tada:

For your onboarding, please join our Discord:

Once you have joined, please submit your EMS Role Request by following the instructions in the Role Request section.

After submitting your request, please tag @@ben_huntand @@azim3872 so we can review and process it.

We are excited to have you on the team. Welcome aboard! :ambulance::rocket:`;

export default function OnboardingInvitePage() {
  const [discordId, setDiscordId] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const personalizedMessage = () => {
    let msg = message;
    if (discordId) {
      msg = `<@${discordId}>\n\n${msg}`;
    }
    return msg;
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(personalizedMessage());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendDM = async () => {
    if (!discordId) return;
    setSending(true);
    setError("");
    setSent(false);
    try {
      const res = await fetch("/api/discord/dm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discordId, message }),
      });
      if (res.ok) {
        setSent(true);
      } else {
        const data = await res.json();
        setError(data.detail || data.error || "Failed to send");
      }
    } catch (err) {
      setError("Network error");
    }
    setSending(false);
  };

  const handleReset = () => {
    setMessage(DEFAULT_MESSAGE);
    setDiscordId("");
    setName("");
    setSent(false);
    setError("");
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-[family-name:var(--font-oswald)] text-2xl font-bold text-white uppercase">
          EMS Onboarding Invite
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Generate a personalized invitation message for new members
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Form */}
        <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl p-6 space-y-4">
          <h2 className="font-[family-name:var(--font-oswald)] text-lg font-semibold text-white mb-4">
            Member Details
          </h2>

          <div>
            <Label className="text-gray-400 text-sm">Character Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter character name"
              className="mt-1 bg-[#0a0a0a] border-[#1e1e1e]"
            />
          </div>

          <div>
            <Label className="text-gray-400 text-sm">Discord ID *</Label>
            <Input
              value={discordId}
              onChange={(e) => setDiscordId(e.target.value)}
              placeholder="Enter Discord user ID"
              className="mt-1 bg-[#0a0a0a] border-[#1e1e1e]"
            />
          </div>

          <div>
            <Label className="text-gray-400 text-sm">Invitation Message</Label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={12}
              className="mt-1 w-full bg-[#0a0a0a] border border-[#1e1e1e] rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#eab308] resize-none"
            />
          </div>

          {error && (
            <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-md p-2">
              {error}
            </div>
          )}

          {sent && (
            <div className="text-green-400 text-sm bg-green-500/10 border border-green-500/20 rounded-md p-2 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Message sent successfully via DM!
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              onClick={handleSendDM}
              disabled={!discordId || sending}
              className="flex-1 bg-[#5865f2] text-white hover:bg-[#4752c4] disabled:opacity-50"
            >
              {sending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send DM
                </>
              )}
            </Button>
            <Button
              onClick={handleCopy}
              variant="outline"
              className="border-[#1e1e1e] text-gray-400"
            >
              {copied ? (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-2" />
                  Copy
                </>
              )}
            </Button>
            <Button
              onClick={handleReset}
              variant="outline"
              className="border-[#1e1e1e] text-gray-400"
            >
              Reset
            </Button>
          </div>
        </div>

        {/* Preview */}
        <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl p-6">
          <h2 className="font-[family-name:var(--font-oswald)] text-lg font-semibold text-white mb-4">
            Preview
          </h2>

          <div className="bg-[#2b2d31] rounded-lg p-4 whitespace-pre-wrap">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-[#5865f2] flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                EH
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-white font-semibold text-sm">
                    Nexus EMS HR
                  </span>
                  <span className="bg-[#5865f2] text-white text-xs px-1.5 py-0.5 rounded font-medium">
                    BOT
                  </span>
                  <span className="text-gray-400 text-xs">Today at {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                <div className="text-gray-100 text-sm leading-relaxed">
                  {discordId && (
                    <span className="text-[#00aff4] font-medium">@{name || "User"}</span>
                  )}
                  {discordId && "\n\n"}
                  {message.split("\n").map((line, i) => (
                    <span key={i}>
                      {line}
                      {i < message.split("\n").length - 1 && <br />}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 p-3 bg-[#0a0a0a] rounded-lg border border-[#1e1e1e]">
            <p className="text-gray-500 text-xs">
              Click <strong>Send DM</strong> to send the invitation directly to the member via Discord DM. Or use <strong>Copy</strong> to paste it manually.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
