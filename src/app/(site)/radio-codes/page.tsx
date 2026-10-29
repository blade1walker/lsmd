import { getRadioCodes } from "@/lib/radio-codes/server";
import { DatabaseError } from "@/components/ui/database-error";
import { RadioCodesPageClient } from "./RadioCodesPageClient";

export const dynamic = "force-dynamic";

export default async function RadioCodesPage() {
  let codes;
  try {
    codes = await getRadioCodes();
  } catch {
    return <DatabaseError />;
  }
  return <RadioCodesPageClient codes={codes} />;
}
