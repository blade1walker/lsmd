import { prisma } from "./prisma";
import { SUPER_ADMIN_IDS, ALL_PERMISSIONS } from "./constants";
import { DEFAULT_MEMBER_ROLE, defaultMemberPermissions } from "./role-presets";
import { memberDisplayLabel } from "./utils";
import { effectiveRolePermissions, type RoleWithHierarchy } from "./role-hierarchy";

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
  /** Roster rank, for rules that gate on seniority (e.g. FTP eligibility). */
  memberRank: string | null;
  /** Human-readable summary of assigned role(s), or the default when they carry none. */
  roleName: string | null;
  /** Every role name assigned (legacy single role and the multi-role set, deduplicated). Empty when on the default role. */
  roleNames: string[];
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
    memberRank: null,
    roleName: null,
    roleNames: [],
    permissions: [],
  };
}

/** Every role assigned via either the legacy single-role field or the multi-role relation, deduplicated by id. */
function combinedRoles(adminUser: {
  role: RoleWithHierarchy & { name: string } | null;
  roles: (RoleWithHierarchy & { name: string })[];
} | null) {
  if (!adminUser) return [];
  const byId = new Map<string, RoleWithHierarchy & { name: string }>();
  if (adminUser.role) byId.set(adminUser.role.id, adminUser.role);
  for (const r of adminUser.roles) byId.set(r.id, r);
  return [...byId.values()];
}

/**
 * The single answer to "who is this Discord account, and what may they do".
 *
 * Roster membership is the gate: a Member row carrying this discordId is what
 * grants access. Super admins bypass it so the roster can never lock everyone
 * out — that list is the recovery path if discordIds are missing or wrong.
 *
 * A pure read — never writes an AdminUser row. It falls back to the default
 * permission set when one doesn't exist yet, so this stays correct whether or
 * not provisionAdminUser (below) has run for this account yet. Called on
 * every session decode, so it needs to stay cheap and side-effect-free.
 */
export async function resolveAccess(discordId: string | null | undefined): Promise<Access> {
  if (!discordId) return denied("", "no-discord-id");

  const isSuperAdmin = SUPER_ADMIN_IDS.includes(discordId);

  const [member, adminUser, allRoles] = await Promise.all([
    prisma.member.findFirst({
      where: { discordId },
      select: { id: true, name: true, rank: true },
    }),
    prisma.adminUser.findUnique({
      where: { discordId },
      include: { role: true, roles: true },
    }),
    prisma.adminRole.findMany({
      select: { id: true, order: true, permissions: true },
    }),
  ]);

  const roles = combinedRoles(adminUser);
  const roleNames = roles.map((r) => r.name);
  const extraPermissions = adminUser?.extraPermissions ?? [];

  if (isSuperAdmin) {
    return {
      discordId,
      allowed: true,
      denialReason: null,
      isSuperAdmin: true,
      isMember: !!member,
      memberId: member?.id ?? null,
      memberName: member?.name ?? null,
      memberRank: member?.rank ?? null,
      roleName: roleNames.length ? roleNames.join(", ") : "Super Admin",
      roleNames,
      permissions: [...ALL_PERMISSIONS],
    };
  }

  if (!member) return denied(discordId, "not-in-roster");

  // Additive union: the hierarchy-cascaded role permissions plus any
  // individually granted extras. Never a subtraction — extraPermissions
  // cannot revoke something a role already grants, only add beyond it.
  const permissions = roles.length
    ? [...new Set([...effectiveRolePermissions(roles, allRoles), ...extraPermissions])]
    : [...new Set([...defaultMemberPermissions(), ...extraPermissions])];

  return {
    discordId,
    allowed: true,
    denialReason: null,
    isSuperAdmin: false,
    isMember: true,
    memberId: member.id,
    memberName: member.name,
    memberRank: member.rank,
    roleName: roleNames.length ? roleNames.join(", ") : DEFAULT_MEMBER_ROLE,
    roleNames,
    permissions,
  };
}

export function hasPermission(access: Pick<Access, "isSuperAdmin" | "permissions">, permission: string) {
  return access.isSuperAdmin || access.permissions.includes(permission);
}

/**
 * Creates the AdminUser row for a roster member the first time they sign in,
 * explicitly connected to the default EMS Member role, so /admin/roles'
 * Admin Users list shows every roster member who has actually logged in —
 * not only the ones an admin has explicitly assigned something to.
 *
 * Skipped for super admins: their access already comes unconditionally from
 * SUPER_ADMIN_IDS regardless of any row, and connecting them to "EMS Member"
 * would replace their "Super Admin" display label with a misleading
 * downgrade — resolveAccess shows whatever roles are actually assigned once
 * any exist, and it has no way to know the difference between "really is
 * just an EMS Member" and "super admin who also happens to hold that role".
 *
 * A no-op if a row already exists (explicit assignment or an earlier login
 * already provisioned it) or if the EMS Member role has not been seeded yet
 * (`npm run db:seed-roles`) — the row still isn't created in that case, since
 * an unconnected row would be indistinguishable from one that predates this
 * function and got no role on purpose.
 */
export async function provisionAdminUser(discordId: string): Promise<void> {
  if (SUPER_ADMIN_IDS.includes(discordId)) return;

  const existing = await prisma.adminUser.findUnique({ where: { discordId }, select: { id: true } });
  if (existing) return;

  const [member, defaultRole] = await Promise.all([
    prisma.member.findFirst({ where: { discordId }, select: { name: true, callSign: true } }),
    prisma.adminRole.findUnique({ where: { name: DEFAULT_MEMBER_ROLE }, select: { id: true } }),
  ]);
  if (!member || !defaultRole) return;

  try {
    await prisma.adminUser.create({
      data: {
        discordId,
        discordName: memberDisplayLabel(member),
        roles: { connect: { id: defaultRole.id } },
      },
    });
  } catch (error) {
    console.error("Failed to provision admin user:", error);
  }
}

/**
 * Refreshes an existing AdminUser row's display label from the roster on
 * every login. AdminUser.discordName is a one-time snapshot taken when a
 * role is assigned (via the roster member picker in /admin/roles) and has
 * no edit control of its own, so without this it silently drifts from the
 * roster after a rename, promotion, or call sign change.
 *
 * A no-op when no AdminUser row exists for this discordId — super admins
 * without one, or an account provisionAdminUser skipped because the EMS
 * Member role isn't seeded yet.
 */
export async function syncAdminUserFromRoster(discordId: string): Promise<void> {
  const member = await prisma.member.findFirst({
    where: { discordId },
    select: { name: true, callSign: true },
  });
  if (!member) return;

  const label = memberDisplayLabel(member);

  try {
    await prisma.adminUser.updateMany({
      where: { discordId, NOT: { discordName: label } },
      data: { discordName: label },
    });
  } catch (error) {
    console.error("Failed to sync admin user from roster:", error);
  }
}
