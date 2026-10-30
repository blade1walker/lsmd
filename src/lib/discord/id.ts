/**
 * Discord user IDs. A username typed in place of one looks fine on the roster
 * but cannot be pinged, cannot be DM'd, and cannot sign in, so it is refused on
 * the way in and made harmless on the way out. Safe to use in the browser.
 */

const DISCORD_ID = /^\d{17,20}$/;

/** Shown wherever an ID is asked for or refused. */
export const DISCORD_ID_HELP =
  "A Discord ID is a long number, not a username. In Discord, turn on Settings → Advanced → Developer Mode, then right-click the profile and choose Copy User ID.";

export function isDiscordId(value: unknown): value is string {
  return typeof value === "string" && DISCORD_ID.test(value);
}

/** The ID from what someone typed or pasted, including a <@123> mention; null when it is not one. */
export function parseDiscordId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const id = raw.trim().replace(/^<@!?(.*)>$/, "$1").trim();
  return isDiscordId(id) ? id : null;
}

/**
 * Keeps a bad ID on an older record from printing as a raw "<@fauzan_2205>":
 * it reads "@fauzan_2205" instead, and an empty one disappears. Real user
 * mentions and role mentions (<@&123>) are left alone.
 */
export function safeMentions(text: string): string {
  return text.replace(/<@(?!&)!?([^\s>]*)>/g, (mention, id: string) => {
    if (isDiscordId(id)) return mention;
    return id ? `@${id}` : "";
  });
}
