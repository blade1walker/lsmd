import { NextResponse } from "next/server";

export async function GET() {
  const hasDbUrl = !!process.env.DATABASE_URL;
  const hasNextauthSecret = !!process.env.NEXTAUTH_SECRET;
  const hasNextauthUrl = !!process.env.NEXTAUTH_URL;
  const hasDiscordId = !!process.env.DISCORD_CLIENT_ID;
  const hasDiscordSecret = !!process.env.DISCORD_CLIENT_SECRET;

  const envStatus = {
    DATABASE_URL: hasDbUrl ? "set" : "MISSING",
    NEXTAUTH_SECRET: hasNextauthSecret ? "set" : "MISSING",
    NEXTAUTH_URL: hasNextauthUrl ? process.env.NEXTAUTH_URL : "MISSING",
    DISCORD_CLIENT_ID: hasDiscordId ? "set" : "MISSING",
    DISCORD_CLIENT_SECRET: hasDiscordSecret ? "set" : "MISSING",
  };

  let dbStatus = "not tested";
  if (hasDbUrl) {
    try {
      const { prisma } = await import("@/lib/prisma");
      await prisma.$queryRaw`SELECT 1`;
      dbStatus = "connected";
    } catch (e: any) {
      dbStatus = `error: ${e.message?.slice(0, 200)}`;
    }
  }

  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    env: envStatus,
    database: dbStatus,
  });
}
