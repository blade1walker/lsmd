import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isDenied, actorLabel } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import { logAudit } from "@/lib/audit";
import { EXPORT_PERMISSIONS } from "@/lib/constants";
import { DATASETS, loadDataset, type ExportedDataset } from "@/lib/export-datasets";

/**
 * Every dataset behind the admin pages, as JSON, for the export page to turn
 * into a workbook or a PDF in the browser. `?datasets=members,loas` narrows it;
 * with no parameter the whole panel comes out. `?list=1` returns just the
 * catalogue — names and the page each one backs — for the picker.
 *
 * Building the file client-side rather than here keeps one code path for both
 * formats and keeps a large export off the serverless response budget.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(EXPORT_PERMISSIONS.data);
  if (isDenied(auth)) return auth.error;

  try {
    const params = req.nextUrl.searchParams;

    if (params.get("list") === "1") {
      return NextResponse.json(DATASETS.map(({ key, label, page }) => ({ key, label, page })));
    }

    const requested = params.get("datasets");
    const wanted = requested
      ? new Set(requested.split(",").map((k) => k.trim()).filter(Boolean))
      : null;

    const definitions = wanted ? DATASETS.filter((d) => wanted.has(d.key)) : DATASETS;
    if (definitions.length === 0) {
      return NextResponse.json({ error: "No known datasets requested" }, { status: 400 });
    }

    // Sequential rather than Promise.all: thirty concurrent queries would open
    // thirty connections against a pooled database for no real time saving.
    const datasets: ExportedDataset[] = [];
    for (const definition of definitions) {
      datasets.push(await loadDataset(definition));
    }

    // An export takes personal data out of the panel in a file, so who took
    // what and when is worth a permanent record.
    await logAudit({
      action: "export",
      entityType: "Export",
      entityId: "data",
      entityLabel: `${datasets.length} dataset${datasets.length === 1 ? "" : "s"}`,
      details: {
        datasets: datasets.map((d) => d.key).join(", "),
        rows: datasets.reduce((total, d) => total + d.rows.length, 0),
      },
      performedBy: actorLabel(auth.access),
    });

    return NextResponse.json({ generatedAt: new Date().toISOString(), datasets });
  } catch (error) {
    return apiError("Failed to build the export", error);
  }
}
