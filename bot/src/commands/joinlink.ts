import { ChannelType, InteractionContextType, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import type { Command } from "../command.js";
import { DEFAULT_ROLE_NAMES, getJoinLink, problems, refreshSnapshot, resolveRoles, saveJoinLink } from "../joinlink.js";
import { COLORS, EPHEMERAL, actorOf, embed, failure, respondError, success } from "../ui.js";
import { staffLog } from "../log.js";

const data = new SlashCommandBuilder()
  .setName("joinlink")
  .setDescription("An invite link that gives new members the EMS Recruit and EMS roles")
  .setContexts(InteractionContextType.Guild)
  .addSubcommand((s) => s.setName("view").setDescription("The link, its roles, and anything stopping it from working"))
  .addSubcommand((s) =>
    s
      .setName("create")
      .setDescription("Create a new permanent invite link and use it")
      .addChannelOption((o) =>
        o
          .setName("channel")
          .setDescription("Where new members land")
          .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
          .setRequired(true)
      )
  )
  .addSubcommand((s) =>
    s
      .setName("use")
      .setDescription("Use an invite link you already share")
      .addStringOption((o) => o.setName("link").setDescription("discord.gg/… link or invite code").setRequired(true))
  )
  .addSubcommand((s) =>
    s
      .setName("roles")
      .setDescription(`Choose the roles given (default: ${DEFAULT_ROLE_NAMES.join(" and ")})`)
      .addRoleOption((o) => o.setName("first").setDescription("e.g. EMS Recruit").setRequired(true))
      .addRoleOption((o) => o.setName("second").setDescription("e.g. EMS"))
      .addRoleOption((o) => o.setName("third").setDescription("Another role (optional)"))
  )
  .addSubcommand((s) => s.setName("reset-roles").setDescription(`Go back to the roles named ${DEFAULT_ROLE_NAMES.join(" and ")}`))
  .addSubcommand((s) =>
    s
      .setName("enabled")
      .setDescription("Turn role-giving on or off (the link keeps working either way)")
      .addBooleanOption((o) => o.setName("on").setDescription("On or off").setRequired(true))
  );

function statusEmbed(guild: import("discord.js").Guild) {
  const link = getJoinLink();
  const { roles } = resolveRoles(guild);
  const issues = problems(guild);
  const e = embed(issues.length ? COLORS.warning : COLORS.success)
    .setTitle("🔗  EMS join link")
    .addFields(
      { name: "Link", value: link?.code ? `https://discord.gg/${link.code}` : "Not set — `/joinlink create`", inline: true },
      { name: "Giving roles", value: link?.enabled === false ? "⚫ Off" : "🟢 On", inline: true },
      {
        name: link?.roleIds.length ? "Roles" : "Roles (default, by name)",
        value: roles.length ? roles.map((r) => r.toString()).join(" ") : "None found",
        inline: true,
      },
      {
        name: issues.length ? `⚠️ ${issues.length} problem(s)` : "Checks",
        value: issues.length ? issues.map((i) => `• ${i}`).join("\n").slice(0, 1024) : "✅ Ready — anyone joining through this link gets the roles.",
      }
    );
  if (link?.channelId) e.addFields({ name: "Lands in", value: `<#${link.channelId}>`, inline: true });
  return e;
}

export const joinlink: Command = {
  data,

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const actor = actorOf(interaction);
    const guild = interaction.guild;
    if (!guild) return;

    try {
      await interaction.deferReply(EPHEMERAL);

      if (sub === "view") {
        await interaction.editReply({ embeds: [statusEmbed(guild)] });
        return;
      }

      if (sub === "create") {
        const channel = interaction.options.getChannel("channel", true);
        const target = await guild.channels.fetch(channel.id);
        if (!target || !("createInvite" in target)) {
          await interaction.editReply({ embeds: [failure("Cannot create an invite there")] });
          return;
        }
        if (!target.permissionsFor(guild.members.me!).has(PermissionFlagsBits.CreateInstantInvite)) {
          await interaction.editReply({ embeds: [failure("Missing permission", `The bot needs **Create Invite** in ${target}.`)] });
          return;
        }
        const invite = await target.createInvite({
          maxAge: 0,
          maxUses: 0,
          unique: true,
          reason: `EMS join link, created by ${interaction.user.tag}`,
        });
        await saveJoinLink(actor, { guildId: guild.id, code: invite.code, channelId: target.id, enabled: true });
        await refreshSnapshot(guild);
        await staffLog(interaction.client, actor, "Created the EMS join link", invite.url);
        await interaction.editReply({
          embeds: [success("Join link created", `Share **${invite.url}** — it never expires.`), statusEmbed(guild)],
        });
        return;
      }

      if (sub === "use") {
        const raw = interaction.options.getString("link", true).trim();
        const code = raw.replace(/^https?:\/\/(www\.)?(discord\.gg|discord(app)?\.com\/invite)\//i, "").replace(/[/?#].*$/, "");
        const invites = await guild.invites.fetch().catch(() => null);
        if (!invites) {
          await interaction.editReply({ embeds: [failure("Cannot read invites", "The bot needs **Manage Server** to see this server's invites.")] });
          return;
        }
        const invite = invites.get(code);
        if (!invite) {
          await interaction.editReply({ embeds: [failure("Invite not found", `\`${code}\` is not an invite to this server.`)] });
          return;
        }
        await saveJoinLink(actor, { guildId: guild.id, code: invite.code, channelId: invite.channelId, enabled: true });
        await refreshSnapshot(guild);
        await staffLog(interaction.client, actor, "Set the EMS join link", invite.url);
        const note = invite.maxAge || invite.maxUses ? "\n\n⚠️ This invite expires or has a use limit — once it runs out, joins are no longer counted." : "";
        await interaction.editReply({ embeds: [success("Join link set", `**${invite.url}**${note}`), statusEmbed(guild)] });
        return;
      }

      if (sub === "roles" || sub === "reset-roles") {
        const picked =
          sub === "roles"
            ? (["first", "second", "third"] as const)
                .map((n) => interaction.options.getRole(n))
                .filter((r): r is NonNullable<typeof r> => !!r)
            : [];
        const roleIds = [...new Set(picked.map((r) => r.id))];
        await saveJoinLink(actor, { roleIds });
        await staffLog(
          interaction.client,
          actor,
          "Changed the EMS join link roles",
          roleIds.length ? roleIds.map((id) => `<@&${id}>`).join(" ") : `Default: ${DEFAULT_ROLE_NAMES.join(", ")}`
        );
        await interaction.editReply({ embeds: [success("Roles updated"), statusEmbed(guild)] });
        return;
      }

      if (sub === "enabled") {
        const on = interaction.options.getBoolean("on", true);
        await saveJoinLink(actor, { enabled: on });
        await staffLog(interaction.client, actor, `Turned join-link roles ${on ? "on" : "off"}`);
        await interaction.editReply({ embeds: [success(`Join-link roles are ${on ? "on" : "off"}`), statusEmbed(guild)] });
      }
    } catch (err) {
      await respondError(interaction, err);
    }
  },
};
