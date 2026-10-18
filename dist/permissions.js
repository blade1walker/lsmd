import { PermissionFlagsBits } from "discord.js";
import { api } from "./api.js";
import { config } from "./config.js";
export const ALL = "*";
export const PUBLIC_COMMANDS = new Set(["ems", "duty", "city"]);
/** Never covered by "*": handing out access is granted on its own. */
const EXPLICIT_ONLY = new Set(["permissions"]);
let grants = [];
let loaded = false;
let lastError = null;
let refreshedAt = 0;
/**
 * Was one minute. Every refresh is a database read on the website, and
 * asking that often kept the database awake around the clock until its
 * host's monthly quota ran out.
 */
const REFRESH_MS = 30 * 60_000;
/** A denial re-checks the website at most this often, so spamming a command cannot. */
const RECHECK_MS = 30_000;
/** Discord wants an answer within 3 seconds; a re-check never holds the reply longer than this. */
const RECHECK_WAIT_MS = 1_500;
export async function refreshGrants(actor) {
    refreshedAt = Date.now();
    try {
        grants = await api(actor, "GET", "/api/bot/permissions");
        loaded = true;
        lastError = null;
    }
    catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        throw err;
    }
}
export function grantsFor(guildId) {
    return grants.filter((g) => g.guildId === guildId);
}
/**
 * Why grants are not in effect, or null when they are. Shown in Discord so a
 * broken website link is visible there, not only in the host's log.
 */
export function grantsProblem() {
    if (loaded && !lastError)
        return null;
    const reason = lastError ?? (config.websiteProblem || "the bot has not reached the website yet");
    return loaded
        ? `The last refresh from the website failed, so recent changes may not apply yet: ${reason}`
        : `The bot could not load the grants from the website, so only server administrators can use staff commands: ${reason}`;
}
export function startPermissions(client) {
    const actor = { id: client.user.id, name: "Permissions" };
    const tick = () => refreshGrants(actor).catch((err) => {
        if (!loaded)
            console.warn(`[permissions] could not load grants — only server administrators can use staff commands until it works: ${err instanceof Error ? err.message : err}`);
    });
    void tick().then(() => {
        if (loaded)
            console.log(`[permissions] ${grants.length} grant(s) loaded`);
    });
    setInterval(tick, REFRESH_MS);
}
/**
 * canUse, but before turning someone away it re-reads the grants if they are
 * more than a moment old — grants made on the website reach the bot only on
 * the half-hourly refresh otherwise.
 */
export async function canUseFresh(interaction, command) {
    if (canUse(interaction, command))
        return true;
    if (!interaction.inGuild() || Date.now() - refreshedAt < RECHECK_MS)
        return false;
    const actor = { id: interaction.client.user.id, name: "Permissions" };
    await Promise.race([refreshGrants(actor).catch(() => { }), new Promise((r) => setTimeout(r, RECHECK_WAIT_MS))]);
    return canUse(interaction, command);
}
export function isServerAdmin(interaction) {
    if (!interaction.inGuild())
        return false;
    if (interaction.guild?.ownerId === interaction.user.id)
        return true;
    return interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ?? false;
}
function memberRoleIds(interaction) {
    const member = interaction.member;
    if (!member)
        return [];
    // Cached members carry a manager; raw interaction members carry an id list.
    const roles = member.roles;
    if (Array.isArray(roles))
        return roles;
    if (roles && typeof roles === "object" && "cache" in roles) {
        return [...roles.cache.keys()];
    }
    return [];
}
/** Whether this person may use `command` here. */
export function canUse(interaction, command) {
    if (PUBLIC_COMMANDS.has(command))
        return true;
    if (!interaction.inGuild())
        return false;
    if (isServerAdmin(interaction))
        return true;
    if (!loaded)
        return false;
    const roleIds = new Set(memberRoleIds(interaction));
    return grants.some((g) => g.guildId === interaction.guildId &&
        (g.command === command || (g.command === ALL && !EXPLICIT_ONLY.has(command))) &&
        ((g.targetType === "user" && g.targetId === interaction.user.id) || (g.targetType === "role" && roleIds.has(g.targetId))));
}
/** The commands a member can use, for /permissions check. */
export function commandsFor(guildId, userId, roleIds, admin, all) {
    if (admin)
        return all;
    const roles = new Set(roleIds);
    const mine = grants.filter((g) => g.guildId === guildId && ((g.targetType === "user" && g.targetId === userId) || (g.targetType === "role" && roles.has(g.targetId))));
    return all.filter((c) => PUBLIC_COMMANDS.has(c) || mine.some((g) => g.command === c || (g.command === ALL && !EXPLICIT_ONLY.has(c))));
}
//# sourceMappingURL=permissions.js.map