import { prisma } from "@/lib/prisma";
import { RadioCodesPageClient } from "./RadioCodesPageClient";

export const dynamic = "force-dynamic";

export default async function RadioCodesPage() {
  const codes = await prisma.radioCode.findMany({
    orderBy: { order: "asc" },
  });

  return <RadioCodesPageClient codes={codes as any} />;
}
