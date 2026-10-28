import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied, actorLabel } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import { logAudit } from "@/lib/audit";
import {
  DEFAULT_RANKS,
  RANK_LAYOUTS,
  RANK_MAX_COUNT,
  RANK_SHAPES,
  RANK_PERMISSIONS,
  buildRanks,
  type RankOverride,
} from "@/lib/constants";
import { loadRankSettings } from "@/lib/rank-settings";

/** The ladder as it is now, highest first, plus the shipped one to compare against. */
export async function GET() {
  const auth = await requireAuth(RANK_PERMISSIONS.manage);
  if (isDenied(auth)) return auth.error;

  try {
    const overrides = await loadRankSettings({ force: true });
    return NextResponse.json({ ranks: buildRanks(overrides), defaults: buildRanks() });
  } catch (error) {
    return apiError("Failed to load ranks", error);
  }
}

/**
 * Saves the whole ladder: every rank, in order, with its insignia. Sent whole
 * so a reorder can never leave two ranks on the same position.
 */
export async function PUT(req: NextRequest) {
  const auth = await requireAuth(RANK_PERMISSIONS.manage);
  if (isDenied(auth)) return auth.error;

  const body = (await req.json().catch(() => null)) as { ranks?: unknown } | null;
  const list = Array.isArray(body?.ranks) ? body.ranks : null;
  if (!list) return NextResponse.json({ error: "Send { ranks: [...] }, highest first" }, { status: 400 });

  const known = new Set(DEFAULT_RANKS.map((r) => r.name));
  const seen = new Set<string>();
  const rows: RankOverride[] = [];
  for (const [position, raw] of list.entries()) {
    const r = (raw ?? {}) as Record<string, unknown>;
    const name = typeof r.name === "string" ? r.name : "";
    if (!known.has(name)) return NextResponse.json({ error: `"${name}" is not a rank` }, { status: 400 });
    if (seen.has(name)) return NextResponse.json({ error: `${name} is listed twice` }, { status: 400 });
    seen.add(name);

    const shape = String(r.shape);
    const layout = String(r.layout ?? "row");
    const count = Number(r.count);
    const color = r.color == null || r.color === "" ? null : String(r.color);
    if (!(RANK_SHAPES as readonly string[]).includes(shape)) {
      return NextResponse.json({ error: `${name}: unknown insignia shape "${shape}"` }, { status: 400 });
    }
    if (!(RANK_LAYOUTS as readonly string[]).includes(layout)) {
      return NextResponse.json({ error: `${name}: unknown layout "${layout}"` }, { status: 400 });
    }
    if (!Number.isInteger(count) || count < 0 || count > RANK_MAX_COUNT) {
      return NextResponse.json({ error: `${name}: count must be 0–${RANK_MAX_COUNT}` }, { status: 400 });
    }
    if (color !== null && !/^#[0-9a-f]{6}$/i.test(color)) {
      return NextResponse.json({ error: `${name}: color must look like #dc2626` }, { status: 400 });
    }
    rows.push({ name, position, shape, count, color, layout });
  }
  if (seen.size !== known.size) {
    const missing = [...known].filter((n) => !seen.has(n));
    return NextResponse.json({ error: `Missing ranks: ${missing.join(", ")}` }, { status: 400 });
  }

  try {
    const before = buildRanks(await loadRankSettings({ force: true }));
    const by = actorLabel(auth.access);
    await prisma.$transaction(
      rows.map((r) =>
        prisma.rankSetting.upsert({
          where: { name: r.name },
          create: { ...r, updatedBy: by },
          update: { ...r, updatedBy: by },
        })
      )
    );
    const overrides = await loadRankSettings({ force: true });
    const after = buildRanks(overrides);

    const moved = after.filter((r, i) => before[i]?.name !== r.name).map((r) => r.name);
    const restyled = after
      .filter((r) => {
        const b = before.find((x) => x.name === r.name);
        return b && (b.shape !== r.shape || b.count !== r.count || b.color !== r.color || b.layout !== r.layout);
      })
      .map((r) => r.name);
    await logAudit({
      action: "update",
      entityType: "RankSetting",
      entityId: "ladder",
      entityLabel: "Rank ladder",
      details: {
        order: after.map((r) => r.name).join(" > "),
        moved: moved.join(", ") || null,
        insigniaChanged: restyled.join(", ") || null,
      },
      performedBy: by,
    });

    return NextResponse.json({ ranks: after });
  } catch (error) {
    return apiError("Failed to save ranks", error);
  }
}

/** Puts every rank back to its shipped position and insignia. */
export async function DELETE() {
  const auth = await requireAuth(RANK_PERMISSIONS.manage);
  if (isDenied(auth)) return auth.error;

  try {
    await prisma.rankSetting.deleteMany({});
    await loadRankSettings({ force: true });
    await logAudit({
      action: "delete",
      entityType: "RankSetting",
      entityId: "ladder",
      entityLabel: "Rank ladder reset to defaults",
      performedBy: actorLabel(auth.access),
    });
    return NextResponse.json({ ranks: buildRanks() });
  } catch (error) {
    return apiError("Failed to reset ranks", error);
  }
}
