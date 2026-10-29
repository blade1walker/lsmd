import Link from "next/link";

export default function MaleUniformPage() {
  const components = [
    { label: "Shirt", value: "577 - 579", note: "Choose from 577, 578, or 579" },
    { label: "Undershirt", value: "225", note: null },
    { label: "Body Armour", value: "96", note: null },
    { label: "Arms", value: "85", note: "Adjust as needed" },
    { label: "Pants", value: "209 / 210", note: "Choose from 209 or 210" },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <header className="border-b border-[#1e1e1e] pt-[env(safe-area-inset-top)]">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/uniform" className="-mx-2 rounded-md px-2 py-2.5 text-sm text-gray-400 hover:text-white">
            ← Back to Uniform
          </Link>
          <span className="font-[family-name:var(--font-oswald)] text-white font-semibold text-sm">
            EMS
          </span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 sm:py-12">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center">
            <span className="text-xl font-bold text-white">M</span>
          </div>
          <div>
            <h1 className="font-[family-name:var(--font-oswald)] text-3xl font-bold text-white uppercase">
              Male EMS Uniform
            </h1>
            <p className="text-gray-500 text-sm">Standard component IDs for male characters</p>
          </div>
        </div>

        <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl overflow-hidden mt-8">
          <div className="px-4 sm:px-6 py-4 border-b border-[#1e1e1e]">
            <h2 className="font-[family-name:var(--font-oswald)] text-lg font-bold text-white uppercase">
              Uniform Components
            </h2>
          </div>
          <div className="divide-y divide-[#1e1e1e]">
            {components.map((c) => (
              <div key={c.label} className="px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <span className="text-white font-medium">{c.label}</span>
                  {c.note && (
                    <span className="block sm:inline text-gray-500 text-xs mt-0.5 sm:mt-0 sm:ml-2">({c.note})</span>
                  )}
                </div>
                <span className="shrink-0 whitespace-nowrap font-mono text-[#dc2626] text-lg font-semibold">{c.value}</span>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
