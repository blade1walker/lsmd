"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

export default function AdminLoginPage() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleDiscordLogin = async () => {
    setLoading(true);
    await signIn("discord", { callbackUrl: "/admin/roster" });
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-[#dc2626] to-[#b91c1c] flex items-center justify-center mx-auto mb-4">
            <span className="font-[family-name:var(--font-oswald)] text-black font-bold text-2xl">
              N
            </span>
          </div>
          <h1 className="font-[family-name:var(--font-oswald)] text-2xl font-bold text-white uppercase">
            Admin Login
          </h1>
          <p className="text-gray-500 text-sm mt-2">
            Sign in with your Discord account to access the admin panel
          </p>
        </div>

        <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl p-6">
          <button
            onClick={handleDiscordLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-[#5865F2] hover:bg-[#4752C4] text-white font-semibold rounded-lg transition-all disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561 19.9312 19.9312 0 005.9932 3.0397.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286 19.8975 19.8975 0 006.0022-3.0397.0771.0771 0 00.0312-.0551c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286z" />
            </svg>
            {loading ? "Signing in..." : "Sign in with Discord"}
          </button>

          <div className="mt-4 text-center text-xs text-gray-500">
            Only authorized admin accounts can access this panel
          </div>
        </div>

        <div className="mt-6 text-center">
          <a href="/" className="text-sm text-gray-500 hover:text-white transition-colors">
            Back to Roster
          </a>
        </div>
      </motion.div>
    </div>
  );
}
