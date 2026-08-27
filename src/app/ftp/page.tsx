"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession, signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { CheckCircle, GraduationCap, AlertTriangle } from "lucide-react";
import { fetchJson, errorMessage } from "@/lib/fetch-json";
import { FTP_MIN_RANK, isRankAtLeast } from "@/lib/constants";

function Shell({ children }: { children: React.ReactNode }) {
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
      <main className="max-w-2xl mx-auto px-4 py-12">{children}</main>
    </div>
  );
}

export default function FTPPage() {
  const { data: session, status } = useSession();
  const [previousExperience, setPreviousExperience] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      await fetchJson("/api/ftp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ previousExperience }),
      });
      setSubmitted(true);
    } catch (err) {
      setError(errorMessage(err));
    }
    setLoading(false);
  };

  if (status === "loading") {
    return <div className="min-h-screen bg-[#0a0a0a]" />;
  }

  if (!session) {
    return (
      <Shell>
        <div className="text-center py-16">
          <GraduationCap className="w-12 h-12 text-[#dc2626] mx-auto mb-4" />
          <h1 className="font-[family-name:var(--font-oswald)] text-2xl font-bold text-white mb-2 uppercase">
            Field Training Program
          </h1>
          <p className="text-gray-500 mb-6">
            Sign in with Discord to apply. Your rank is read from the roster.
          </p>
          <Button onClick={() => signIn("discord")} className="bg-[#5865F2] hover:bg-[#4752C4]">
            Sign in with Discord
          </Button>
        </div>
      </Shell>
    );
  }

  if (submitted) {
    return (
      <Shell>
        <div className="text-center py-16">
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
      </Shell>
    );
  }

  const rank = session.user.memberRank ?? null;
  // Mirrors the server rule so an ineligible member is told up front instead of
  // filling the form and being rejected. The API check is the one that counts.
  const eligible = isRankAtLeast(rank, FTP_MIN_RANK);

  return (
    <Shell>
      <div className="flex items-center gap-2 mb-2">
        <GraduationCap className="w-5 h-5 text-[#dc2626]" />
        <h1 className="font-[family-name:var(--font-oswald)] text-2xl font-bold text-white uppercase">
          Field Training Program
        </h1>
      </div>
      <p className="text-gray-500 text-sm mb-8">
        Open to {FTP_MIN_RANK} and above. Your name, rank and department are taken from your roster
        entry.
      </p>

      {!eligible && (
        <div className="mb-6 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-200 flex gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 text-yellow-400" />
          <span>
            {rank
              ? `The Field Training Program is open to ${FTP_MIN_RANK} and above. Your current rank is ${rank}.`
              : "Your Discord account is not linked to a roster member, so it has no rank."}
          </span>
        </div>
      )}

      {error && (
        <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300 flex gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 text-red-400" />
          <span className="break-words">{error}</span>
        </div>
      )}

      <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Applicant</span>
            <div className="text-white mt-0.5">{session.user.name ?? "—"}</div>
          </div>
          <div>
            <span className="text-gray-500">Rank</span>
            <div className={`mt-0.5 ${eligible ? "text-white" : "text-yellow-300"}`}>
              {rank ?? "No roster entry"}
            </div>
          </div>
        </div>

        <div>
          <Label className="text-gray-400 text-sm">Previous FTP Experience</Label>
          <textarea
            value={previousExperience}
            onChange={(e) => setPreviousExperience(e.target.value)}
            placeholder="Describe any previous training experience..."
            rows={4}
            disabled={!eligible}
            className="mt-1 w-full bg-[#0a0a0a] border border-[#1e1e1e] rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#dc2626] resize-none disabled:opacity-50"
          />
        </div>

        <div className="pt-2">
          <Button
            onClick={handleSubmit}
            disabled={loading || !eligible}
            className="w-full bg-[#dc2626] text-black hover:bg-[#b91c1c]"
          >
            {loading ? "Submitting..." : "Submit Application"}
          </Button>
        </div>
      </div>
    </Shell>
  );
}
