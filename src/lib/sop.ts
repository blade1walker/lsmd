/**
 * Id used for the synthetic document served from the legacy SopContent row
 * when the SopDocument table does not exist yet.
 *
 * It is not a real row, so it cannot be edited or deleted — the write routes
 * reject it with an explanation rather than failing with a foreign key error.
 */
export const LEGACY_DOC_ID = "__legacy_sop__";

export interface RelatedLink {
  label: string;
  url: string;
}

const MAX_RELATED_LINKS = 20;

/**
 * Normalizes and validates the relatedLinks array from a request body before
 * it reaches the JSON column — the client always resends the full list on
 * save, so a malformed entry here would otherwise silently corrupt every
 * link on the document, not just the one being edited.
 */
export function parseRelatedLinks(input: unknown): RelatedLink[] | { error: string } {
  if (!Array.isArray(input)) return { error: "relatedLinks must be an array" };
  if (input.length > MAX_RELATED_LINKS) return { error: `relatedLinks cannot exceed ${MAX_RELATED_LINKS} entries` };

  const links: RelatedLink[] = [];
  for (const entry of input) {
    if (typeof entry !== "object" || entry === null) return { error: "Each related link must be an object" };
    const { label, url } = entry as Record<string, unknown>;
    if (typeof label !== "string" || !label.trim()) return { error: "Each related link needs a label" };
    if (typeof url !== "string" || !/^https?:\/\//i.test(url.trim())) {
      return { error: `Related link "${label}" needs a valid http(s) URL` };
    }
    links.push({ label: label.trim(), url: url.trim() });
  }
  return links;
}
