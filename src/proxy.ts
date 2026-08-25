import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";

const PUBLIC_API_ROUTES = [
  "/api/auth",
  "/api/members",
  "/api/training/summary",
  "/api/loa/apply",
  "/api/onboarding",
  "/api/ftp",
  "/api/sop",
  "/api/radio-codes",
  "/api/cadet/me",
  "/api/notifications",
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
  "/api/admin": ["notifications", "templates", "roster.view", "hr.view", "training.view"],
  "/api/admin/dashboard": ["roster.view", "hr.view", "training.view", "clock.view", "notifications"],
  "/api/discord": ["notifications"],
  "/api/clock": ["clock.view"],
  "/api/user/notifications": ["notifications"],
};

function isPublicApiRoute(pathname: string): boolean {
  return PUBLIC_API_ROUTES.some((route) => pathname.startsWith(route));
}

function getRequiredPermissions(pathname: string): string[] | null {
  for (const [prefix, perms] of Object.entries(PERMISSION_ROUTE_MAP)) {
    if (pathname.startsWith(prefix)) return perms;
  }
  return null;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = await getToken({ req: request });

  // Admin page protection — redirect to login
  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    if (!token) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    if (!token.isAdmin && !token.isSuperAdmin) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
  }

  // API route protection — return JSON errors
  if (pathname.startsWith("/api/")) {
    if (isPublicApiRoute(pathname)) {
      return NextResponse.next();
    }

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isSuperAdmin = token.isSuperAdmin === true;
    const permissions = (token.permissions as string[]) ?? [];

    if (!isSuperAdmin && !token.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const requiredPerms = getRequiredPermissions(pathname);
    if (requiredPerms && !isSuperAdmin) {
      const hasPermission = requiredPerms.some((p) => permissions.includes(p));
      if (!hasPermission) {
        return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
      }
    }

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-user-discord-id", token.discordId as string);
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/:path*"],
};
