import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/adapter-pg", "pg"],
  typescript: {
    // The 1 GB Oracle VM sets SKIP_TYPECHECK=1 (deploy/oracle/deploy.sh): the
    // type check alone runs 20+ minutes there in swap. Vercel still type-checks
    // every push to main, so errors are caught before the VM builds them.
    ignoreBuildErrors: process.env.SKIP_TYPECHECK === "1",
  },
};

export default nextConfig;
