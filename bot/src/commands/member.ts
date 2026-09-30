import { InteractionContextType, SlashCommandBuilder } from "discord.js";
import { api } from "../api.js";
import type { Command } from "../command.js";
import { ACTIVITY, RANKS, invalidateRoster, matchMembers, memberLabel, members } from "../data.js";
import { discordTime } from "../time.js";
import { COLORS, EPHEMERAL, actorOf, clip, embed, failure, respondError, statusBadge, success } from "../ui.js";
import { staffLog } from "../log.js";

const memberOption = (o: import("discord.js").SlashCommandStringOption) =>
  o.setName("member").setDescription("Name, call sign or Discord ID").setRequired(true).setAutocomplete(true);

const data = new SlashCommandBuilder()
  .setName("member")
  .setDescription("Look up and manage roster members")
  .setContexts(InteractionContextType.Guild)
  .setDefaultMemberPermissions(0n)
  .addSubcommand((s) => s.setName("info").setDescription("A member's roster record").addStringOption(memberOption))
  .addSubcommand((s) =>
    s
      .setName("rank")
      .setDescription("Promote or demote a member — announced as configured on the website")
      .addStringOption(memberOption)
      .addStringOption((o) =>
        o
          .setName("rank")
          .setDescription("New rank")
          .setRequired(true)
          .addChoices(...RANKS.map((r) => ({ name: r, value: r })))
      )
  )
  .addSubcommand((s) =>
    s
      .setName("callsign")
      .setDescription("Change a member's call sign")
      .addStringOption(memberOption)
      .addStringOption((o) => o.setName("callsign").setDescription("New call sign").setRequired(true).setMaxLength(10))
  )
  .addSubcommand((s) =>
    s
      .setName("status")
      .setDescription("Set a member Active, Reserve or on LOA")
      .addStringOption(memberOption)
      .addStringOption((o) =>
        o
          .setName("status")
          .setDescription("Roster status")
          .setRequired(true)
          .addChoices(...ACTIVITY.map((a) => ({ name: a, value: a })))
      )
  )
  .addSubcommand((s) =>
    s
      .setName("find")
      .setDescription("Find the roster entry linked to a Discord user")
      .addUserOption((o) => o.setName("user").setDescription("Discord user").setRequired(true))
  );

type Found = Awaited<ReturnType<typeof members>>[number];

function card(m: Found) {
  const loa = m.loas?.[0];
  const e = embed(m.activity === "Active" ? COLORS.success : m.activity === "LOA" ? COLORS.warning : COLORS.info)
    .setTitle(clip(memberLabel(m), 250))
    .addFields(
      { name: "Rank", value: m.rank, inline: true },
      { name: "Call sign", value: m.callSign ?? "—", inline: true },
      { name: "Status", value: statusBadge(m.activity), inline: true },
      { name: "Section", value: m.section, inline: true },
      { name: "Discord", value: m.discordId ? `<@${m.discordId}>` : "Not linked", inline: true },
      { name: "State ID", value: m.stateId ?? "—", inline: true },
      { name: "Joined", value: m.dateOfJoining ? discordTime(m.dateOfJoining, "d") : "—", inline: true },
      { name: "Last promotion", value: m.lastPromotion ? discordTime(m.lastPromotion, "d") : "—", inline: true }
    )
    .setFooter({ text: `ID ${m.id}` });
  if (loa) e.addFields({ name: "On leave", value: `${discordTime(loa.startDate, "d")} → ${discordTime(loa.endDate, "d")}\n${clip(loa.reason, 900)}` });
  return e;
}

export const member: Command = {
  data,

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const actor = actorOf(interaction);
    try {
      await interaction.deferReply(EPHEMERAL);
      const all = await members(actor, true);

      if (sub === "find") {
        const user = interaction.options.getUser("user", true);
        const m = all.find((x) => x.discordId === user.id);
        await interaction.editReply({
          embeds: [m ? card(m) : failure("Not on the roster", `<@${user.id}> is not linked to any roster entry.`)],
        });
        return;
      }

      const id = interaction.options.getString("member", true);
      const m = all.find((x) => x.id === id) ?? matchMembers(all, id, 1)[0];
      if (!m) {
        await interaction.editReply({ embeds: [failure("Member not found", "Pick a member from the suggestions.")] });
        return;
      }

      if (sub === "info") {
        await interaction.editReply({ embeds: [card(m)] });
        return;
      }

      const patch: Record<string, string> = {};
      let action = "";
      if (sub === "rank") {
        patch.rank = interaction.options.getString("rank", true);
        if (patch.rank === m.rank) {
          await interaction.editReply({ embeds: [failure("No change", `${m.name} is already ${m.rank}.`)] });
          return;
        }
        const up = RANKS.indexOf(patch.rank as (typeof RANKS)[number]) < RANKS.indexOf(m.rank as (typeof RANKS)[number]);
        action = `${up ? "Promoted" : "Moved"} ${m.name}: ${m.rank} → ${patch.rank}`;
      } else if (sub === "callsign") {
        patch.callSign = interaction.options.getString("callsign", true).trim();
        action = `Changed ${m.name}'s call sign: ${m.callSign ?? "none"} → ${patch.callSign}`;
      } else if (sub === "status") {
        patch.activity = interaction.options.getString("status", true);
        action = `Set ${m.name} to ${patch.activity}`;
      }

      await api(actor, "PATCH", `/api/members/${encodeURIComponent(m.id)}`, patch);
      invalidateRoster();
      const updated = (await members(actor, true)).find((x) => x.id === m.id) ?? m;
      await staffLog(interaction.client, actor, action);
      await interaction.editReply({ embeds: [success(action), card(updated)] });
    } catch (err) {
      await respondError(interaction, err);
    }
  },

  async autocomplete(interaction) {
    try {
      const all = await members(actorOf(interaction));
      await interaction.respond(
        matchMembers(all, interaction.options.getFocused()).map((m) => ({ name: clip(memberLabel(m), 100), value: m.id }))
      );
    } catch {
      await interaction.respond([]).catch(() => {});
    }
  },
};
