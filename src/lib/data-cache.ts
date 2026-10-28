/**
 * A small in-process read cache for data every visitor asks for (the roster,
 * homepage counts, who is signed in, the FiveM server's status). The database
 * is a local SQLite file now, so this no longer hides a slow network: it
 * saves building the same large answers again — the roster page renders in
 * about half the time from here — on a 1 GB server.
 *
 * Freshness: every write made through Prisma bumps a generation counter
 * (src/lib/prisma.ts), and an entry from an older generation is never served.
 * So a change made on this server shows up on the very next request; the TTL
 * only bounds staleness from writes this process cannot see (another server
 * instance, or someone editing the database directly).
 */

interface Entry {
  generation: number;
  storedAt: number;
  value: Promise<unknown>;
}

declare global {
  // On globalThis so every bundled copy of this module shares one cache.
  var __lsmdDataGeneration: number | undefined;
  var __lsmdDataCache: Map<string, Entry> | undefined;
}

const MAX_ENTRIES = 2000;

/** Marks everything cached so far as stale. Called after every database write. */
export function bumpDataGeneration() {
  globalThis.__lsmdDataGeneration = (globalThis.__lsmdDataGeneration ?? 0) + 1;
}

/**
 * Returns the cached result for `key`, or runs `load` and caches it. Callers
 * that ask while a load is in flight share it instead of querying again.
 * A failed load is not cached.
 */
export function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const store = (globalThis.__lsmdDataCache ??= new Map());
  const generation = globalThis.__lsmdDataGeneration ?? 0;

  const hit = store.get(key);
  if (hit && hit.generation === generation && Date.now() - hit.storedAt < ttlMs) {
    return hit.value as Promise<T>;
  }

  if (store.size >= MAX_ENTRIES) store.clear();
  const value = load();
  const entry: Entry = { generation, storedAt: Date.now(), value };
  store.set(key, entry);
  value.catch(() => {
    if (store.get(key) === entry) store.delete(key);
  });
  return value;
}
