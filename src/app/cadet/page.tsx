import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CadetPageClient } from "./CadetPageClient";

export const dynamic = "force-dynamic";

export default async function CadetPage() {
  let session;
  try {
    session = await getServerSession(authOptions);
  } catch {
    redirect("/admin/login");
  }

  if (!session?.user?.discordId) {
    redirect("/admin/login");
  }

  try {
    const member = await prisma.member.findFirst({
      where: { discordId: session.user.discordId },
      include: {
        trainingRecord: {
          include: {
            remarks: true,
          },
        },
      },
    });

    return <CadetPageClient member={member as any} />;
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
