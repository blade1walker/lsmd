import type { PrismaClient } from "@/generated/prisma/client";

type Db = Pick<PrismaClient, "adminRole">;

/**
 * The order for a new role: one below every existing role (a higher number
 * ranks lower). Every role needs its own value — see AdminRole.order in the
 * schema — so call this inside the transaction that creates the role.
 */
export async function nextRoleOrder(db: Db): Promise<number> {
  const { _max } = await db.adminRole.aggregate({ _max: { order: true } });
  return (_max.order ?? 0) + 1;
}
