/**
 * The Nexus EMS Bot's slash commands that can be granted — kept in step with
 * bot/src/commands. Public commands (/ems, /duty) are open to everyone and
 * are not listed. "*" grants every command here except /permissions, which
 * hands out access and so is only ever granted on its own.
 */
export const BOT_COMMANDS = [
  { name: "announce", label: "/announce", description: "Post and schedule announcements" },
  { name: "recruit", label: "/recruit", description: "Review recruitment applications" },
  { name: "onboarding", label: "/onboarding", description: "Review onboarding requests" },
  { name: "loa", label: "/loa", description: "Review Leave of Absence requests" },
  { name: "dept-app", label: "/dept-app", description: "Review department applications" },
  { name: "member", label: "/member", description: "Roster lookup, ranks, call signs, status" },
  { name: "config", label: "/config", description: "Website notification settings" },
  { name: "joinlink", label: "/joinlink", description: "Join link and its roles" },
  { name: "banner", label: "/banner", description: "The website banner" },
  { name: "dm", label: "/dm", description: "Message members as the bot" },
  { name: "permissions", label: "/permissions", description: "Grant and revoke bot access" },
] as const;

export const ALL_COMMANDS = "*";

export const PUBLIC_BOT_COMMANDS = ["ems", "duty"] as const;

export function isGrantableCommand(name: string) {
  return name === ALL_COMMANDS || BOT_COMMANDS.some((c) => c.name === name);
}

export function commandLabel(name: string) {
  return name === ALL_COMMANDS ? "All commands" : `/${name}`;
}
