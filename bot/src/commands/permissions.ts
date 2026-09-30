import { GuildMember, InteractionContextType, Role, SlashCommandBuilder, User } from "discord.js";
import { api } from "../api.js";
import type { Command } from "../command.js";
import { ALL, PUBLIC_COMMANDS, commandsFor, grantsFor, isServerAdmin, refreshGrants, type Grant } from "../permissions.js";
import { COLORS, EPHEMERAL, actorOf, clip, embed, failure, respondError, success } from "../ui.js";
import { staffLog } from "../log.js";

/**
 * Grants a role or a person access to bot commands. Everything granted here
 * is also shown (and editable) on the website's Bot Permissions page.
 */

/** Every command a grant can name — kept in step with commands/index.ts. */
export const GRANTABLE = [
  { name: "announce", about: "Post and schedule announcements" },
  { name: "recruit", about: "Recruitment applications" },
  { name: "onboarding", about: "Onboarding requests" },
  { name: "loa", about: "Leave of Absence requests" },
  { name: "dept-app", about: "Department applications" },
  { name: "member", about: "Roster, ranks, call signs, status" },
  { name: "config", about: "Website notification settings" },
  { name: "joinlink", about: "Join link and its roles" },
  { name: "banner", about: "Website banner" },
  { name: "dm", about: "Message members as the bot" },
  { name: "permissions", about: "Give and remove bot access" },
] as const;

const label = (command: string) => (command === ALL ? "All commands" : `/${command}`);

const commandOption = (o: import("discord.js").SlashCommandStringOption) =>
  o
    .setName("command")
    .setDescription("Which command")
    .setRequired(true)
    .addChoices(
      { name: "All commands (everything except /permissions)", value: ALL },
      ...GRANTABLE.map((c) => ({ name: `/${c.name} — ${c.about}`, value: c.name }))
    );

const targetOption = (o: import("discord.js").SlashCommandMentionableOption) =>
  o.setName("to").setDescription("A role or a person").setRequired(true);

const data = new SlashCommandBuilder()
  .setName("permissions")
  .setDescription("Choose which roles and people can use the bot's commands")
  .setContexts(InteractionContextType.Guild)
  .addSubcommand((s) => s.setName("view").setDescription("Who can use what"))
  .addSubcommand((s) =>
    s
      .setName("grant")
      .setDescription("Let a role or person use a command (or all commands)")
      .addMentionableOption(targetOption)
      .addStringOption(commandOption)
  )
  .addSubcommand((s) =>
    s
      .setName("revoke")
      .setDescription("Take a command back from a role or person")
      .addMentionableOption(targetOption)
      .addStringOption(commandOption)
  )
  .addSubcommand((s) =>
    s
      .setName("check")
      .setDescription("Which commands someone can use")
      .addUserOption((o) => o.setName("user").setDescription("Who to check (default: you)"))
  )
  .addSubcommand((s) =>
    s
      .setName("clear")
      .setDescription("Remove every command from a role or person")
      .addMentionableOption(targetOption)
  );

function describeTarget(target: unknown): { type: "role" | "user"; id: string; name: string; mention: string } | null {
  if (target instanceof Role) return { type: "role", id: target.id, name: target.name, mention: `<@&${target.id}>` };
  if (target instanceof GuildMember) return { type: "user", id: target.id, name: target.displayName, mention: `<@${target.id}>` };
  if (target instanceof User) return { type: "user", id: target.id, name: target.globalName ?? target.username, mention: `<@${target.id}>` };
  // Uncached mentionables arrive as raw API objects.
  const raw = target as { id?: string; name?: string; username?: string; global_name?: string; permissions?: string } | null;
  if (raw?.id && raw.name !== undefined && raw.permissions !== undefined) return { type: "role", id: raw.id, name: raw.name, mention: `<@&${raw.id}>` };
  if (raw?.id) return { type: "user", id: raw.id, name: raw.global_name ?? raw.username ?? raw.id, mention: `<@${raw.id}>` };
  return null;
}

function overview(guildId: string) {
  const list = grantsFor(guildId);
  const e = embed(COLORS.info)
    .setTitle("🛡️  Bot permissions")
    .setDescription(
      "**Always allowed:** server administrators and the owner.\n" +
        `**Open to everyone:** ${[...PUBLIC_COMMANDS].map((c) => `/${c}`).join(", ")}.\n` +
        "**Everything else:** needs a grant — `/permissions grant`.\n" +
        "Also editable on the website: Admin → Bot Permissions."
    );
  if (list.length === 0) {
    e.addFields({ name: "Grants", value: "None yet — only administrators can use the staff commands." });
    return e;
  }
  const byTarget = new Map<string, Grant[]>();
  for (const g of list) {
    const key = `${g.targetType}:${g.targetId}`;
    byTarget.set(key, [...(byTarget.get(key) ?? []), g]);
  }
  const lines = [...byTarget.values()]
    .sort((a, b) => (a[0].targetType === b[0].targetType ? 0 : a[0].targetType === "role" ? -1 : 1))
    .map((gs) => {
      const who = gs[0].targetType === "role" ? `<@&${gs[0].targetId}>` : `<@${gs[0].targetId}>`;
      const cmds = gs.some((g) => g.command === ALL)
        ? `**All commands**${gs.some((g) => g.command === "permissions") ? " + /permissions" : ""}`
        : gs.map((g) => `\`/${g.command}\``).join(" ");
      return `${who} → ${cmds}`;
    });
  e.addFields({ name: `Grants · ${byTarget.size}`, value: clip(lines.join("\n"), 1024) });
  return e;
}

export const permissions: Command = {
  data,

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const actor = actorOf(interaction);
    const guildId = interaction.guildId;
    if (!guildId) return;

    try {
      await interaction.deferReply(EPHEMERAL);
      await refreshGrants(actor).catch(() => {});

      if (sub === "view") {
        await interaction.editReply({ embeds: [overview(guildId)] });
        return;
      }

      if (sub === "check") {
        const user = interaction.options.getUser("user") ?? interaction.user;
        const member = await interaction.guild?.members.fetch(user.id).catch(() => null);
        if (!member) {
          await interaction.editReply({ embeds: [failure("Not in this server", `<@${user.id}> is not a member here.`)] });
          return;
        }
        const admin = member.permissions.has("Administrator") || interaction.guild?.ownerId === member.id;
        const all = [...PUBLIC_COMMANDS, ...GRANTABLE.map((c) => c.name)];
        const allowed = commandsFor(guildId, member.id, [...member.roles.cache.keys()], admin, all);
        await interaction.editReply({
          embeds: [
            embed(COLORS.info)
              .setTitle(`🔎  ${member.displayName}`)
              .setDescription(admin ? "Server administrator — can use every command." : "Can use:")
              .addFields({ name: `${allowed.length} of ${all.length} commands`, value: allowed.map((c) => `\`/${c}\``).join(" ") || "None" }),
          ],
        });
        return;
      }

      const target = describeTarget(interaction.options.getMentionable("to", true));
      if (!target) {
        await interaction.editReply({ embeds: [failure("Pick a role or a person")] });
        return;
      }
      if (target.type === "role" && target.id === guildId) {
        // @everyone's role id is the server id.
        target.name = "everyone";
      }

      if (sub === "grant") {
        const command = interaction.options.getString("command", true);
        // Handing out /permissions is itself an administrator decision.
        if (command === "permissions" && !isServerAdmin(interaction)) {
          await interaction.editReply({ embeds: [failure("Administrators only", "Only a server administrator can give out /permissions.")] });
          return;
        }
        await api(actor, "POST", "/api/bot/permissions", { guildId, targetType: target.type, targetId: target.id, targetName: target.name, command });
        await refreshGrants(actor).catch(() => {});
        await staffLog(interaction.client, actor, `Gave ${label(command)} to ${target.type} ${target.name}`);
        await interaction.editReply({
          embeds: [success(`${target.name} can now use ${label(command)}`, `${target.mention} — takes effect immediately.`), overview(guildId)],
        });
        return;
      }

      const mine = grantsFor(guildId).filter((g) => g.targetType === target.type && g.targetId === target.id);
      const command = sub === "revoke" ? interaction.options.getString("command", true) : null;
      const toRemove = command ? mine.filter((g) => g.command === command) : mine;
      if (toRemove.length === 0) {
        const note =
          command && command !== ALL && mine.some((g) => g.command === ALL)
            ? ` They have **All commands** — revoke that, then grant the ones they should keep.`
            : "";
        await interaction.editReply({
          embeds: [failure("Nothing to remove", `${target.mention} does not have ${command ? label(command) : "any bot commands"}.${note}`)],
        });
        return;
      }
      for (const g of toRemove) await api(actor, "DELETE", `/api/bot/permissions/${g.id}`);
      await refreshGrants(actor).catch(() => {});
      await staffLog(interaction.client, actor, `Removed ${command ? label(command) : "all bot commands"} from ${target.type} ${target.name}`);
      await interaction.editReply({
        embeds: [success(`Removed ${command ? label(command) : "every command"} from ${target.name}`), overview(guildId)],
      });
    } catch (err) {
      await respondError(interaction, err);
    }
  },
};
