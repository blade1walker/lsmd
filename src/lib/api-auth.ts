import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { NextResponse } from "next/server";

interface AuthUser {
  discordId: string;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  permissions: string[];
}

export async function requireAuth(): Promise<{ user: AuthUser } | { error: NextResponse }> {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.discordId) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const user: AuthUser = {
    discordId: session.user.discordId,
    isAdmin: session.user.isAdmin ?? false,
    isSuperAdmin: session.user.isSuperAdmin ?? false,
    permissions: session.user.permissions ?? [],
  };

  if (!user.isAdmin && !user.isSuperAdmin) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { user };
}

export function hasPermission(user: AuthUser, permission: string): boolean {
  return user.isSuperAdmin || user.permissions.includes(permission);
}

export function requirePermission(user: AuthUser, permission: string): NextResponse | null {
  if (!hasPermission(user, permission)) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }
  return null;
}
