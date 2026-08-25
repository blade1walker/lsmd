import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

const PUBLIC_API_ROUTES = [
  "/api/auth",
  "/api/members",           // GET only, but middleware can't filter by method easily
  "/api/training/summary",  // public training overview
  "/api/loa/apply",         // public LOA application
  "/api/onboarding",        // POST only (public application)
  "/api/ftp",               // POST only (public application)
  "/api/sop",               // GET only (public SOP)
  "/api/radio-codes",       // GET only (public radio codes)
  "/api/cadet/me",          // requires session but handled separately
  "/api/notifications",     // public promotion feed
];

const PERMISSION_ROUTE_MAP: Record<string, string[]> = {
  "/api/members": ["roster.view", "roster.add", "roster.edit", "roster.delete", "roster.promote"],
  "/api/sections": ["roster.view", "roster.edit"],
  "/api/reorder": ["roster.edit"],
  "/api/training": ["training.view", "training.manage"],
  "/api/signoffs": ["training.signoff.manage", "training.view"],
  "/api/loa": ["hr.view", "hr.loa"],
  "/api/removal-requests": ["hr.view", "removal.request", "removal.approve"],
  "/api/inactivity-requests": ["hr.view", "hr.inactivity", "hr.inactivity.approve"],
  "/api/onboarding": ["onboarding.view", "onboarding.approve"],
  "/api/ftp": ["onboarding.view", "onboarding.approve"],
  "/api/recruit": ["onboarding.view", "onboarding.approve"],
  "/api/sop": ["sop.view", "sop.edit"],
  "/api/radio-codes": ["radio.edit"],
  "/api/admin": ["notifications", "templates"],
  "/api/discord": ["notifications"],
  "/api/clock": ["clock.view"],
  "/api/user/notifications": ["notifications"],
};

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_API_ROUTES.some((route) => pathname.startsWith(route));
}

function getRequiredPermissions(pathname: string): string[] | null {
  for (const [prefix, perms] of Object.entries(PERMISSION_ROUTE_MAP)) {
    if (pathname.startsWith(prefix)) return perms;
  }
  return null;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (!pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  if (!token) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const isSuperAdmin = token.isSuperAdmin === true;
  const permissions = (token.permissions as string[]) ?? [];

  if (!isSuperAdmin && !token.isAdmin) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403 }
    );
  }

  const requiredPerms = getRequiredPermissions(pathname);
  if (requiredPerms && !isSuperAdmin) {
    const hasPermission = requiredPerms.some((p) => permissions.includes(p));
    if (!hasPermission) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }
  }

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-user-discord-id", token.discordId as string);

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: ["/api/:path*"],
};
