import { prisma } from "./prisma";
import { SUPER_ADMIN_IDS, ALL_PERMISSIONS } from "./constants";
import { DEFAULT_MEMBER_ROLE, defaultMemberPermissions } from "./role-presets";

export type DenialReason = "not-in-roster" | "no-discord-id";

export interface Access {
  discordId: string;
  /** Whether this Discord account may sign in at all. */
  allowed: boolean;
  denialReason: DenialReason | null;
  isSuperAdmin: boolean;
  /** True when a roster Member carries this discordId. */
  isMember: boolean;
  memberId: string | null;
  memberName: string | null;
  /** Explicitly assigned role, or the default when they are only a roster member. */
  roleName: string | null;
  permissions: string[];
}

function denied(discordId: string, denialReason: DenialReason): Access {
  return {
    discordId,
    allowed: false,
    denialReason,
    isSuperAdmin: false,
    isMember: false,
    memberId: null,
    memberName: null,
    roleName: null,
    permissions: [],
  };
}

/**
 * The single answer to "who is this Discord account, and what may they do".
 *
 * Roster membership is the gate: a Member row carrying this discordId is what
 * grants access. Super admins bypass it so the roster can never lock everyone
 * out — that list is the recovery path if discordIds are missing or wrong.
 *
 * No row is written here. A roster member with no AdminUser row resolves to
 * the default role, so login stays a pure read and there is no row per member.
 */
export async function resolveAccess(discordId: string | null | undefined): Promise<Access> {
  if (!discordId) return denied("", "no-discord-id");

  const isSuperAdmin = SUPER_ADMIN_IDS.includes(discordId);

  const [member, adminUser] = await Promise.all([
    prisma.member.findFirst({
      where: { discordId },
      select: { id: true, name: true },
    }),
    prisma.adminUser.findUnique({
      where: { discordId },
      include: { role: true },
    }),
  ]);

  if (isSuperAdmin) {
    return {
      discordId,
      allowed: true,
      denialReason: null,
      isSuperAdmin: true,
      isMember: !!member,
      memberId: member?.id ?? null,
      memberName: member?.name ?? null,
      roleName: adminUser?.role?.name ?? "Super Admin",
      permissions: [...ALL_PERMISSIONS],
    };
  }

  if (!member) return denied(discordId, "not-in-roster");

  return {
    discordId,
    allowed: true,
    denialReason: null,
    isSuperAdmin: false,
    isMember: true,
    memberId: member.id,
    memberName: member.name,
    roleName: adminUser?.role?.name ?? DEFAULT_MEMBER_ROLE,
    permissions: adminUser?.role?.permissions ?? defaultMemberPermissions(),
  };
}

export function hasPermission(access: Pick<Access, "isSuperAdmin" | "permissions">, permission: string) {
  return access.isSuperAdmin || access.permissions.includes(permission);
}
