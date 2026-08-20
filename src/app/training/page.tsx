"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useSession, signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";

interface Trainee {
  id: string;
  memberId: string;
  member: { name: string; callSign?: string | null; rank: string };
  cadetProgress: { completed: number; total: number };
  probationaryProgress: { completed: number; total: number };
}

export default function TrainingPage() {
  const { data: session } = useSession();
  const [trainees, setTrainees] = useState<Trainee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) {
      setLoading(false);
      return;
    }
    fetch("/api/training/summary")
      .then((r) => r.json())
      .then((data) => setTrainees(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [session]);

  if (!session) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <h1 className="font-[family-name:var(--font-oswald)] text-2xl font-bold text-white mb-4">
            Training Portal
          </h1>
          <p className="text-gray-500 mb-6">Sign in with Discord to access the training portal</p>
          <Button onClick={() => signIn("discord")} className="bg-[#5865F2] hover:bg-[#4752C4]">
            Sign in with Discord
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <header className="sticky top-0 z-50 bg-[#0a0a0a]/95 backdrop-blur border-b border-[#1e1e1e]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center">
                <span className="font-[family-name:var(--font-oswald)] text-white font-bold text-xs">N</span>
              </div>
              <span className="font-[family-name:var(--font-oswald)] text-white font-semibold text-sm">EMS</span>
            </Link>
          </div>
          <nav className="flex items-center gap-4">
            <Link href="/" className="text-sm text-gray-400 hover:text-white transition-colors">Roster</Link>
            <Link href="/training" className="text-sm text-gold font-medium">Training</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="font-[family-name:var(--font-oswald)] text-3xl font-bold text-white uppercase mb-8">
          Training Portal
        </h1>

        {loading ? (
          <div className="text-center py-16 text-gray-500">Loading...</div>
        ) : trainees.length === 0 ? (
          <div className="text-center py-16 text-gray-500">No active trainees found</div>
        ) : (
          <div className="grid gap-4">
            {trainees.map((t) => (
              <div key={t.id} className="bg-card border border-[#1e1e1e] rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-white font-semibold">{t.member.name}</h3>
                    <p className="text-gray-500 text-sm">{t.member.callSign} — {t.member.rank}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-400">Cadet Phase</span>
                      <span className="text-xs text-gold">{t.cadetProgress.completed}/{t.cadetProgress.total}</span>
                    </div>
                    <div className="w-full bg-[#1e1e1e] rounded-full h-2">
                      <div
                        className="bg-gold h-2 rounded-full transition-all"
                        style={{ width: `${(t.cadetProgress.completed / t.cadetProgress.total) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-400">Probationary Phase</span>
                      <span className="text-xs text-gold">{t.probationaryProgress.completed}/{t.probationaryProgress.total}</span>
                    </div>
                    <div className="w-full bg-[#1e1e1e] rounded-full h-2">
                      <div
                        className="bg-gold h-2 rounded-full transition-all"
                        style={{ width: `${(t.probationaryProgress.completed / t.probationaryProgress.total) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
