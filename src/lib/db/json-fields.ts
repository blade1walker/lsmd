/**
 * Lists kept in JSON columns (role permissions, required departments): read
 * back as a list of strings, whatever is actually stored.
 */
export function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}
