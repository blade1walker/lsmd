"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { toast } from "sonner";
import { FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { fetchJson, errorMessage } from "@/lib/fetch-json";

interface DatasetInfo {
  key: string;
  label: string;
  page: string;
}

interface ExportedDataset extends DatasetInfo {
  columns: string[];
  rows: (string | number)[][];
}

interface ExportPayload {
  generatedAt: string;
  datasets: ExportedDataset[];
}

/** Sheet names are capped at 31 characters by the format, and reject : \ / ? * [ ]. */
function sheetName(label: string, used: Set<string>): string {
  const base = label.replace(/[:\\/?*[\]]/g, "-").slice(0, 31) || "Sheet";
  if (!used.has(base)) {
    used.add(base);
    return base;
  }
  for (let n = 2; ; n++) {
    const candidate = `${base.slice(0, 31 - String(n).length - 1)} ${n}`;
    if (!used.has(candidate)) {
      used.add(candidate);
      return candidate;
    }
  }
}

const stamp = () => new Date().toISOString().slice(0, 10);

export default function AdminExportPage() {
  const [catalogue, setCatalogue] = useState<DatasetInfo[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"xlsx" | "pdf" | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const list = await fetchJson<DatasetInfo[]>("/api/admin/export/data?list=1");
      setCatalogue(list);
      setSelected(new Set(list.map((d) => d.key)));
    } catch (err) {
      setError(errorMessage(err));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Grouped by the admin page each dataset backs, so the picker reads like the
  // sidebar rather than like a table list.
  const groups = useMemo(() => {
    const byPage = new Map<string, DatasetInfo[]>();
    for (const dataset of catalogue) {
      byPage.set(dataset.page, [...(byPage.get(dataset.page) ?? []), dataset]);
    }
    return [...byPage.entries()];
  }, [catalogue]);

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const fetchSelected = async (): Promise<ExportPayload> => {
    const all = selected.size === catalogue.length;
    const query = all ? "" : `?datasets=${[...selected].join(",")}`;
    return fetchJson<ExportPayload>(`/api/admin/export/data${query}`);
  };

  const exportExcel = async () => {
    if (selected.size === 0) return;
    setBusy("xlsx");
    try {
      const [{ datasets }, XLSX] = await Promise.all([fetchSelected(), import("xlsx")]);

      const book = XLSX.utils.book_new();
      const used = new Set<string>();
      for (const dataset of datasets) {
        const sheet = XLSX.utils.aoa_to_sheet([
          dataset.columns.length > 0 ? dataset.columns : ["(no data)"],
          ...dataset.rows,
        ]);
        XLSX.utils.book_append_sheet(book, sheet, sheetName(dataset.label, used));
      }

      XLSX.writeFile(book, `nexus-ems-export-${stamp()}.xlsx`);
      toast.success(`Exported ${datasets.length} sheet${datasets.length === 1 ? "" : "s"}`);
    } catch (err) {
      toast.error(errorMessage(err));
    }
    setBusy(null);
  };

  const exportPdf = async () => {
    if (selected.size === 0) return;
    setBusy("pdf");
    try {
      const [{ generatedAt, datasets }, { jsPDF }, { default: autoTable }] = await Promise.all([
        fetchSelected(),
        import("jspdf"),
        import("jspdf-autotable"),
      ]);

      // Landscape: these tables are wide, and a roster row does not fit across
      // a portrait page without becoming unreadable.
      const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

      doc.setFontSize(18);
      doc.text("Nexus EMS — Data Export", 40, 50);
      doc.setFontSize(10);
      doc.text(`Generated ${new Date(generatedAt).toLocaleString()}`, 40, 68);
      doc.text(
        `${datasets.length} dataset${datasets.length === 1 ? "" : "s"} · ` +
          `${datasets.reduce((t, d) => t + d.rows.length, 0)} rows`,
        40,
        84
      );

      let first = true;
      for (const dataset of datasets) {
        if (!first) doc.addPage();
        first = false;

        autoTable(doc, {
          head: dataset.columns.length > 0 ? [dataset.columns] : [["(no data)"]],
          body: dataset.rows.length > 0 ? dataset.rows.map((r) => r.map(String)) : [["No records"]],
          startY: 110,
          margin: { top: 90, left: 30, right: 30, bottom: 40 },
          styles: { fontSize: 6, cellPadding: 2, overflow: "linebreak" },
          headStyles: { fillColor: [220, 38, 38], textColor: 255, fontSize: 6 },
          // The heading is drawn per page so a table running over several pages
          // still says what it is on every one of them.
          didDrawPage: () => {
            doc.setFontSize(12);
            doc.text(`${dataset.label}  —  ${dataset.page}`, 30, 70);
            doc.setFontSize(8);
            doc.text(`${dataset.rows.length} row${dataset.rows.length === 1 ? "" : "s"}`, 30, 84);
          },
        });
      }

      doc.save(`nexus-ems-export-${stamp()}.pdf`);
      toast.success(`Exported ${datasets.length} dataset${datasets.length === 1 ? "" : "s"}`);
    } catch (err) {
      toast.error(errorMessage(err));
    }
    setBusy(null);
  };

  if (loading) {
    return (
      <div>
        <Skeleton className="h-8 w-48 mb-2" />
        <Skeleton className="h-4 w-80 mb-8" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  if (error) {
    return <ErrorState title="Failed to load the export list" message={error} onRetry={load} />;
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-[family-name:var(--font-oswald)] text-2xl font-bold text-white uppercase">
          Export
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Download everything stored behind the admin pages as a spreadsheet or a PDF.
        </p>
      </div>

      <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <div className="text-sm text-gray-400">
            {selected.size} of {catalogue.length} selected
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="border-[#1e1e1e] text-gray-300"
              onClick={() => setSelected(new Set(catalogue.map((d) => d.key)))}
            >
              Select all
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-[#1e1e1e] text-gray-300"
              onClick={() => setSelected(new Set())}
            >
              Clear
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-x-6 gap-y-5">
          {groups.map(([page, datasets]) => (
            <div key={page}>
              <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">{page}</div>
              <div className="space-y-1.5">
                {datasets.map((dataset) => (
                  <label key={dataset.key} className="flex items-center gap-2 text-sm text-gray-300">
                    <input
                      type="checkbox"
                      checked={selected.has(dataset.key)}
                      onChange={() => toggle(dataset.key)}
                      className="h-4 w-4 accent-[#dc2626]"
                    />
                    {dataset.label}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button
          onClick={exportExcel}
          disabled={selected.size === 0 || busy !== null}
          className="bg-[#dc2626] text-black hover:bg-[#b91c1c]"
        >
          {busy === "xlsx" ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <FileSpreadsheet className="w-4 h-4 mr-2" />
          )}
          Export Excel (.xlsx)
        </Button>
        <Button
          onClick={exportPdf}
          disabled={selected.size === 0 || busy !== null}
          variant="outline"
          className="border-[#1e1e1e] text-gray-200"
        >
          {busy === "pdf" ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <FileText className="w-4 h-4 mr-2" />
          )}
          Export PDF
        </Button>
      </div>

      <p className="text-xs text-gray-600 mt-4 max-w-2xl">
        Excel gives one sheet per dataset and is the better format for the wide ones — a training
        record carries more columns than fit across a page. The PDF is landscape, one dataset per
        section, for reading and filing rather than for working with. Both downloads carry Discord
        IDs, state IDs and HR notes, and every export is recorded in the audit log.
      </p>
    </div>
  );
}
