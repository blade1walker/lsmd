"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useSiteContent } from "@/components/layout/SiteContentProvider";
import { NOTICE_TONES } from "@/lib/site-content";

/** Notices published from the Boss Menu, at the top of the home page. Drafts show only in preview. */
export function SiteNotices() {
  const { notices, preview } = useSiteContent();
  if (notices.length === 0) return null;

  return (
    <section aria-label="Notices" className="mx-auto w-full max-w-7xl space-y-3 px-4 pt-6 sm:px-6">
      {notices.map((notice) => {
        const tone = NOTICE_TONES[notice.tone];
        const external = notice.linkUrl && !notice.linkUrl.startsWith("/");
        return (
          <article key={notice.id} className={`rounded-xl border px-5 py-4 ${tone.className}`}>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${tone.dot}`} />
              <h2 className="font-semibold text-white">{notice.title}</h2>
              {preview && notice.status === "Draft" && (
                <span className="rounded bg-amber-500 px-1.5 py-px text-[10px] font-bold uppercase tracking-wider text-black">Draft</span>
              )}
            </div>
            {notice.body && <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed opacity-90">{notice.body}</p>}
            {notice.linkUrl && (
              <Link
                href={notice.linkUrl}
                {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
                className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-white underline-offset-2 hover:underline"
              >
                {notice.linkLabel || "Find out more"}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </article>
        );
      })}
    </section>
  );
}
