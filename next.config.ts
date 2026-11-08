import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// Report-only for now: the browser logs what it would block but blocks nothing.
// Rename the header to Content-Security-Policy once the console stays clean.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://discord.com",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy-Report-Only", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/adapter-pg", "pg"],
  poweredByHeader: false,
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
  typescript: {
    // A build on the 1 GB Oracle VM itself (LOCAL_BUILD=1 in deploy/oracle/deploy.sh)
    // sets SKIP_TYPECHECK=1: the check alone runs 20+ minutes there in swap. The
    // normal path is GitHub Actions (.github/workflows/oracle-build.yml), which
    // type-checks every push to main before the VM ever sees it.
    ignoreBuildErrors: process.env.SKIP_TYPECHECK === "1",
  },
};

export default nextConfig;
