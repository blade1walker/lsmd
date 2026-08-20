"use client";

import { DiscordBar } from "@/components/DiscordBar";
import { SopViewer } from "@/components/SopViewer";
import { Footer } from "@/components/Footer";

interface SopPageClientProps {
  content: string;
}

export function SopPageClient({ content }: SopPageClientProps) {
  return (
    <div className="flex flex-col min-h-screen">
      <DiscordBar />

      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
        <div className="mb-8">
          <h1 className="font-[family-name:var(--font-oswald)] text-3xl font-bold text-white uppercase">
            Standard Operating Procedures
          </h1>
          <p className="text-gray-500 text-sm mt-2">
            Los Santos Medical Department - Official SOP Document
          </p>
        </div>

        {content ? (
          <SopViewer content={content} />
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
