/**
 * Fixed-window counter: at most `limit` hits per key per `windowMs`.
 * shortcut: in-memory, so it holds for the single `next start` process on the VM; move to the database or Redis if the site ever runs more than one process.
 */
export function rateLimiter(limit: number, windowMs: number) {
  const hits = new Map<string, { count: number; resetAt: number }>();

  /** True when this hit is allowed; false once the key is over its limit. */
  return function allow(key: string, now = Date.now()): boolean {
    const entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      // Drop expired keys now and then so the map cannot grow without bound.
      if (hits.size > 10_000) for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }
    entry.count += 1;
    return entry.count <= limit;
  };
}

/** The visitor's IP. Caddy sets X-Forwarded-For to the address it sees and ignores one the client sent. */
export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
}
