"use client";

export function Footer() {
  return (
    <footer className="border-t border-[#1e1e1e] bg-[#0a0a0a] mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-red-600 to-red-700 flex items-center justify-center">
                <span className="font-[family-name:var(--font-oswald)] text-white font-bold text-lg">
                  N
                </span>
              </div>
              <div>
                <span className="font-[family-name:var(--font-oswald)] text-white font-semibold text-lg tracking-wide">
                  NEXUS
                </span>
                <span className="text-gray-500 text-sm ml-2">Universe</span>
              </div>
            </div>
            <p className="text-gray-500 text-sm max-w-sm">
              Official Personnel Roster of the Emergency Medical Services.
              Part of the Nexus Universe GTA V Roleplay community.
            </p>
          </div>

          <div>
            <h3 className="font-[family-name:var(--font-oswald)] text-white font-semibold text-sm uppercase tracking-wider mb-4">
              Quick Links
            </h3>
            <ul className="space-y-2">
              <li>
                <a href="/" className="text-gray-500 hover:text-white text-sm transition-colors">
                  Roster
                </a>
              </li>
              <li>
                <a href="/sop" className="text-gray-500 hover:text-white text-sm transition-colors">
                  SOP
                </a>
              </li>
              <li>
                <a href="/radio-codes" className="text-gray-500 hover:text-white text-sm transition-colors">
                  Radio Codes
                </a>
              </li>
              <li>
                <a href="/training" className="text-gray-500 hover:text-white text-sm transition-colors">
                  Training
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-[family-name:var(--font-oswald)] text-white font-semibold text-sm uppercase tracking-wider mb-4">
              Community
            </h3>
            <ul className="space-y-2">
              <li>
                <a href="#" className="text-gray-500 hover:text-white text-sm transition-colors flex items-center gap-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561 19.9312 19.9312 0 005.9932 3.0397.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286 19.8975 19.8975 0 006.0022-3.0397.0771.0771 0 00.0312-.0551c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286z" />
                  </svg>
                  Discord Server
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-500 hover:text-white text-sm transition-colors">
                  FiveM Server
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-[#1e1e1e] mt-8 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-gray-600 text-sm">
            &copy; {new Date().getFullYear()} Nexus Universe. All rights reserved.
          </div>
          <div className="text-gray-600 text-xs">
            This is a fictional roleplay community. Not affiliated with actual law enforcement.
          </div>
        </div>
      </div>
    </footer>
  );
}
