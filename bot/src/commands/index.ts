import type { Command } from "../command.js";
import { announce } from "./announce.js";
import { applicationCommands } from "./applications.js";
import { member } from "./member.js";
import { configCommand } from "./config.js";
import { banner, dm, duty, ems } from "./misc.js";
import { joinlink } from "./joinlink.js";
import { permissions } from "./permissions.js";

export const commands: Command[] = [ems, announce, ...applicationCommands, member, configCommand, joinlink, banner, dm, permissions, duty];

export const commandMap = new Map(commands.map((c) => [c.data.name, c]));
