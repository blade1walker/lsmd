import { PreviewBar, SiteContentProvider } from "@/components/SiteContentProvider";
import { clientValues } from "@/lib/site-content";
import { getSiteContentState } from "@/lib/site-content-server";

/**
 * The public pages that show the Boss Menu's content: the brand, footer and
 * notices. Loading it here rather than in the root layout keeps the staff
 * panel's pages static — only these are rendered per request, from memory.
 */
export default async function SiteLayout({ children }: LayoutProps<"/">) {
  const content = await getSiteContentState();
  return (
    <SiteContentProvider value={{ ...content, values: clientValues(content.values) }}>
      <PreviewBar />
      {children}
    </SiteContentProvider>
  );
}
