import { prisma } from "@/lib/prisma";
import { SopPageClient } from "./SopPageClient";

export const dynamic = "force-dynamic";

export default async function SopPage() {
  try {
    const sop = await prisma.sopContent.findFirst();
    return <SopPageClient content={sop?.content ?? ""} />;
  } catch {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#0a0a0a] text-white p-8">
        <h1 className="font-[family-name:var(--font-oswald)] text-2xl font-bold text-red-500 mb-4">
          Database Error
        </h1>
        <p className="text-gray-400 text-center max-w-md">
          Cannot connect to the database. Please ensure DATABASE_URL is set in Vercel environment variables.
        </p>
      </div>
    );
  }
}
