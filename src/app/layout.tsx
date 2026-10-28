import type { Metadata, Viewport } from "next";
import { Inter, Oswald, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { Providers } from "@/components/Providers";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

// Oswald is a variable font: with no weight list next/font serves one file
// covering 200–700, instead of one file per weight.
const oswald = Oswald({
  variable: "--font-oswald",
  subsets: ["latin"],
});

// Only call signs and IDs use it, so it is not worth preloading on every page.
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  preload: false,
});

export const metadata: Metadata = {
  title: { default: "Los Santos EMS — Nexus Universe", template: "%s — Los Santos EMS" },
  description:
    "Los Santos Emergency Medical Services on Nexus Universe RP — applications, roster, SOP and training.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "LSMS Roster",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Pinch-zoom stays on: blocking it locks people out of small text on phones.
  themeColor: "#0a0a0f",
};

export default function RootLayout({
  children,
}: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${oswald.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* Rank order and insignia from Admin → Ranks. A plain blocking script so
            it has run before any of the app's code reads RANKS. */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src="/api/rank-config" />
      </head>
      <body className="min-h-full flex flex-col bg-[#0a0a0f] text-white font-[family-name:var(--font-inter)]">
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js').catch(() => {});
                });
              }
            `,
          }}
        />
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
