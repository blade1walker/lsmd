import {
  GatewayIntentBits,
  PermissionFlagsBits,
  type Client,
  type Guild,
  type GuildMember,
  type PartialGuildMember,
  type Role,
} from "discord.js";
import { api, type Actor } from "./api.js";
import { config } from "./config.js";
import { staffLog } from "./log.js";

/**
 * Roles for people who join through the bot's invite link.
 *
 * Discord does not say which invite a member used, so the bot keeps every
 * invite's use count and, when someone joins, looks for the one that went up.
 * If that is the configured link, the member gets its roles — by default the
 * server's "EMS Recruit" and "EMS" roles.
 *
 * The setting is stored on the website (botSettings.joinLink), so it survives
 * the bot restarting or moving host, and is changed with /joinlink.
 */

export interface JoinLinkSettings {
  /** The server the link belongs to. Older settings without it use DISCORD_GUILD_ID. */
  guildId?: string;
  code: string;
  channelId: string | null;
  /** Empty means "look the default roles up by name". */
  roleIds: string[];
  enabled: boolean;
}

/** Used when no roles are configured — matched case-insensitively. */
export const DEFAULT_ROLE_NAMES = ["EMS Recruit", "EMS"];

let settings: JoinLinkSettings | null = null;
const uses = new Map<string, number>();

/** Joins wait for members who have not yet accepted the server rules. */
const awaitingScreening = new Map<string, string[]>();

type BotSettings = Record<string, unknown> & { joinLink?: JoinLinkSettings };

function actorFor(client: Client): Actor {
  return { id: client.user!.id, name: "Join link" };
}

export function getJoinLink() {
  return settings;
}

function linkGuildId() {
  return settings?.guildId ?? config.guildId;
}

export async function loadJoinLink(client: Client) {
  const s = await api<{ botSettings: BotSettings | null }>(actorFor(client), "GET", "/api/admin/notification-settings");
  settings = s.botSettings?.joinLink ?? null;
  return settings;
}

/**
 * Saves a change. Read-modify-write of the whole botSettings object, because
 * the site stores it as one JSON value alongside the bot token and invites.
 */
export async function saveJoinLink(actor: Actor, patch: Partial<JoinLinkSettings>) {
  const s = await api<{ botSettings: BotSettings | null }>(actor, "GET", "/api/admin/notification-settings");
  const current = s.botSettings?.joinLink ?? { code: "", channelId: null, roleIds: [], enabled: true };
  const next: JoinLinkSettings = { ...current, ...patch };
  await api(actor, "PATCH", "/api/admin/notification-settings", {
    botSettings: { ...(s.botSettings ?? {}), joinLink: next },
  });
  settings = next;
  return next;
}

/** The roles a join through the link receives: the configured ones, or the defaults by name. */
export function resolveRoles(guild: Guild): { roles: Role[]; missing: string[] } {
  if (settings?.roleIds.length) {
    const roles = settings.roleIds.map((id) => guild.roles.cache.get(id)).filter((r): r is Role => !!r);
    const missing = settings.roleIds.filter((id) => !guild.roles.cache.has(id)).map((id) => `deleted role ${id}`);
    return { roles, missing };
  }
  const roles: Role[] = [];
  const missing: string[] = [];
  for (const name of DEFAULT_ROLE_NAMES) {
    const role = guild.roles.cache.find((r) => r.name.toLowerCase() === name.toLowerCase());
    if (role) roles.push(role);
    else missing.push(`a role named "${name}"`);
  }
  return { roles, missing };
}

/**
 * Everything that would stop the roles being given, in words an admin can
 * fix — shown by /joinlink view, and checked before the link is saved.
 */
export function problems(guild: Guild): string[] {
  const out: string[] = [];
  const me = guild.members.me;
  const client = guild.client;

  if (!client.options.intents.has(GatewayIntentBits.GuildMembers)) {
    out.push(
      "**Server Members Intent** is off — turn it on in the Developer Portal → Bot → Privileged Gateway Intents, then restart the bot. Without it the bot is never told that someone joined."
    );
  }
  if (!me) return [...out, "The bot is not in this server."];
  if (!me.permissions.has(PermissionFlagsBits.ManageGuild)) {
    out.push("The bot needs **Manage Server** — Discord only shows invite use counts to members who have it.");
  }
  if (!me.permissions.has(PermissionFlagsBits.ManageRoles)) {
    out.push("The bot needs **Manage Roles** to give the roles.");
  }

  const { roles, missing } = resolveRoles(guild);
  for (const m of missing) out.push(`Could not find ${m}. Create it, or pick roles with \`/joinlink roles\`.`);
  for (const role of roles) {
    if (role.managed) out.push(`${role} belongs to an integration and cannot be given by hand.`);
    else if (role.position >= me.roles.highest.position) {
      out.push(`${role} is above the bot's highest role — drag the bot's role above it in Server Settings → Roles.`);
    }
  }
  if (settings && !settings.code) out.push("No invite link yet — create one with `/joinlink create`.");
  return out;
}

async function snapshot(guild: Guild) {
  const invites = await guild.invites.fetch();
  uses.clear();
  for (const invite of invites.values()) uses.set(invite.code, invite.uses ?? 0);
  return invites;
}

// Joins are handled one at a time: each compares use counts against the
// snapshot the previous one left, so two joins at once cannot both claim the
// same increment.
let queue: Promise<void> = Promise.resolve();

async function giveRoles(member: GuildMember, roles: Role[]) {
  await member.roles.add(roles, "Joined through the EMS invite link");
  await staffLog(
    member.client,
    { id: member.id },
    `Gave join-link roles to ${member.user.tag}`,
    `${member} joined through the EMS invite link and received ${roles.map((r) => r.toString()).join(", ")}.`
  );
}

async function onJoin(member: GuildMember) {
  if (member.user.bot || !settings?.enabled || !settings.code) return;
  if (member.guild.id !== linkGuildId()) return;

  const before = uses.get(settings.code) ?? 0;
  let after: number;
  try {
    const invites = await snapshot(member.guild);
    const link = invites.get(settings.code);
    if (!link) {
      console.warn(`[joinlink] invite ${settings.code} no longer exists — create a new one with /joinlink create`);
      return;
    }
    after = link.uses ?? 0;
  } catch (err) {
    console.warn("[joinlink] could not read invites (does the bot have Manage Server?):", err instanceof Error ? err.message : err);
    return;
  }
  if (after <= before) return;

  const { roles } = resolveRoles(member.guild);
  const givable = roles.filter((r) => !r.managed && r.position < (member.guild.members.me?.roles.highest.position ?? 0));
  if (givable.length === 0) {
    console.warn("[joinlink] a member joined through the link, but there are no roles the bot can give — see /joinlink view");
    return;
  }

  // Someone still on the rules screen cannot hold roles yet; give them once they accept.
  if (member.pending) {
    awaitingScreening.set(member.id, givable.map((r) => r.id));
    return;
  }
  try {
    await giveRoles(member, givable);
  } catch (err) {
    console.error(`[joinlink] could not give roles to ${member.user.tag}:`, err);
  }
}

async function onScreeningPassed(before: GuildMember | PartialGuildMember, after: GuildMember) {
  if (!before.pending || after.pending) return;
  const roleIds = awaitingScreening.get(after.id);
  if (!roleIds) return;
  awaitingScreening.delete(after.id);
  const roles = roleIds.map((id) => after.guild.roles.cache.get(id)).filter((r): r is Role => !!r);
  if (roles.length) await giveRoles(after, roles).catch((err) => console.error("[joinlink] could not give roles:", err));
}

/** Wires the tracker into the client. Called once the client is ready. */
export async function startJoinLink(client: Client<true>) {
  try {
    await loadJoinLink(client);
  } catch (err) {
    console.warn("[joinlink] could not load the setting from the website:", err instanceof Error ? err.message : err);
  }

  const id = linkGuildId();
  const guild = id ? client.guilds.cache.get(id) : undefined;
  if (guild) {
    await snapshot(guild).catch(() => console.warn("[joinlink] cannot read invites yet — the bot needs Manage Server"));
  }

  client.on("inviteCreate", (invite) => {
    uses.set(invite.code, invite.uses ?? 0);
  });
  client.on("inviteDelete", (invite) => {
    uses.delete(invite.code);
  });
  client.on("guildMemberAdd", (member) => {
    queue = queue.then(() => onJoin(member)).catch((err) => console.error("[joinlink]", err));
  });
  client.on("guildMemberUpdate", (before, after) => {
    void onScreeningPassed(before, after);
  });

  if (settings?.enabled && settings.code && guild) {
    const issues = problems(guild);
    if (issues.length) console.warn(`[joinlink] ${issues.length} problem(s) — run /joinlink view:\n  - ${issues.join("\n  - ")}`);
  }
}

/** Refresh the snapshot after /joinlink creates or adopts a link, so the next join is counted. */
export async function refreshSnapshot(guild: Guild) {
  await snapshot(guild).catch(() => {});
}
