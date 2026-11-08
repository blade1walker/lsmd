"use client";

import { useSession } from "next-auth/react";

/**
 * Whether the signed-in user holds a permission (or any of a list), for
 * hiding controls whose API call would answer 403. UX only: the API route
 * still makes the real check.
 */
export function useCan() {
  const { data } = useSession();
  return (permission: string | readonly string[]) =>
    !!data?.user.isSuperAdmin ||
    (typeof permission === "string" ? [permission] : permission).some((p) => data?.user.permissions?.includes(p));
}
