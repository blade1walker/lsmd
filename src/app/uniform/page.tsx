import Link from "next/link";

export default function UniformPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <header className="border-b border-[#1e1e1e]">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="text-sm text-gray-400 hover:text-white">
            ← Back to Roster
          </Link>
          <span className="font-[family-name:var(--font-oswald)] text-white font-semibold text-sm">
EMS
          </span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-12">
        <h1 className="font-[family-name:var(--font-oswald)] text-3xl font-bold text-white uppercase mb-2">
          EMS Uniform Guide
        </h1>
        <p className="text-gray-500 text-sm mb-10">
          Standard uniform components and rank texture colors for all EMS personnel
        </p>

        <div className="grid sm:grid-cols-2 gap-6 mb-12">
          <Link href="/uniform/male" className="group">
            <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl p-8 hover:border-[#eab308]/30 transition-colors">
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center mb-4">
                <span className="text-2xl font-bold text-white">M</span>
              </div>
              <h2 className="font-[family-name:var(--font-oswald)] text-xl font-bold text-white uppercase mb-2">
                Male Uniform
              </h2>
              <p className="text-gray-500 text-sm">
                Shirt 577-579 • Undershirt 225 • Pants 209/210
              </p>
            </div>
          </Link>

          <Link href="/uniform/female" className="group">
            <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl p-8 hover:border-[#eab308]/30 transition-colors">
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-pink-600 to-pink-800 flex items-center justify-center mb-4">
                <span className="text-2xl font-bold text-white">F</span>
              </div>
              <h2 className="font-[family-name:var(--font-oswald)] text-xl font-bold text-white uppercase mb-2">
                Female Uniform
              </h2>
              <p className="text-gray-500 text-sm">
                Shirt 586/624 • Undershirt 271 • Pants 224/225
              </p>
            </div>
          </Link>
        </div>

        <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[#1e1e1e]">
            <h2 className="font-[family-name:var(--font-oswald)] text-lg font-bold text-white uppercase">
              Rank Texture Colors
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1e1e1e]">
                  <th className="text-left px-6 py-3 text-gray-500 font-medium">Rank</th>
                  <th className="text-center px-6 py-3 text-gray-500 font-medium">Texture</th>
                  <th className="text-left px-6 py-3 text-gray-500 font-medium">Color</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e1e1e]">
                <tr>
                  <td className="px-6 py-3 text-white">Medical Intern → EMT</td>
                  <td className="px-6 py-3 text-center text-white font-mono">03</td>
                  <td className="px-6 py-3">
                    <span className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-green-500" />
                      <span className="text-green-400">Green</span>
                    </span>
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-3 text-white">Paramedic → Lieutenant</td>
                  <td className="px-6 py-3 text-center text-white font-mono">05</td>
                  <td className="px-6 py-3">
                    <span className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-blue-500" />
                      <span className="text-blue-400">Blue</span>
                    </span>
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-3 text-white">EMS Captain → Division Chief</td>
                  <td className="px-6 py-3 text-center text-white font-mono">04</td>
                  <td className="px-6 py-3">
                    <span className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-orange-500" />
                      <span className="text-orange-400">Orange</span>
                    </span>
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-3 text-white">Assistant Chief → Chief of EMS</td>
                  <td className="px-6 py-3 text-center text-white font-mono">06</td>
                  <td className="px-6 py-3">
                    <span className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-red-500" />
                      <span className="text-red-400">Red</span>
                    </span>
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-3 text-white">Director of Medicine (High Command)</td>
                  <td className="px-6 py-3 text-center text-white font-mono">06</td>
                  <td className="px-6 py-3">
                    <span className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-gray-900 border border-gray-600" />
                      <span className="text-gray-400">Black</span>
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
