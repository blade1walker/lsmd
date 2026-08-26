import { NextAuthOptions } from "next-auth";
import DiscordProvider from "next-auth/providers/discord";
import { resolveAccess, syncAdminUserFromRoster } from "./access";

export const authOptions: NextAuthOptions = {
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
      // Only what is needed to identify the account. `email` is not requested.
      authorization: { params: { scope: "identify" } },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },
  pages: {
    signIn: "/admin/login",
    error: "/admin/login",
  },
  callbacks: {
    /**
     * The gate. Rejecting here means no session is ever issued, so an account
     * that is not on the roster cannot reach anything that reads the session.
     */
    async signIn({ account }) {
      // Checked here rather than at module scope: `next build` imports this
      // file with NODE_ENV=production but without the runtime environment, so
      // throwing on import would fail the build instead of the request.
      if (!process.env.NEXTAUTH_SECRET && process.env.NODE_ENV === "production") {
        console.error("NEXTAUTH_SECRET is not set. Sessions cannot be signed securely.");
        return false;
      }

      const discordId = account?.providerAccountId;
      const access = await resolveAccess(discordId);

      if (!access.allowed) {
        console.warn(`Sign-in denied for Discord ID ${discordId ?? "unknown"}: ${access.denialReason}`);
        return "/admin/login?error=NotInRoster";
      }

      // signIn() fires only on an actual authentication event, unlike jwt()
      // below which re-runs on every session check — so this is the one place
      // that means "someone just logged in" rather than "a page was loaded".
      if (discordId) await syncAdminUserFromRoster(discordId);

      return true;
    },

    async jwt({ token, account }) {
      if (account?.providerAccountId) {
        token.discordId = account.providerAccountId;
      }

      if (token.discordId) {
        // Re-resolved on every decode rather than frozen at sign-in, so role
        // changes and roster removals take effect without a re-login.
        const access = await resolveAccess(token.discordId as string);
        token.isAdmin = access.allowed;
        token.isSuperAdmin = access.isSuperAdmin;
        token.isMember = access.isMember;
        token.memberId = access.memberId;
        token.adminRole = access.roleName;
        token.permissions = access.permissions;
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.discordId = token.discordId as string;
        session.user.isAdmin = token.isAdmin as boolean;
        session.user.isSuperAdmin = token.isSuperAdmin as boolean;
        session.user.isMember = token.isMember as boolean;
        session.user.memberId = (token.memberId as string | null) ?? null;
        session.user.adminRole = token.adminRole as string | null;
        session.user.permissions = (token.permissions as string[]) ?? [];
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
