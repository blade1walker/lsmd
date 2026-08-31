import type { Permission } from "./constants";

export interface RolePreset {
  name: string;
  /** What the role is for, shown when seeding. */
  description: string;
  /** Admin panel areas this role is meant to cover. Documents intent behind `permissions`. */
  sections: string[];
  permissions: Permission[];
  /** Earlier names for the same role. The seeder renames these in place so admin users keep their assignment. */
  aliases?: string[];
}

/**
 * Role every roster member resolves to when no AdminUser row assigns them
 * something else. Nothing is written on login — the default is applied at
 * session time, so "reset to default" is just deleting the AdminUser row.
 */
export const DEFAULT_MEMBER_ROLE = "EMS Member";

/**
 * Declared here rather than inline in a script so the permission strings are
 * checked against `Permission` at compile time — a typo in a permission is
 * otherwise silent, since nothing validates the string array on write.
 */
export const ROLE_PRESETS: RolePreset[] = [
  {
    name: "EMS Member",
    description: "Baseline member access. Read-only.",
    sections: ["Roster", "SOP"],
    permissions: ["roster.view", "sop.view"],
  },
  {
    name: "Assistant HR",
    description: "Handles LOA, inactivity, onboarding and department join review.",
    sections: ["Roster", "HR", "Onboarding", "Departments", "SOP"],
    permissions: [
      "roster.view",
      "hr.view",
      "hr.loa",
      "hr.inactivity",
      "hr.inactivity.approve",
      "removal.request",
      "onboarding.view",
      "onboarding.approve",
      "departments.view",
      "departments.approve",
      "sop.view",
      "sop.edit",
    ],
    aliases: ["HR Assistant"],
  },
  {
    name: "HR Admin",
    description: "Full HR review authority, including removal approval.",
    sections: ["Roster", "HR", "SOP"],
    permissions: [
      "roster.view",
      "hr.view",
      "hr.loa",
      "hr.inactivity",
      "hr.inactivity.approve",
      "removal.request",
      "sop.view",
      "sop.edit",
    ],
  },
  {
    name: "FTP",
    description:
      "Field Training Program staff. Runs training, sign-offs and the FTP department.",
    sections: ["Roster", "Training", "Sign-offs", "Departments", "SOP"],
    permissions: [
      "roster.view",
      "sop.view",
      "sop.edit",
      "training.view",
      "training.manage",
      "training.signoff.manage",
      // FTP is a department now, so its staff review its join applications and
      // set standing in it — but not create or delete departments generally.
      "departments.view",
      "departments.approve",
      "departments.members",
    ],
  },
];

/** Permissions granted to a roster member with no explicit role assignment. */
export function defaultMemberPermissions(): string[] {
  const preset = ROLE_PRESETS.find((r) => r.name === DEFAULT_MEMBER_ROLE);
  return [...(preset?.permissions ?? [])];
}
