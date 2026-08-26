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
    description: "Handles LOA, inactivity and onboarding review.",
    sections: ["Roster", "HR", "Onboarding"],
    permissions: [
      "roster.view",
      "hr.view",
      "hr.loa",
      "hr.inactivity",
      "hr.inactivity.approve",
      "removal.request",
      "onboarding.view",
      "onboarding.approve",
    ],
    aliases: ["HR Assistant"],
  },
  {
    name: "FTP",
    description: "Field Training Program staff. Runs training and sign-offs.",
    sections: ["Roster", "Training", "Sign-offs", "SOP"],
    permissions: [
      "roster.view",
      "sop.view",
      "training.view",
      "training.manage",
      "training.signoff.manage",
    ],
  },
];
