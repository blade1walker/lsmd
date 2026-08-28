/**
 * Pure functions for the role hierarchy — kept free of the Prisma import so
 * this is safe to use from client components too (the admin roles page shows
 * a live "effective permissions" preview while reordering, before saving).
 */

export interface RoleWithHierarchy {
  id: string;
  order: number;
  permissions: string[];
}

/**
 * Effective permissions for a set of assigned roles: their own permissions
 * plus every role ranked at or below the most senior one assigned (lower
 * `order` value = higher rank, same convention as Section.order elsewhere).
 *
 * A permission on a lower-ranked role is automatically held by everyone at
 * or above it — reordering the hierarchy (not touching any role's own
 * permission list) is enough to grant it upward. This collapses to "assign
 * whichever role is highest, take everything from there down" because the
 * downward-closed set of any lower assigned role is always a subset of the
 * most senior one's.
 */
export function effectiveRolePermissions(
  assignedRoles: RoleWithHierarchy[],
  allRoles: RoleWithHierarchy[]
): string[] {
  if (assignedRoles.length === 0) return [];
  const minOrder = Math.min(...assignedRoles.map((r) => r.order));
  return [...new Set(allRoles.filter((r) => r.order >= minOrder).flatMap((r) => r.permissions))];
}

/** Permissions a role holds only because of its position — not in its own list. */
export function inheritedPermissions(role: RoleWithHierarchy, allRoles: RoleWithHierarchy[]): string[] {
  const effective = effectiveRolePermissions([role], allRoles);
  return effective.filter((p) => !role.permissions.includes(p));
}
