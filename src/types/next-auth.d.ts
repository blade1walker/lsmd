import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      name?: string | null;
      email?: string | null;
      image?: string | null;
      discordId?: string;
      /** Allowed to sign in at all: on the roster, or a super admin. */
      isAdmin?: boolean;
      isSuperAdmin?: boolean;
      /** Carries a roster Member row. */
      isMember?: boolean;
      memberId?: string | null;
      adminRole?: string | null;
      permissions?: string[];
      discordName?: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    discordId?: string;
    isAdmin?: boolean;
    isSuperAdmin?: boolean;
    isMember?: boolean;
    memberId?: string | null;
    adminRole?: string | null;
    permissions?: string[];
    discordName?: string;
  }
}
