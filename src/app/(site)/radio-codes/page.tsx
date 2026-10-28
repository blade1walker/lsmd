import { getRadioCodes } from "@/lib/radio-codes-data";
import { LoadError } from "@/components/LoadError";
import { RadioCodesPageClient } from "./RadioCodesPageClient";
import { log } from "@/lib/log";

export const dynamic = "force-dynamic";

export default async function RadioCodesPage() {
  const codes = await getRadioCodes().catch((error) => {
    log.error("Radio codes failed to load", error);
    return null;
  });
  if (!codes) return <LoadError what="The radio codes" />;
  return <RadioCodesPageClient codes={codes} />;
}
