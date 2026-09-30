import { PermissionFlagsBits, type Client, type Interaction } from "discord.js";
import { api, type Actor } from "./api.js";

/**
 * Who may use which command.
 *
 * Grants live on the website (so they survive restarts and can be edited on
 * the Bot Permissions page too) and are cached here, refreshed every minute
 * and straight after /permissions changes them.
 *
 *   - Server administrators and the owner can use everything, always — nobody
 *     can lock the server out of its own bot.
 *   - PUBLIC commands are open to every member.
 *   - Anything else needs a grant to one of the member's roles or to them,
 *     for that command or for "*" (all commands except /permissions).
 *
 * If the grants have never loaded (website unreachable at start), only
 * administrators get through: closed, not open.
 */

export interface Grant {
  id: string;
  guildId: string;
  targetType: "role" | "user";
  targetId: string;
  targetName: string;
  command: string;
  grantedByName: string;
  createdAt: string;
}

export const ALL = "*";
export const PUBLIC_COMMANDS = new Set(["ems", "duty"]);
/** Never covered by "*": handing out access is granted on its own. */
const EXPLICIT_ONLY = new Set(["permissions"]);

let grants: Grant[] = [];
let loaded = false;
let lastError: string | null = null;

const REFRESH_MS = 60_000;

export async function refreshGrants(actor: Actor) {
  try {
    grants = await api<Grant[]>(actor, "GET", "/api/bot/permissions");
    loaded = true;
    lastError = null;
  } catch (err) {
    lastError = err instanceof Error ? err.message : String(err);
    throw err;
  }
}

export function grantsFor(guildId: string) {
  return grants.filter((g) => g.guildId === guildId);
}

export function permissionsStatus() {
  return { loaded, lastError };
}

export function startPermissions(client: Client<true>) {
  const actor: Actor = { id: client.user.id, name: "Permissions" };
  const tick = () =>
    refreshGrants(actor).catch((err) => {
      if (!loaded) console.warn(`[permissions] could not load grants — only server administrators can use staff commands until it works: ${err instanceof Error ? err.message : err}`);
    });
  void tick().then(() => {
    if (loaded) console.log(`[permissions] ${grants.length} grant(s) loaded`);
  });
  setInterval(tick, REFRESH_MS);
}

export function isServerAdmin(interaction: Interaction) {
  if (!interaction.inGuild()) return false;
  if (interaction.guild?.ownerId === interaction.user.id) return true;
  return interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ?? false;
}

function memberRoleIds(interaction: Interaction): string[] {
  const member = interaction.member;
  if (!member) return [];
  // Cached members carry a manager; raw interaction members carry an id list.
  const roles = (member as { roles: unknown }).roles;
  if (Array.isArray(roles)) return roles as string[];
  if (roles && typeof roles === "object" && "cache" in roles) {
    return [...(roles as { cache: Map<string, unknown> }).cache.keys()];
  }
  return [];
}

/** Whether this person may use `command` here. */
export function canUse(interaction: Interaction, command: string): boolean {
  if (PUBLIC_COMMANDS.has(command)) return true;
  if (!interaction.inGuild()) return false;
  if (isServerAdmin(interaction)) return true;
  if (!loaded) return false;

  const roleIds = new Set(memberRoleIds(interaction));
  return grants.some(
    (g) =>
      g.guildId === interaction.guildId &&
      (g.command === command || (g.command === ALL && !EXPLICIT_ONLY.has(command))) &&
      ((g.targetType === "user" && g.targetId === interaction.user.id) || (g.targetType === "role" && roleIds.has(g.targetId)))
  );
}

/** The commands a member can use, for /permissions check. */
export function commandsFor(guildId: string, userId: string, roleIds: string[], admin: boolean, all: string[]) {
  if (admin) return all;
  const roles = new Set(roleIds);
  const mine = grants.filter(
    (g) => g.guildId === guildId && ((g.targetType === "user" && g.targetId === userId) || (g.targetType === "role" && roles.has(g.targetId)))
  );
  return all.filter(
    (c) => PUBLIC_COMMANDS.has(c) || mine.some((g) => g.command === c || (g.command === ALL && !EXPLICIT_ONLY.has(c)))
  );
}
