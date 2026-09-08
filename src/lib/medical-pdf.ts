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
  /** The second letterhead band, printed beneath the department's own. */
  secondaryName?: string | null;
  secondaryLogoUrl?: string | null;
  secondaryAddress?: string | null;
  secondaryContact?: string | null;
  secondaryDetail?: string | null;
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

/** Tallest the letterhead mark is allowed to print, in points. */
const LOGO_MAX_HEIGHT = 54;
const LOGO_MAX_WIDTH = 200;

/** The second band is subordinate to the first, so its mark is set smaller. */
const SECONDARY_LOGO_MAX_HEIGHT = 34;
const SECONDARY_LOGO_MAX_WIDTH = 140;

interface LoadedLogo {
  dataUrl: string;
  width: number;
  height: number;
}

/**
 * Fetches a letterhead logo and re-encodes it as PNG for jsPDF.
 *
 * The re-encode is the point. jsPDF only draws a handful of formats — WebP is
 * not among them — so handing it the bytes as downloaded meant a WebP logo
 * uploaded cleanly, previewed correctly in the browser, and then silently
 * failed to appear on the PDF. Painting it to a canvas first normalises
 * anything the browser can decode into the one format jsPDF is reliable with,
 * and yields the natural dimensions at the same time.
 *
 * Throws with a readable reason rather than returning null: a logo that
 * quietly does not print is the hardest kind of fault to report, so the caller
 * turns this into a warning the user can act on.
 */
async function loadLogo(url: string): Promise<LoadedLogo> {
  let blob: Blob;
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) throw new Error(`the server answered ${res.status}`);
    blob = await res.blob();
  } catch (error) {
    // Almost always CORS on a pasted third-party URL.
    throw new Error(
      `could not be fetched (${error instanceof Error ? error.message : "network error"}). ` +
        "If it is hosted elsewhere, it must allow cross-origin reads."
    );
  }

  const objectUrl = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("the file could not be decoded as an image"));
      image.src = objectUrl;
    });

    const width = img.naturalWidth;
    const height = img.naturalHeight;
    if (!width || !height) throw new Error("the image has no dimensions");

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("this browser would not provide a canvas to convert it");
    ctx.drawImage(img, 0, 0);

    return { dataUrl: canvas.toDataURL("image/png"), width, height };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/** Draws a logo centred at `y`, returning the height it consumed. */
function drawLogo(
  pdf: { addImage: (d: string, f: string, x: number, y: number, w: number, h: number) => void },
  logo: LoadedLogo,
  pageWidth: number,
  y: number,
  maxWidth: number,
  maxHeight: number
): number {
  // Fitted on whichever side binds first, so a wide banner and a square crest
  // both sit correctly rather than one being stretched.
  const scale = Math.min(maxWidth / logo.width, maxHeight / logo.height, 1);
  const width = logo.width * scale;
  const height = logo.height * scale;
  pdf.addImage(logo.dataUrl, "PNG", (pageWidth - width) / 2, y, width, height);
  return height;
}

/** A filename that sorts sensibly and never carries characters a filesystem rejects. */
export function pdfFileName(doc: PdfDocument): string {
  const id = doc.documentNumber ?? `DRAFT-${doc.patientName}`;
  return `${id}`.replace(/[^\w.-]+/g, "_") + ".pdf";
}

export async function exportDocumentPdf(
  doc: PdfDocument,
  settings: PdfSettings
): Promise<{ warnings: string[] }> {
  const warnings: string[] = [];
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
  if (config.showLogo && settings.logoUrl) {
    try {
      const logo = await loadLogo(settings.logoUrl);
      y += drawLogo(pdf, logo, pageWidth, y, LOGO_MAX_WIDTH, LOGO_MAX_HEIGHT) + 12;
    } catch (error) {
      // The document still exports — a letterhead is never worth failing a
      // medical record over — but the reason is reported rather than swallowed.
      warnings.push(`The department logo ${error instanceof Error ? error.message : "could not be loaded"}.`);
    }
  }

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
  y += 18;

  // ── Secondary letterhead ─────────────────────────────────────────────────
  // The issuing facility or division, sitting under the department's banner
  // rather than replacing it — so it is deliberately set smaller, and closed
  // with its own thin rule to read as a distinct band.
  const hasSecondary =
    config.showSecondaryLetterhead &&
    !!(settings.secondaryName || settings.secondaryAddress || settings.secondaryContact || settings.secondaryDetail);

  if (hasSecondary) {
    if (config.showSecondaryLogo && settings.secondaryLogoUrl) {
      try {
        const mark = await loadLogo(settings.secondaryLogoUrl);
        y += drawLogo(pdf, mark, pageWidth, y, SECONDARY_LOGO_MAX_WIDTH, SECONDARY_LOGO_MAX_HEIGHT) + 8;
      } catch (error) {
        warnings.push(
          `The second letterhead logo ${error instanceof Error ? error.message : "could not be loaded"}.`
        );
      }
    }

    if (settings.secondaryName) {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(12);
      pdf.setTextColor(...INK);
      pdf.text(settings.secondaryName.toUpperCase(), pageWidth / 2, y + 2, { align: "center" });
      y += 16;
    }

    const secondaryContactLine = [settings.secondaryAddress, settings.secondaryContact]
      .filter(Boolean)
      .join("  ·  ");
    if (secondaryContactLine) {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8.5);
      pdf.setTextColor(...MUTED);
      pdf.text(secondaryContactLine, pageWidth / 2, y, { align: "center" });
      y += 12;
    }

    // The extra section that closes the second band out.
    if (config.showSecondaryDetail && settings.secondaryDetail?.trim()) {
      const lines = pdf.splitTextToSize(settings.secondaryDetail.trim(), contentWidth - 80);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(...MUTED);
      pdf.text(lines, pageWidth / 2, y + 2, { align: "center" });
      y += lines.length * 10 + 4;
    }

    y += 4;
    pdf.setDrawColor(200, 200, 200);
    pdf.setLineWidth(0.5);
    pdf.line(MARGIN + 60, y, pageWidth - MARGIN - 60, y);
    y += 18;
  } else {
    y += 6;
  }

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
  return { warnings };
}
