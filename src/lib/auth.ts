import { NextAuthOptions } from "next-auth";
import DiscordProvider from "next-auth/providers/discord";
import { resolveAccess, provisionAdminUser, syncAdminUserFromRoster } from "./access";

/**
 * NEXTAUTH_URL is this site's own public address. It has been set to
 * Discord's OAuth2 authorize link from the Developer Portal before, which
 * points every sign-in redirect at discord.com and makes sign-in impossible.
 * A value that is not a URL, or is a Discord address, is ignored instead, so
 * NextAuth falls back to the address the request came in on (AUTH_TRUST_HOST
 * turns that on).
 */
function dropInvalidNextAuthUrl() {
  const value = process.env.NEXTAUTH_URL;
  if (!value) return;

  let reason: string | null = null;
  try {
    const { protocol, hostname } = new URL(value);
    if (protocol !== "https:" && protocol !== "http:") reason = "it is not an http(s) address";
    else if (/(^|\.)discord(app)?\.com$/i.test(hostname)) reason = "it points at Discord, not this site";
  } catch {
    reason = "it is not a valid URL";
  }
  if (!reason) return;

  console.error(
    `NEXTAUTH_URL is ignored because ${reason}. Set it to this site's own address ` +
      `(e.g. https://lsmd.tech) in /opt/lsmd/.env.`
  );
  delete process.env.NEXTAUTH_URL;
}

dropInvalidNextAuthUrl();

export const authOptions: NextAuthOptions = {
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
      // Only what is needed to identify the account. `email` is not requested.
      authorization: { params: { scope: "identify" } },
      // Discord now returns `iss` on the sign-in redirect (RFC 9207). With no
      // issuer configured, openid-client rejects every callback with "issuer
      // must be configured on the issuer" (error=OAuthCallback). This is the
      // issuer from https://discord.com/.well-known/openid-configuration.
      issuer: "https://discord.com",
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

      // A database error thrown from here becomes the redirect target —
      // NextAuth puts its multi-line message in the Location header, which is
      // invalid, so the visitor got a bare HTTP 500 page instead of the login
      // page. Answer with an error code the login page explains instead.
      try {
        const access = await resolveAccess(discordId);

        if (!access.allowed) {
          console.warn(`Sign-in denied for Discord ID ${discordId ?? "unknown"}: ${access.denialReason}`);
          return "/admin/login?error=NotInRoster";
        }

        // signIn() fires only on an actual authentication event, unlike jwt()
        // below which re-runs on every session check — so this is the one place
        // that means "someone just logged in" rather than "a page was loaded".
        if (discordId) {
          await provisionAdminUser(discordId);
          await syncAdminUserFromRoster(discordId);
        }
      } catch (error) {
        console.error(`Sign-in for Discord ID ${discordId ?? "unknown"} could not be checked:`, error);
        return "/admin/login?error=DatabaseUnavailable";
      }

      return true;
    },

    async jwt({ token, account }) {
      if (account?.providerAccountId) {
        token.discordId = account.providerAccountId;
      }

      if (token.discordId) {
        // Re-resolved on every decode rather than frozen at sign-in, so role
        // changes and roster removals take effect without a re-login. When the
        // database is down the claims from the last good check are kept: every
        // API route re-checks access against the database anyway, so nothing
        // is reachable on them meanwhile, and the session itself stays intact.
        let access;
        try {
          access = await resolveAccess(token.discordId as string);
        } catch (error) {
          console.error("Session access could not be re-checked; keeping the last result:", error);
          return token;
        }
        token.isAdmin = access.allowed;
        token.isSuperAdmin = access.isSuperAdmin;
        token.isMember = access.isMember;
        token.memberId = access.memberId;
        token.memberRank = access.memberRank;
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
        session.user.memberRank = (token.memberRank as string | null) ?? null;
        session.user.adminRole = token.adminRole as string | null;
        session.user.permissions = (token.permissions as string[]) ?? [];
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
