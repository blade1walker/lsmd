import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The SQLite driver is a native module, loaded from node_modules at run time.
  serverExternalPackages: ["better-sqlite3", "@prisma/adapter-better-sqlite3"],
  typescript: {
    // A build on the 1 GB Oracle VM itself (LOCAL_BUILD=1 in deploy/oracle/deploy.sh)
    // sets SKIP_TYPECHECK=1: the check alone runs 20+ minutes there in swap. The
    // normal path is GitHub Actions (.github/workflows/oracle-build.yml), which
    // type-checks every push to main before the VM ever sees it.
    ignoreBuildErrors: process.env.SKIP_TYPECHECK === "1",
  },
};

export default nextConfig;
