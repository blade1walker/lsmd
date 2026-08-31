/**
 * Adds/removes a Discord server (guild) role on a member — distinct from the
 * webhook posts and DMs in discord-webhook.ts, which never touch guild
 * membership. Requires DISCORD_BOT_TOKEN with Manage Roles, positioned above
 * the target role in the server's role list, plus DISCORD_GUILD_ID.
 *
 * Every function here degrades to a silent no-op when its configuration is
 * missing, matching how the rest of the app treats DISCORD_BOT_TOKEN — inert
 * rather than broken until it's set up.
 */

async function setGuildRole(discordId: string, roleId: string, action: "add" | "remove"): Promise<boolean> {
  const botToken = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;
  if (!botToken || !guildId) return false;

  try {
    const res = await fetch(
      `https://discord.com/api/v10/guilds/${guildId}/members/${discordId}/roles/${roleId}`,
      {
        method: action === "add" ? "PUT" : "DELETE",
        headers: { Authorization: `Bot ${botToken}` },
      }
    );
    // Discord returns 204 with an empty body on success for both verbs.
    if (!res.ok) {
      console.error(
        `Failed to ${action} Discord role ${roleId} for ${discordId}: ${res.status} ${await res.text()}`
      );
    }
    return res.ok;
  } catch (err) {
    console.error(`Failed to ${action} Discord role ${roleId} for ${discordId}:`, err);
    return false;
  }
}

/**
 * Grants a department's configured guild role. Departments each carry their
 * own optional discordRoleId, so this takes the role rather than reading one
 * fixed env var the way the FTP helpers below do.
 */
export async function addDepartmentDiscordRole(
  discordId: string,
  roleId: string | null | undefined
): Promise<boolean> {
  if (!discordId || !roleId) return false;
  return setGuildRole(discordId, roleId, "add");
}

export async function removeDepartmentDiscordRole(
  discordId: string,
  roleId: string | null | undefined
): Promise<boolean> {
  if (!discordId || !roleId) return false;
  return setGuildRole(discordId, roleId, "remove");
}

export async function addFtpDiscordRole(discordId: string): Promise<boolean> {
  const roleId = process.env.DISCORD_FTP_ROLE_ID;
  if (!roleId) return false;
  return setGuildRole(discordId, roleId, "add");
}

export async function removeFtpDiscordRole(discordId: string): Promise<boolean> {
  const roleId = process.env.DISCORD_FTP_ROLE_ID;
  if (!roleId) return false;
  return setGuildRole(discordId, roleId, "remove");
}
