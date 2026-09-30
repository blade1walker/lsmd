import type {
  AutocompleteInteraction,
  ButtonInteraction,
  ChatInputCommandInteraction,
  ModalSubmitInteraction,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
  StringSelectMenuInteraction,
} from "discord.js";

/**
 * One top-level slash command.
 *
 * Each area of the site is its own top-level command on purpose: Discord's
 * Server Settings → Integrations sets access per top-level command, so
 * /recruit, /loa and /config being separate is what lets a server give HR the
 * one without the others.
 *
 * Components route by custom id "<command>:<action>:<payload>" — the command
 * name picks the handler, the rest is the handler's own.
 */
export interface Command {
  data: { name: string; toJSON(): RESTPostAPIChatInputApplicationCommandsJSONBody };
  execute(interaction: ChatInputCommandInteraction): Promise<void>;
  autocomplete?(interaction: AutocompleteInteraction): Promise<void>;
  modal?(interaction: ModalSubmitInteraction, action: string, payload: string): Promise<void>;
  button?(interaction: ButtonInteraction, action: string, payload: string): Promise<void>;
  select?(interaction: StringSelectMenuInteraction, action: string, payload: string): Promise<void>;
}

export function customId(command: string, action: string, payload = "") {
  const id = `${command}:${action}:${payload}`;
  if (id.length > 100) throw new Error(`custom id too long: ${id}`);
  return id;
}

export function parseCustomId(id: string) {
  const [command, action = "", ...rest] = id.split(":");
  return { command, action, payload: rest.join(":") };
}
