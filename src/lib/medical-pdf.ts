import {
  parseFields,
  parseExportConfig,
  visibleFields,
  groupBySection,
  displayAnswer,
  PRESENTATIONAL_TYPES,
  type Answers,
  type FormField,
} from "./medical";

/**
 * Renders a completed medical document as a printable PDF.
 *
 * Runs in the browser, with jsPDF pulled in on demand — the same arrangement
 * the data export uses, so neither library reaches the main bundle. Only the
 * fields a form marks for export are printed: a document often collects
 * working notes that have no place on the issued copy.
 */

export interface PdfSettings {
  departmentName: string;
  subDepartment?: string | null;
  logoUrl?: string | null;
  address?: string | null;
  contact?: string | null;
  confidentialityNotice: string;
  disclaimer?: string | null;
}

export interface PdfDocument {
  documentNumber?: string | null;
  status: string;
  patientName: string;
  patientStateId?: string | null;
  authorName: string;
  authorRank?: string | null;
  signedBy?: string | null;
  signedAt?: string | Date | null;
  finalizedAt?: string | Date | null;
  createdAt: string | Date;
  answers: Answers;
  documentType: { name: string };
  formVersion: {
    version: string;
    fields: unknown;
    exportConfig: unknown;
    form: { name: string };
  };
  patient?: { rank?: string | null; callSign?: string | null; dept?: string | null } | null;
}

const MARGIN = 48;
const RED: [number, number, number] = [185, 28, 28];
const INK: [number, number, number] = [17, 17, 17];
const MUTED: [number, number, number] = [110, 110, 110];

function asDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value: string | Date | null | undefined): string {
  const date = asDate(value);
  return date ? date.toLocaleString(undefined, { dateStyle: "long", timeStyle: "short" }) : "—";
}

/** A filename that sorts sensibly and never carries characters a filesystem rejects. */
export function pdfFileName(doc: PdfDocument): string {
  const id = doc.documentNumber ?? `DRAFT-${doc.patientName}`;
  return `${id}`.replace(/[^\w.-]+/g, "_") + ".pdf";
}

export async function exportDocumentPdf(doc: PdfDocument, settings: PdfSettings): Promise<void> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);

  const config = parseExportConfig(doc.formVersion.exportConfig);
  const allFields = parseFields(doc.formVersion.fields);
  const answers = doc.answers ?? {};

  // Conditions are re-evaluated against the stored answers, so a branch the
  // doctor never opened is absent from the export rather than printed blank.
  const shown = visibleFields(allFields, answers).filter((f) => f.inExport);

  const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const contentWidth = pageWidth - MARGIN * 2;
  let y = MARGIN;

  // ── Letterhead ───────────────────────────────────────────────────────────
  if (config.showDepartmentName) {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(18);
    pdf.setTextColor(...RED);
    pdf.text(settings.departmentName.toUpperCase(), pageWidth / 2, y, { align: "center" });
    y += 20;

    if (settings.subDepartment) {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.setTextColor(...MUTED);
      pdf.text(settings.subDepartment, pageWidth / 2, y, { align: "center" });
      y += 14;
    }
  }

  const contactLine = [
    config.showAddress ? settings.address : null,
    config.showContact ? settings.contact : null,
  ]
    .filter(Boolean)
    .join("  ·  ");
  if (contactLine) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(...MUTED);
    pdf.text(contactLine, pageWidth / 2, y, { align: "center" });
    y += 14;
  }

  y += 4;
  pdf.setDrawColor(...RED);
  pdf.setLineWidth(1.5);
  pdf.line(MARGIN, y, pageWidth - MARGIN, y);
  y += 24;

  // ── Title ────────────────────────────────────────────────────────────────
  const title = (config.documentTitle?.trim() || doc.formVersion.form.name).toUpperCase();
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.setTextColor(...INK);
  pdf.text(title, pageWidth / 2, y, { align: "center" });
  y += 18;

  // A draft that leaves the building must not be mistakable for an issued
  // record, so it says so under the title rather than only in the filename.
  if (doc.status !== "Finalized") {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.setTextColor(...RED);
    pdf.text(`${doc.status.toUpperCase()} — NOT AN ISSUED DOCUMENT`, pageWidth / 2, y, {
      align: "center",
    });
    y += 16;
  }
  y += 6;

  // ── Reference block ──────────────────────────────────────────────────────
  const meta: [string, string][] = [];
  if (config.showDocumentNumber) meta.push(["Document No.", doc.documentNumber ?? "Not yet issued"]);
  if (config.showDate) meta.push(["Date", formatDate(doc.finalizedAt ?? doc.createdAt)]);
  meta.push(["Document type", doc.documentType.name]);
  meta.push(["Form", `${doc.formVersion.form.name} v${doc.formVersion.version}`]);
  if (config.showPatient) {
    meta.push(["Patient", doc.patientName]);
    if (doc.patientStateId) meta.push(["State ID", doc.patientStateId]);
  }
  if (config.showDoctor) {
    meta.push(["Attending", [doc.authorName, doc.authorRank].filter(Boolean).join(" · ")]);
  }

  autoTable(pdf, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    theme: "plain",
    styles: { fontSize: 9, cellPadding: 3, textColor: INK },
    columnStyles: {
      0: { cellWidth: 110, fontStyle: "bold", textColor: MUTED },
      1: { cellWidth: contentWidth - 110 },
    },
    body: meta,
  });
  y = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 20;

  // ── Body, one table per section ──────────────────────────────────────────
  const answerable = shown.filter((f) => !PRESENTATIONAL_TYPES.includes(f.type));
  const groups = groupBySection(answerable, config.sectionOrder);

  for (const group of groups) {
    const rows = group.fields.map((field: FormField) => [field.label, displayAnswer(field, answers)]);
    if (rows.length === 0) continue;

    autoTable(pdf, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      theme: "grid",
      head: group.section ? [[group.section.toUpperCase(), ""]] : undefined,
      headStyles: { fillColor: RED, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9 },
      styles: { fontSize: 9, cellPadding: 5, textColor: INK, lineColor: [220, 220, 220] },
      columnStyles: {
        0: { cellWidth: 170, fontStyle: "bold" },
        1: { cellWidth: contentWidth - 170 },
      },
      body: rows,
    });
    y = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 16;
  }

  // ── Certification and signature ──────────────────────────────────────────
  const pageHeight = pdf.internal.pageSize.getHeight();
  const footerReserve = 120;

  if (config.certificationStatement?.trim()) {
    const lines = pdf.splitTextToSize(config.certificationStatement.trim(), contentWidth);
    if (y + lines.length * 12 > pageHeight - footerReserve) {
      pdf.addPage();
      y = MARGIN;
    }
    pdf.setFont("helvetica", "italic");
    pdf.setFontSize(9);
    pdf.setTextColor(...INK);
    pdf.text(lines, MARGIN, y);
    y += lines.length * 12 + 18;
  }

  if (config.showSignature) {
    if (y + 70 > pageHeight - footerReserve) {
      pdf.addPage();
      y = MARGIN;
    }
    const signatureX = pageWidth - MARGIN - 200;
    pdf.setDrawColor(...MUTED);
    pdf.setLineWidth(0.5);
    pdf.line(signatureX, y + 26, pageWidth - MARGIN, y + 26);

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.setTextColor(...INK);
    pdf.text(doc.signedBy ?? doc.authorName, signatureX, y + 40);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(...MUTED);
    const credentials = [doc.authorRank, settings.departmentName].filter(Boolean).join(" · ");
    pdf.text(credentials, signatureX, y + 52);
    if (doc.signedAt) pdf.text(`Signed ${formatDate(doc.signedAt)}`, signatureX, y + 63);
  }

  // ── Footer on every page ─────────────────────────────────────────────────
  const pageCount = pdf.getNumberOfPages();
  for (let page = 1; page <= pageCount; page++) {
    pdf.setPage(page);
    let footerY = pageHeight - MARGIN + 8;

    pdf.setDrawColor(220, 220, 220);
    pdf.setLineWidth(0.5);
    pdf.line(MARGIN, footerY - 22, pageWidth - MARGIN, footerY - 22);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.setTextColor(...MUTED);

    if (config.showConfidentiality && settings.confidentialityNotice) {
      const lines = pdf.splitTextToSize(settings.confidentialityNotice, contentWidth - 60);
      pdf.text(lines, MARGIN, footerY - 14);
      footerY += Math.max(0, (lines.length - 1) * 8);
    }
    if (config.showDisclaimer && settings.disclaimer) {
      pdf.text(pdf.splitTextToSize(settings.disclaimer, contentWidth - 60), MARGIN, footerY - 6);
    }
    if (config.showPageNumbers) {
      pdf.text(`Page ${page} of ${pageCount}`, pageWidth - MARGIN, pageHeight - MARGIN + 8, {
        align: "right",
      });
    }
    if (doc.documentNumber) {
      pdf.text(doc.documentNumber, pageWidth - MARGIN, pageHeight - MARGIN, { align: "right" });
    }
  }

  pdf.save(pdfFileName(doc));
}
