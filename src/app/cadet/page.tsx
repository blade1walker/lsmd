import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CadetPageClient } from "./CadetPageClient";

export const dynamic = "force-dynamic";

export default async function CadetPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.discordId) {
    redirect("/admin/login");
  }

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
}
