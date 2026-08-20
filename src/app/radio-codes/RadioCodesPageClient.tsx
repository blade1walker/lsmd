"use client";

import { DiscordBar } from "@/components/DiscordBar";
import { Footer } from "@/components/Footer";
import { motion } from "framer-motion";

interface RadioCode {
  id: string;
  code: string;
  description: string;
  section: string;
  highlighted: boolean;
}

interface RadioCodesPageClientProps {
  codes: RadioCode[];
}

export function RadioCodesPageClient({ codes }: RadioCodesPageClientProps) {
  const tenCodes = codes.filter((c) => c.section === "ten");
  const elevenCodes = codes.filter((c) => c.section === "eleven");
  const responseCodes = codes.filter((c) => c.section === "response");

  return (
    <div className="flex flex-col min-h-screen">
      <DiscordBar />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
        <div className="mb-8">
          <h1 className="font-[family-name:var(--font-oswald)] text-3xl font-bold text-white uppercase">
            Radio Codes
          </h1>
          <p className="text-gray-500 text-sm mt-2">
            Emergency Medical Services - Official Radio Codes Reference
          </p>
        </div>

        <div className="grid gap-8">
          {[
            { title: "10-Codes", codes: tenCodes },
            { title: "11-Codes", codes: elevenCodes },
            { title: "Response Codes", codes: responseCodes },
          ].map(({ title, codes: sectionCodes }) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-[#111111] border border-[#1e1e1e] rounded-xl overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-[#1e1e1e]">
                <h2 className="font-[family-name:var(--font-oswald)] text-xl font-bold text-white uppercase">
                  {title}
                </h2>
              </div>
              <div className="divide-y divide-[#1e1e1e]">
                {sectionCodes.length === 0 ? (
                  <div className="px-6 py-8 text-center text-gray-500">
                    No codes in this section
                  </div>
                ) : (
                  sectionCodes.map((code) => (
                    <div
                      key={code.id}
                      className={`px-6 py-3 flex items-center gap-4 ${
                        code.highlighted ? "bg-[#eab308]/5" : ""
                      }`}
                    >
                      <span
                        className={`font-[family-name:var(--font-mono)] text-sm font-bold min-w-[60px] ${
                          code.highlighted ? "text-[#eab308]" : "text-white"
                        }`}
                      >
                        {code.code}
                      </span>
                      <span className="text-gray-400 text-sm">
                        {code.description}
                      </span>
                      {code.highlighted && (
                        <span className="ml-auto px-2 py-0.5 bg-[#eab308]/10 text-[#eab308] text-xs rounded">
                          Important
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </main>

      <Footer />
    </div>
  );
}
