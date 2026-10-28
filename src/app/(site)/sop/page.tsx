"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession, signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { fetchList, ApiError, errorMessage } from "@/lib/fetch-json";
import { SopPageClient, type SopDoc } from "./SopPageClient";

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <h1 className="font-[family-name:var(--font-oswald)] text-2xl font-bold text-white mb-4 uppercase">
          {title}
        </h1>
        {children}
      </div>
    </div>
  );
}

export default function SopPage() {
  const { data: session, status } = useSession();
  const [docs, setDocs] = useState<SopDoc[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const fetchDocs = useCallback(async () => {
    setError(null);
    setForbidden(false);
    try {
      setDocs(await fetchList<SopDoc>("/api/sop"));
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setForbidden(true);
      } else {
        setError(errorMessage(err));
      }
    }
  }, []);

  useEffect(() => {
    if (session) fetchDocs();
  }, [session, fetchDocs]);

  if (status === "loading") {
    return <div className="min-h-screen bg-[#0a0a0a]" />;
  }

  if (!session) {
    return (
      <Notice title="Standard Operating Procedures">
        <p className="text-gray-500 mb-6">Sign in with Discord to view the SOP</p>
        <Button onClick={() => signIn("discord")} className="bg-[#5865F2] hover:bg-[#4752C4]">
          Sign in with Discord
        </Button>
      </Notice>
    );
  }

  if (forbidden) {
    return (
      <Notice title="No Access">
        <p className="text-gray-500">
          Your account does not have permission to view the SOP. Contact an administrator if you
          believe this is wrong.
        </p>
      </Notice>
    );
  }

  if (error) {
    return (
      <Notice title="Failed to Load">
        <p className="text-gray-500 mb-4 break-words">{error}</p>
        <Button variant="ghost" onClick={fetchDocs}>Try again</Button>
      </Notice>
    );
  }

  if (!docs) {
    return <div className="min-h-screen bg-[#0a0a0a]" />;
  }

  return <SopPageClient docs={docs} />;
}
