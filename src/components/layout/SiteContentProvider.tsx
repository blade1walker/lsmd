"use client";

import { createContext, useContext } from "react";
import { Eye } from "lucide-react";
import { StarOfLife } from "@/components/roster/StarOfLife";
import { contentDefaults, flagOf, textOf, type SiteContentState } from "@/lib/site-content";

/**
 * The Boss Menu's content for the public pages. Their layout, (site)/layout.tsx, loads it
 * once per request (from memory, almost always) and every component reads it
 * from here instead of having it passed down through each page.
 *
 * The home page's text is not in here (see clientValues): that page renders
 * it on the server, so a client component asking for it gets the default.
 */

const fallback: SiteContentState = { values: contentDefaults(), notices: [], preview: false };
const SiteContentContext = createContext<SiteContentState>(fallback);

export function SiteContentProvider({ value, children }: { value: SiteContentState; children: React.ReactNode }) {
  return <SiteContentContext.Provider value={value}>{children}</SiteContentContext.Provider>;
}

export function useSiteContent() {
  const state = useContext(SiteContentContext);
  return {
    ...state,
    text: (key: string) => textOf(state.values, key),
    flag: (key: string) => flagOf(state.values, key),
  };
}

/** The uploaded logo, or the Star of Life when none is set. */
export function BrandLogo({ className }: { className?: string }) {
  const { text } = useSiteContent();
  const logo = text("brand.logo");
  if (!logo) return <StarOfLife className={className} />;
  // A user-uploaded picture of unknown size: next/image would need its dimensions.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={logo} alt={text("brand.name")} className={`${className ?? ""} object-contain`} />;
}

/** Shown across the top of every page while an editor is previewing drafts. */
export function PreviewBar() {
  const { preview } = useSiteContent();
  if (!preview) return null;
  return (
    <div className="relative z-[60] flex flex-wrap items-center justify-center gap-3 bg-amber-500 px-4 py-2 text-sm font-semibold text-black">
      <Eye className="h-4 w-4" />
      Preview — you are seeing unpublished changes. Visitors still see the live site.
      <a href="/admin/boss" className="underline underline-offset-2">
        Back to the Boss Menu
      </a>
      <a href="/api/boss/preview?on=0" className="underline underline-offset-2">
        Exit preview
      </a>
    </div>
  );
}
