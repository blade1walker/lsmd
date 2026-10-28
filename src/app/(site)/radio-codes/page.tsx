import { getRadioCodes } from "@/lib/radio-codes-data";
import { LoadError } from "@/components/LoadError";
import { RadioCodesPageClient } from "./RadioCodesPageClient";

export const dynamic = "force-dynamic";

export default async function RadioCodesPage() {
  const codes = await getRadioCodes().catch((error) => {
    console.error("Radio codes failed to load:", error);
    return null;
  });
  if (!codes) return <LoadError what="The radio codes" />;
  return <RadioCodesPageClient codes={codes} />;
}
