import { prisma } from "@/lib/prisma";
import { SopPageClient } from "./SopPageClient";

export const dynamic = "force-dynamic";

export default async function SopPage() {
  const sop = await prisma.sopContent.findFirst();

  return <SopPageClient content={sop?.content ?? ""} />;
}
