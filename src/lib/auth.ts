import { NextAuthOptions } from "next-auth";
import DiscordProvider from "next-auth/providers/discord";
import { prisma } from "./prisma";
import { SUPER_ADMIN_IDS, ALL_PERMISSIONS } from "./constants";

export const authOptions: NextAuthOptions = {
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },
  pages: {
    signIn: "/admin/login",
  },
  callbacks: {
    async jwt({ token, account }) {
      if (account && token.sub) {
        token.discordId = token.sub;
      }
      if (token.discordId) {
        const discordId = token.discordId as string;
        const isSuperAdmin = SUPER_ADMIN_IDS.includes(discordId);
        const adminUser = await prisma.adminUser.findUnique({
          where: { discordId },
          include: { role: true },
        });
        token.isAdmin = isSuperAdmin || !!adminUser;
        token.isSuperAdmin = isSuperAdmin;
        token.adminRole = adminUser?.role?.name ?? null;
        token.permissions = isSuperAdmin
          ? [...ALL_PERMISSIONS]
          : (adminUser?.role?.permissions ?? []);
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as Record<string, unknown>).discordId = token.discordId as string;
        (session.user as Record<string, unknown>).isAdmin = token.isAdmin as boolean;
        (session.user as Record<string, unknown>).isSuperAdmin = token.isSuperAdmin as boolean;
        (session.user as Record<string, unknown>).adminRole = token.adminRole as string | null;
        (session.user as Record<string, unknown>).permissions = token.permissions as string[];
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
