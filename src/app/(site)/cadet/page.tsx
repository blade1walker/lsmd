import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { DatabaseError } from "@/components/ui/database-error";
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

  let member;
  try {
    member = await prisma.member.findFirst({
      where: { discordId: session.user.discordId },
      include: {
        trainingRecord: {
          include: {
            remarks: true,
          },
        },
      },
    });
  } catch {
    return <DatabaseError />;
  }
  return <CadetPageClient member={member} />;
}
