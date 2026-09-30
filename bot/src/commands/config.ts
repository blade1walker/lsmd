import {
  ActionRowBuilder,
  InteractionContextType,
  ModalBuilder,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { api } from "../api.js";
import { customId, type Command } from "../command.js";
import { COLORS, EPHEMERAL, actorOf, clip, embed, failure, respondError, success } from "../ui.js";
import { staffLog } from "../log.js";

/**
 * The website's notification settings — which events DM the member or post
 * to a channel, the message text for each, and the channel webhooks. Mirrors
 * Admin → Notification settings; field names are the site's own.
 */

const BOOLEAN_FIELDS = [
  "recruitWebhook", "recruitDM", "onboardingWebhook", "onboardingDM", "ftpWebhook", "ftpDM",
  "departmentWebhook", "departmentDM", "loaWebhook", "loaDM", "loaReminderDM", "loaExpiredDM",
  "promotionWebhook", "demotionWebhook", "callsignWebhook", "testWebhook", "testDM",
] as const;

const MESSAGE_FIELDS = [
  "recruitWebhookApprove", "recruitWebhookDecline", "recruitDMApprove", "recruitDMDecline",
  "onboardingWebhookMessage", "onboardingDMApprove", "onboardingDMDecline",
  "ftpWebhookApprove", "ftpDMApprove", "ftpDMDecline",
  "departmentWebhookSubmitted", "departmentWebhookApprove", "departmentWebhookDecline", "departmentDMApprove", "departmentDMDecline",
  "loaWebhookApprove", "loaWebhookDecline", "loaDMApprove", "loaDMDecline", "loaReminderMessage", "loaExpiredMessage",
  "promotionWebhookMessage", "demotionWebhookMessage", "callsignWebhookMessage",
] as const;

const WEBHOOK_KINDS = ["recruit", "onboarding", "ftp", "department", "loa", "promotion", "callsign"] as const;

type Settings = Record<string, unknown> & {
  webhookUrls: Record<string, string | undefined> | null;
  botSettings: { token?: string; inviteLink?: string; stateInvite?: string } | null;
};

/** "departmentDMApprove" → "Department · DM · Approve". */
function label(field: string) {
  return field
    .replace(/DM/g, " DM ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((w) => (w === "DM" ? "DM" : w[0].toUpperCase() + w.slice(1)))
    .join(" · ");
}

/** The channel a message field is sent through, for /config test. */
function testTarget(field: string): { channel: "dm" | "webhook"; kind?: string } {
  if (/DM|Reminder|Expired/.test(field)) return { channel: "dm" };
  const prefix = field.match(/^[a-z]+/)?.[0] ?? "";
  const kind = prefix === "demotion" ? "promotion" : prefix;
  return { channel: "webhook", kind };
}

const data = new SlashCommandBuilder()
  .setName("config")
  .setDescription("Configure the website's Discord notifications")
  .setContexts(InteractionContextType.Guild)
  .setDefaultMemberPermissions(0n)
  .addSubcommand((s) => s.setName("view").setDescription("Every notification toggle and channel at a glance"))
  .addSubcommand((s) =>
    s
      .setName("toggle")
      .setDescription("Turn a notification on or off")
      .addStringOption((o) => o.setName("setting").setDescription("Notification").setRequired(true).setAutocomplete(true))
      .addBooleanOption((o) => o.setName("enabled").setDescription("On or off").setRequired(true))
  )
  .addSubcommand((s) =>
    s
      .setName("message")
      .setDescription("Edit the text of a DM or channel message")
      .addStringOption((o) => o.setName("field").setDescription("Message").setRequired(true).setAutocomplete(true))
  )
  .addSubcommand((s) =>
    s
      .setName("webhook")
      .setDescription("Set or clear the webhook a channel posts through")
      .addStringOption((o) =>
        o
          .setName("channel")
          .setDescription("Which notification channel")
          .setRequired(true)
          .addChoices(...WEBHOOK_KINDS.map((k) => ({ name: k[0].toUpperCase() + k.slice(1), value: k })))
      )
      .addStringOption((o) =>
        o.setName("url").setDescription('Webhook URL from Discord, or "clear" to remove it').setRequired(true)
      )
  )
  .addSubcommand((s) =>
    s
      .setName("invite")
      .setDescription("Set the state server invite link used in welcome DMs")
      .addStringOption((o) => o.setName("url").setDescription("https://discord.gg/…").setRequired(true))
  )
  .addSubcommand((s) =>
    s
      .setName("test")
      .setDescription("Send a message with sample values to check it")
      .addStringOption((o) => o.setName("field").setDescription("Message").setRequired(true).setAutocomplete(true))
      .addUserOption((o) => o.setName("user").setDescription("Who receives a test DM (default: you)"))
  );

const onOff = (v: unknown) => (v ? "🟢 On" : "⚫ Off");

export const configCommand: Command = {
  data,

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const actor = actorOf(interaction);
    try {
      if (sub === "message") {
        const field = interaction.options.getString("field", true);
        if (!(MESSAGE_FIELDS as readonly string[]).includes(field)) {
          await interaction.reply({ embeds: [failure("Unknown message", "Pick one from the suggestions.")], ...EPHEMERAL });
          return;
        }
        const settings = await api<Settings>(actor, "GET", "/api/admin/notification-settings");
        const input = new TextInputBuilder()
          .setCustomId("text")
          .setLabel(clip(label(field), 45))
          .setStyle(TextInputStyle.Paragraph)
          .setMaxLength(1800)
          .setRequired(true)
          .setPlaceholder("Placeholders like {name}, {rank}, {discordId} are filled in when sent");
        const current = String(settings[field] ?? "");
        if (current) input.setValue(current.slice(0, 1800));
        await interaction.showModal(
          new ModalBuilder()
            .setCustomId(customId("config", "message", field))
            .setTitle("Edit message")
            .addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input))
        );
        return;
      }

      await interaction.deferReply(EPHEMERAL);

      if (sub === "view") {
        const s = await api<Settings>(actor, "GET", "/api/admin/notification-settings");
        const urls = s.webhookUrls ?? {};
        const groups: [string, string[]][] = [
          ["Recruitment", ["recruitWebhook", "recruitDM"]],
          ["Onboarding", ["onboardingWebhook", "onboardingDM"]],
          ["FTP", ["ftpWebhook", "ftpDM"]],
          ["Departments", ["departmentWebhook", "departmentDM"]],
          ["Leave of Absence", ["loaWebhook", "loaDM", "loaReminderDM", "loaExpiredDM"]],
          ["Promotions", ["promotionWebhook", "demotionWebhook", "callsignWebhook"]],
          ["Testing", ["testWebhook", "testDM"]],
        ];
        const e = embed(COLORS.info)
          .setTitle("⚙️  Notification settings")
          .setDescription("Change one with `/config toggle`, edit its text with `/config message`.")
          .addFields(
            ...groups.map(([name, fields]) => ({
              name,
              value: fields.map((f) => `${onOff(s[f])} ${label(f).split(" · ").slice(1).join(" ") || label(f)}`).join("\n"),
              inline: true,
            })),
            {
              name: "Channel webhooks",
              // Never echo the URL itself — it is a credential.
              value: WEBHOOK_KINDS.map((k) => `${urls[k] ? "🔗" : "▫️"} ${k}${urls[k] ? "" : " (env / fallback)"}`).join("\n"),
              inline: true,
            },
            {
              name: "Bot",
              value: `${s.botSettings?.token ? "🔑 Token saved on site" : "▫️ Token from env"}\n${s.botSettings?.stateInvite ? "🔗 State invite set" : "▫️ No state invite"}`,
              inline: true,
            }
          );
        await interaction.editReply({ embeds: [e] });
        return;
      }

      if (sub === "toggle") {
        const field = interaction.options.getString("setting", true);
        if (!(BOOLEAN_FIELDS as readonly string[]).includes(field)) {
          await interaction.editReply({ embeds: [failure("Unknown setting", "Pick one from the suggestions.")] });
          return;
        }
        const enabled = interaction.options.getBoolean("enabled", true);
        await api(actor, "PATCH", "/api/admin/notification-settings", { [field]: enabled });
        await staffLog(interaction.client, actor, `Turned ${label(field)} ${enabled ? "on" : "off"}`);
        await interaction.editReply({ embeds: [success(`${label(field)} is now ${enabled ? "on" : "off"}`)] });
        return;
      }

      if (sub === "webhook") {
        const kind = interaction.options.getString("channel", true);
        const raw = interaction.options.getString("url", true).trim();
        const clear = raw.toLowerCase() === "clear";
        if (!clear && !/^https:\/\/(canary\.|ptb\.)?discord(app)?\.com\/api\/webhooks\/\d+\/[\w-]+$/.test(raw)) {
          await interaction.editReply({
            embeds: [failure("That is not a Discord webhook URL", "In Discord: Edit Channel → Integrations → Webhooks → New Webhook → Copy Webhook URL.")],
          });
          return;
        }
        const s = await api<Settings>(actor, "GET", "/api/admin/notification-settings");
        const webhookUrls = { ...(s.webhookUrls ?? {}) };
        if (clear) delete webhookUrls[kind];
        else webhookUrls[kind] = raw;
        await api(actor, "PATCH", "/api/admin/notification-settings", { webhookUrls });
        await staffLog(interaction.client, actor, `${clear ? "Cleared" : "Set"} the ${kind} webhook`);
        await interaction.editReply({
          embeds: [success(clear ? `The ${kind} webhook was cleared` : `The ${kind} webhook is set`, clear ? "It falls back to the environment variable, if one is set." : "Check it with `/config test`.")],
        });
        return;
      }

      if (sub === "invite") {
        const url = interaction.options.getString("url", true).trim();
        if (!/^https:\/\/(discord\.gg|discord\.com\/invite)\/\S+$/.test(url)) {
          await interaction.editReply({ embeds: [failure("That is not a Discord invite link")] });
          return;
        }
        const s = await api<Settings>(actor, "GET", "/api/admin/notification-settings");
        await api(actor, "PATCH", "/api/admin/notification-settings", { botSettings: { ...(s.botSettings ?? {}), stateInvite: url } });
        await staffLog(interaction.client, actor, "Changed the state server invite link", url);
        await interaction.editReply({ embeds: [success("State invite updated", url)] });
        return;
      }

      if (sub === "test") {
        const field = interaction.options.getString("field", true);
        if (!(MESSAGE_FIELDS as readonly string[]).includes(field)) {
          await interaction.editReply({ embeds: [failure("Unknown message", "Pick one from the suggestions.")] });
          return;
        }
        const target = testTarget(field);
        const user = interaction.options.getUser("user") ?? interaction.user;
        const result = await api<{ ok: boolean; detail: string; preview: string }>(actor, "POST", "/api/admin/notification-settings/test", {
          field,
          channel: target.channel,
          kind: target.kind,
          discordId: user.id,
        });
        await interaction.editReply({
          embeds: [
            (result.ok ? success("Test sent", result.detail) : failure("Test failed", result.detail)).addFields({
              name: "Preview",
              value: clip(result.preview),
            }),
          ],
        });
      }
    } catch (err) {
      await respondError(interaction, err);
    }
  },

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused(true);
    const pool = focused.name === "setting" ? BOOLEAN_FIELDS : MESSAGE_FIELDS;
    const q = focused.value.toLowerCase();
    await interaction.respond(
      pool
        .filter((f) => !q || label(f).toLowerCase().includes(q) || f.toLowerCase().includes(q))
        .slice(0, 25)
        .map((f) => ({ name: label(f), value: f }))
    );
  },

  async modal(interaction, action, field) {
    if (action !== "message") return;
    const actor = actorOf(interaction);
    try {
      await interaction.deferReply(EPHEMERAL);
      const text = interaction.fields.getTextInputValue("text");
      await api(actor, "PATCH", "/api/admin/notification-settings", { [field]: text });
      await staffLog(interaction.client, actor, `Edited the ${label(field)} message`, clip(text, 1500));
      await interaction.editReply({
        embeds: [success(`${label(field)} updated`, "Try it with `/config test`.").addFields({ name: "New text", value: clip(text) })],
      });
    } catch (err) {
      await respondError(interaction, err);
    }
  },
};
