import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      name?: string | null;
      email?: string | null;
      image?: string | null;
      discordId?: string;
      isAdmin?: boolean;
      isSuperAdmin?: boolean;
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
    adminRole?: string | null;
    permissions?: string[];
    discordName?: string;
  }
}
