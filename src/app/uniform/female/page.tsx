import Link from "next/link";

export default function FemaleUniformPage() {
  const components = [
    { label: "Shirt", value: "586 / 624", note: "Choose from 586 or 624" },
    { label: "Undershirt", value: "271", note: null },
    { label: "Body Armour", value: "96", note: null },
    { label: "Arms", value: "85", note: "Adjust as needed" },
    { label: "Pants", value: "224 / 225", note: "Choose from 224 or 225" },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <header className="border-b border-[#1e1e1e]">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/uniform" className="text-sm text-gray-400 hover:text-white">
            ← Back to Uniform
          </Link>
          <span className="font-[family-name:var(--font-oswald)] text-white font-semibold text-sm">
            LSMD
          </span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-12">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-600 to-pink-800 flex items-center justify-center">
            <span className="text-xl font-bold text-white">F</span>
          </div>
          <div>
            <h1 className="font-[family-name:var(--font-oswald)] text-3xl font-bold text-white uppercase">
              Female EMS Uniform
            </h1>
            <p className="text-gray-500 text-sm">Standard component IDs for female characters</p>
          </div>
        </div>

        <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl overflow-hidden mt-8">
          <div className="px-6 py-4 border-b border-[#1e1e1e]">
            <h2 className="font-[family-name:var(--font-oswald)] text-lg font-bold text-white uppercase">
              Uniform Components
            </h2>
          </div>
          <div className="divide-y divide-[#1e1e1e]">
            {components.map((c) => (
              <div key={c.label} className="px-6 py-4 flex items-center justify-between">
                <div>
                  <span className="text-white font-medium">{c.label}</span>
                  {c.note && (
                    <span className="text-gray-500 text-xs ml-2">({c.note})</span>
                  )}
                </div>
                <span className="font-mono text-[#eab308] text-lg font-semibold">{c.value}</span>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
