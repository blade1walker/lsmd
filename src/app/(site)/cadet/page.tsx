import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { LoadError } from "@/components/layout/LoadError";
import { CadetPageClient } from "./CadetPageClient";
import { log } from "@/lib/log";

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

  const member = await prisma.member
    .findFirst({
      where: { discordId: session.user.discordId },
      include: { trainingRecord: { include: { remarks: true } } },
    })
    .catch((error) => {
      log.error("Training progress failed to load", error);
      return undefined;
    });
  if (member === undefined) return <LoadError what="Your training progress" />;
  return <CadetPageClient member={member} />;
}
