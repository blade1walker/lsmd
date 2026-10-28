import { PublicPageClient } from "@/components/PublicPageClient";
import { LoadError } from "@/components/LoadError";
import { getRosterPageData } from "@/lib/roster";
import { parseRosterFilters } from "@/lib/roster-shared";
import type { Metadata } from "next";
import { log } from "@/lib/log";

export const metadata: Metadata = { title: "Personnel Roster" };

export const dynamic = "force-dynamic";

export default async function RosterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Filters live in the link, so a filtered view ("every FTI on evenings") can
  // be copied and sent, and survives a reload.
  const initialFilters = parseRosterFilters(await searchParams);

  let data;
  try {
    data = await getRosterPageData();
  } catch (error) {
    log.error("Roster failed to load", error);
    return <LoadError what="The roster" />;
  }

  return <PublicPageClient data={data} initialFilters={initialFilters} />;
}
