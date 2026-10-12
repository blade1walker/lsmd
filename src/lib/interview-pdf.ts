import {
  EVALUATION_CATEGORIES,
  categoryFloor,
  formatDuration,
  isScoringRole,
  type InterviewDetail,
  type PromotionSettingsValues,
} from "./interviews";

/**
 * Renders a promotion examination as a printable PDF report.
 *
 * Runs in the browser with jsPDF pulled in on demand, the same arrangement the
 * medical documents use, so neither library reaches the main bundle. The data
 * comes from /api/interviews/[id]/report, which is where the export permission
 * and the audit entry live.
 */

const MARGIN = 48;
const RED: [number, number, number] = [185, 28, 28];
const INK: [number, number, number] = [17, 17, 17];
const MUTED: [number, number, number] = [110, 110, 110];

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, { dateStyle: "long", timeStyle: "short" });
}

type Pdf = InstanceType<typeof import("jspdf").jsPDF>;

function lastY(pdf: Pdf): number {
  return (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
}

export function interviewPdfFileName(interview: InterviewDetail): string {
  return `${interview.sessionId}_${interview.memberName}`.replace(/[^\w.-]+/g, "_") + ".pdf";
}

export async function exportInterviewPdf(
  interview: InterviewDetail,
  settings: PromotionSettingsValues
): Promise<void> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);

  const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const contentWidth = pageWidth - MARGIN * 2;
  let y = MARGIN;

  // ── Title ────────────────────────────────────────────────────────────────
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  pdf.setTextColor(...RED);
  pdf.text("EMS PROMOTION EXAMINATION REPORT", pageWidth / 2, y, { align: "center" });
  y += 18;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(...MUTED);
  pdf.text(interview.sessionId, pageWidth / 2, y, { align: "center" });
  y += 10;
  pdf.setDrawColor(...RED);
  pdf.setLineWidth(1.5);
  pdf.line(MARGIN, y, pageWidth - MARGIN, y);
  y += 18;

  // An unsettled session must not be mistakable for a result.
  if (interview.status !== "Finalized") {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.setTextColor(...RED);
    pdf.text(`${interview.status.toUpperCase()} — NO RESULT RECORDED`, pageWidth / 2, y, { align: "center" });
    y += 18;
  }

  const asOf = interview.finalizedAt ?? undefined;
  const summary: [string, string][] = [
    ["Candidate", [interview.memberName, interview.callSign].filter(Boolean).join(" · ")],
    ["Examined rank", `${interview.currentRank} → ${interview.targetRank}`],
    ["Time in rank", formatDuration(interview.rankSince, asOf)],
    ["EMS tenure", formatDuration(interview.joinedEmsAt, asOf)],
    ["Status", interview.status],
    ["Result", interview.result],
    [
      "Panel score",
      interview.finalScore !== null
        ? `${interview.finalScore}% (passing ${settings.passingScore}%)`
        : interview.scores.finalScore !== null
          ? `${interview.scores.finalScore}% (live, not final)`
          : "—",
    ],
    ["Opened", `${formatDate(interview.createdAt)} by ${interview.createdByName}`],
  ];
  if (interview.scheduledAt) {
    summary.push(["Scheduled", [formatDate(interview.scheduledAt), interview.location].filter(Boolean).join(" · ")]);
  }
  if (interview.finalizedAt) {
    summary.push(["Finalized", `${formatDate(interview.finalizedAt)} by ${interview.finalizedByName ?? "—"}`]);
  }
  if (interview.reviewedAt) {
    summary.push(["Management review", `${formatDate(interview.reviewedAt)} by ${interview.reviewedByName ?? "—"}`]);
    if (interview.reviewNote) summary.push(["Review reason", interview.reviewNote]);
  }
  if (interview.rosterUpdated) summary.push(["Roster", `Promoted to ${interview.targetRank}`]);
  if (interview.cooldownUntil) summary.push(["Reattempt from", formatDate(interview.cooldownUntil)]);
  if (interview.eligibilityOverride) summary.push(["Eligibility", "Opened despite failing eligibility (overridden)"]);
  for (const w of interview.eligibilityWaivers) {
    summary.push([`Waived: ${w.label}`, `${w.waivedBy}${w.reason ? ` — ${w.reason}` : ""}`]);
  }

  autoTable(pdf, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    theme: "plain",
    styles: { fontSize: 9, cellPadding: 3, textColor: INK },
    columnStyles: { 0: { cellWidth: 120, fontStyle: "bold", textColor: MUTED }, 1: { cellWidth: contentWidth - 120 } },
    body: summary,
  });
  y = lastY(pdf) + 18;

  // ── Category averages ────────────────────────────────────────────────────
  const categories = interview.categoryScores ?? interview.scores.categories;
  autoTable(pdf, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    theme: "grid",
    head: [["CATEGORY", "PANEL AVERAGE", "MINIMUM", "MET"]],
    headStyles: { fillColor: RED, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9 },
    styles: { fontSize: 9, cellPadding: 5, textColor: INK, lineColor: [220, 220, 220] },
    body: EVALUATION_CATEGORIES.map((c) => {
      const value = categories[c.key] ?? null;
      const floor = categoryFloor(settings, c.key);
      return [c.label, value === null ? "—" : `${value}%`, `${floor}%`, value === null ? "—" : value >= floor ? "Yes" : "No"];
    }),
  });
  y = lastY(pdf) + 18;

  // ── Panel ────────────────────────────────────────────────────────────────
  autoTable(pdf, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    theme: "grid",
    head: [["PANELIST", "ROLE", "SOP", "MED", "SIT", "OVR", "SCORE", "RECOMMENDATION"]],
    headStyles: { fillColor: RED, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
    styles: { fontSize: 8, cellPadding: 4, textColor: INK, lineColor: [220, 220, 220] },
    body: interview.panel.map((p) => {
      const scoring = isScoringRole(p.role);
      const cell = (v: number | null) => (scoring && p.submittedAt && v !== null ? String(v) : "—");
      return [
        [p.name, p.rank].filter(Boolean).join("\n"),
        p.role,
        cell(p.sopScore),
        cell(p.medicalScore),
        cell(p.situationScore),
        cell(p.overallScore),
        !scoring ? "Observer" : p.submittedAt && p.individualScore !== null ? `${p.individualScore}` : "Not submitted",
        p.recommendation ?? "—",
      ];
    }),
  });
  y = lastY(pdf) + 18;

  // ── Interviewer notes ────────────────────────────────────────────────────
  const noteRows: [string, string][] = [];
  for (const p of interview.panel) {
    if (!p.submittedAt) continue;
    for (const c of EVALUATION_CATEGORIES) {
      const note = p[`${c.key}Notes`];
      if (note) noteRows.push([`${p.name} — ${c.label}`, note]);
    }
  }
  for (const n of interview.notes) noteRows.push([`${n.authorName} — ${formatDate(n.createdAt)}`, n.body]);
  if (interview.improvementNotes) noteRows.push(["Improvement recommendations", interview.improvementNotes]);

  if (noteRows.length) {
    autoTable(pdf, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      theme: "grid",
      head: [["NOTES", ""]],
      headStyles: { fillColor: RED, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9 },
      styles: { fontSize: 8.5, cellPadding: 5, textColor: INK, lineColor: [220, 220, 220] },
      columnStyles: { 0: { cellWidth: 150, fontStyle: "bold" }, 1: { cellWidth: contentWidth - 150 } },
      body: noteRows,
    });
  }

  // ── Footer on every page ─────────────────────────────────────────────────
  const pages = pdf.getNumberOfPages();
  const printed = new Date().toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  for (let page = 1; page <= pages; page++) {
    pdf.setPage(page);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.setTextColor(...MUTED);
    pdf.text(`${interview.sessionId} · Printed ${printed}`, MARGIN, pageHeight - MARGIN / 2);
    pdf.text(`Page ${page} of ${pages}`, pageWidth - MARGIN, pageHeight - MARGIN / 2, { align: "right" });
  }

  pdf.save(interviewPdfFileName(interview));
}
