import { prisma } from "@/lib/prisma";
import { PublicPageClient } from "@/components/PublicPageClient";

export const dynamic = "force-dynamic";

export default async function Home() {
  const sections = await prisma.section.findMany({
    include: {
      members: {
        orderBy: { order: "asc" },
      },
    },
    orderBy: { order: "asc" },
  });

  return <PublicPageClient sections={sections as any} />;
}
