"use client";

import { useMemo, useState } from "react";
import { DiscordBar } from "@/components/DiscordBar";
import { SopViewer } from "@/components/SopViewer";
import { Footer } from "@/components/Footer";
import { ExternalLink } from "lucide-react";
import type { RelatedLink } from "@/lib/sop";

export interface SopDoc {
  id: string;
  title: string;
  content: string;
  order: number;
  relatedLinks: RelatedLink[];
}

export function SopPageClient({ docs }: { docs: SopDoc[] }) {
  const sorted = useMemo(() => [...docs].sort((a, b) => a.order - b.order), [docs]);
  const [selectedId, setSelectedId] = useState(sorted[0]?.id ?? "");
  const selected = sorted.find((d) => d.id === selectedId) ?? sorted[0] ?? null;

  return (
    <div className="flex flex-col min-h-screen">
      <DiscordBar />

      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="font-[family-name:var(--font-oswald)] text-3xl font-bold text-white uppercase">
              Standard Operating Procedures
            </h1>
            <p className="text-gray-500 text-sm mt-2">
              Emergency Medical Services - Official SOP Documents
            </p>
          </div>

          {sorted.length > 1 && (
            <select
              value={selected?.id ?? ""}
              onChange={(e) => setSelectedId(e.target.value)}
              aria-label="Select SOP document"
              className="h-10 rounded-md border border-[#1e1e1e] bg-[#111111] px-3 text-sm text-white min-w-[220px]"
            >
              {sorted.map((doc) => (
                <option key={doc.id} value={doc.id}>{doc.title}</option>
              ))}
            </select>
          )}
        </div>

        {selected ? (
          <>
            {sorted.length > 1 && (
              <h2 className="font-[family-name:var(--font-oswald)] text-xl font-semibold text-white mb-4">
                {selected.title}
              </h2>
            )}
            <SopViewer content={selected.content} />
            {selected.relatedLinks.length > 0 && (
              <div className="mt-8 pt-6 border-t border-[#1e1e1e]">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  Related Links
                </h3>
                <div className="flex flex-wrap gap-2">
                  {selected.relatedLinks.map((link, i) => (
                    <a
                      key={i}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm text-red-400 hover:text-red-300 bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      {link.label}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-16 bg-[#111111] border border-[#1e1e1e] rounded-xl">
            <div className="text-gray-500 text-lg mb-2">No SOP content available</div>
            <div className="text-gray-600 text-sm">
              SOP documentation will be added by administrators
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
