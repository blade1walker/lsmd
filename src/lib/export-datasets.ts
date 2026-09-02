import { prisma } from "./prisma";
import { shiftSlotLabel } from "./shifts";

/**
 * Every table behind an admin page, in one place, so "export everything" is a
 * list rather than thirty hand-written endpoints.
 *
 * Deliberately excluded:
 * - NotificationSettings — holds the bot token and every webhook URL. Those are
 *   credentials, and an export is a file that leaves the building.
 * - SopContent — the legacy single-row SOP, superseded by SopDocument. Its
 *   content is already in the SOP documents sheet.
 */

/** Longest value kept in one cell. Excel's own hard limit is 32,767 characters. */
const MAX_CELL_LENGTH = 32000;

export interface DatasetDefinition {
  key: string;
  label: string;
  /** The admin page this data backs, so the export reads the way the panel does. */
  page: string;
  fetch: () => Promise<Record<string, unknown>[]>;
}

export interface ExportedDataset {
  key: string;
  label: string;
  page: string;
  columns: string[];
  rows: (string | number)[][];
}

/**
 * One value as it belongs in a spreadsheet cell. Dates go out in ISO so they
 * sort correctly, booleans read as Yes/No rather than TRUE/FALSE, and a JSON
 * column is stringified rather than rendered as "[object Object]".
 */
function cell(value: unknown): string | number {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return value;
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  return text.length > MAX_CELL_LENGTH ? `${text.slice(0, MAX_CELL_LENGTH)}… [truncated]` : text;
}

export const DATASETS: DatasetDefinition[] = [
  {
    key: "sections",
    label: "Roster Sections",
    page: "Roster",
    fetch: () => prisma.section.findMany({ orderBy: { order: "asc" } }),
  },
  {
    key: "members",
    label: "Roster Members",
    page: "Roster",
    fetch: async () =>
      (await prisma.member.findMany({ include: { section: true }, orderBy: { order: "asc" } })).map((m) => ({
        ...m,
        section: m.section?.name ?? "",
      })),
  },
  {
    key: "clockEntries",
    label: "Clock Entries",
    page: "Clock Log",
    fetch: async () =>
      (await prisma.clockEntry.findMany({ include: { member: true }, orderBy: { clockInAt: "desc" } })).map((e) => ({
        ...e,
        member: e.member.name,
        callSign: e.member.callSign ?? "",
        durationMinutes: e.durationSec != null ? Math.round(e.durationSec / 60) : "",
      })),
  },
  {
    key: "loas",
    label: "Leaves of Absence",
    page: "HR",
    fetch: async () =>
      (await prisma.lOA.findMany({ include: { member: true }, orderBy: { createdAt: "desc" } })).map((l) => ({
        ...l,
        member: l.member.name,
        callSign: l.member.callSign ?? "",
      })),
  },
  {
    key: "inactivityRequests",
    label: "Inactivity Requests",
    page: "HR",
    fetch: async () =>
      (await prisma.inactivityRequest.findMany({ include: { member: true }, orderBy: { createdAt: "desc" } })).map((r) => ({
        ...r,
        member: r.member.name,
      })),
  },
  {
    key: "removalRequests",
    label: "Removal Requests",
    page: "HR",
    fetch: () => prisma.removalRequest.findMany({ orderBy: { createdAt: "desc" } }),
  },
  {
    key: "onboardingRequests",
    label: "Onboarding Requests",
    page: "Onboarding",
    fetch: () => prisma.onboardingRequest.findMany({ orderBy: { createdAt: "desc" } }),
  },
  {
    key: "recruitRequests",
    label: "Recruit Requests",
    page: "Recruit",
    fetch: () => prisma.recruitRequest.findMany({ orderBy: { createdAt: "desc" } }),
  },
  {
    key: "ftpRequests",
    label: "FTP Requests",
    page: "Recruit",
    fetch: () => prisma.fTPRequest.findMany({ orderBy: { createdAt: "desc" } }),
  },
  {
    key: "departments",
    label: "Departments",
    page: "Departments",
    fetch: () => prisma.departmentTemplate.findMany({ orderBy: { order: "asc" } }),
  },
  {
    key: "departmentQuestions",
    label: "Department Join Questions",
    page: "Departments",
    fetch: async () =>
      (await prisma.departmentQuestion.findMany({ include: { department: true }, orderBy: { order: "asc" } })).map((q) => ({
        ...q,
        department: q.department.name,
      })),
  },
  {
    key: "departmentApplications",
    label: "Department Applications",
    page: "Departments",
    fetch: async () =>
      (await prisma.departmentApplication.findMany({ include: { department: true }, orderBy: { createdAt: "desc" } })).map(
        (a) => ({ ...a, department: a.department.name })
      ),
  },
  {
    key: "departmentMemberships",
    label: "Department Members",
    page: "Departments",
    fetch: async () =>
      (await prisma.departmentMembership.findMany({ include: { department: true, member: true } })).map((m) => ({
        ...m,
        department: m.department.name,
        member: m.member.name,
        callSign: m.member.callSign ?? "",
      })),
  },
  {
    key: "shiftSignups",
    label: "Shift Signups",
    page: "Shifts",
    fetch: async () =>
      (await prisma.shiftSignup.findMany({ include: { member: true } })).map((s) => ({
        ...s,
        member: s.member.name,
        callSign: s.member.callSign ?? "",
        primaryShift: shiftSlotLabel(s.primarySlot),
        secondaryShift: shiftSlotLabel(s.secondarySlot),
      })),
  },
  {
    key: "trainingRecords",
    label: "Training Records",
    page: "Training",
    fetch: async () =>
      (await prisma.trainingRecord.findMany({ include: { member: true } })).map((t) => ({
        ...t,
        member: t.member.name,
        callSign: t.member.callSign ?? "",
      })),
  },
  {
    key: "remarks",
    label: "Training Remarks",
    page: "Training",
    fetch: async () =>
      (
        await prisma.remark.findMany({
          include: { trainingRecord: { include: { member: true } } },
          orderBy: { createdAt: "desc" },
        })
      ).map((r) => ({ ...r, trainingRecord: r.trainingRecord.member.name })),
  },
  {
    key: "signOffDefinitions",
    label: "Sign-off Definitions",
    page: "Sign-offs",
    fetch: () => prisma.signOffDefinition.findMany({ orderBy: { order: "asc" } }),
  },
  {
    key: "ftoSignOffRecords",
    label: "FTO Sign-off Records",
    page: "Sign-offs",
    fetch: async () =>
      (
        await prisma.fTOSignOffRecord.findMany({
          include: { ftoMember: true, signOffDefinition: true },
          orderBy: { completedAt: "desc" },
        })
      ).map((r) => ({
        ...r,
        ftoMember: r.ftoMember.name,
        signOffDefinition: r.signOffDefinition.name,
      })),
  },
  {
    key: "radioCodes",
    label: "Radio Codes",
    page: "Radio Codes",
    fetch: () => prisma.radioCode.findMany({ orderBy: { order: "asc" } }),
  },
  {
    key: "sopDocuments",
    label: "SOP Documents",
    page: "SOP",
    fetch: () => prisma.sopDocument.findMany({ orderBy: { order: "asc" } }),
  },
  {
    key: "adminUsers",
    label: "Admin Users",
    page: "Roles",
    fetch: async () =>
      (await prisma.adminUser.findMany({ include: { role: true, roles: true } })).map((u) => ({
        ...u,
        role: u.role?.name ?? "",
        roles: u.roles.map((r) => r.name).join(", "),
      })),
  },
  {
    key: "adminRoles",
    label: "Admin Roles",
    page: "Roles",
    fetch: async () =>
      (await prisma.adminRole.findMany({ orderBy: { order: "asc" } })).map((r) => ({
        ...r,
        permissions: r.permissions.join(", "),
      })),
  },
  {
    key: "tempRankTemplates",
    label: "Temp Rank Templates",
    page: "Templates",
    fetch: () => prisma.tempRankTemplate.findMany({ orderBy: { order: "asc" } }),
  },
  {
    key: "categoryTemplates",
    label: "Category Templates",
    page: "Templates",
    fetch: () => prisma.categoryTemplate.findMany({ orderBy: { order: "asc" } }),
  },
  {
    key: "promotionNotifications",
    label: "Promotion Notifications",
    page: "Notifications",
    fetch: () => prisma.promotionNotification.findMany({ orderBy: { createdAt: "desc" } }),
  },
  {
    key: "notificationLogs",
    label: "Notification Deliveries",
    page: "Notify Settings",
    fetch: () => prisma.notificationLog.findMany({ orderBy: { createdAt: "desc" } }),
  },
  {
    key: "dmThreads",
    label: "Bot DM Threads",
    page: "Bot Messaging",
    fetch: () => prisma.dMThread.findMany({ orderBy: { lastMessageAt: "desc" } }),
  },
  {
    key: "directMessages",
    label: "Bot Direct Messages",
    page: "Bot Messaging",
    fetch: async () =>
      (await prisma.directMessage.findMany({ include: { thread: true }, orderBy: { sentAt: "desc" } })).map((m) => ({
        ...m,
        thread: m.thread.memberName ?? m.thread.username ?? m.thread.discordId,
      })),
  },
  {
    key: "auditLogs",
    label: "Audit Log",
    page: "Audit Log",
    fetch: () => prisma.auditLog.findMany({ orderBy: { createdAt: "desc" } }),
  },
  {
    key: "deletionLogs",
    label: "Deleted Records",
    page: "Restore",
    fetch: () => prisma.deletionLog.findMany({ orderBy: { deletedAt: "desc" } }),
  },
];

export const DATASET_KEYS = DATASETS.map((d) => d.key);

/** Column order follows first appearance across the rows, so `id` stays first. */
function columnsOf(rows: Record<string, unknown>[]): string[] {
  const seen: string[] = [];
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!seen.includes(key)) seen.push(key);
    }
  }
  return seen;
}

/**
 * Runs one dataset's query and shapes it into columns + rows.
 *
 * A dataset that throws — most likely its table has not been pushed to this
 * database yet — comes back empty rather than failing the whole export, so one
 * missing table cannot cost the user every other sheet.
 */
export async function loadDataset(definition: DatasetDefinition): Promise<ExportedDataset> {
  let records: Record<string, unknown>[] = [];
  try {
    records = await definition.fetch();
  } catch (error) {
    console.error(`Export: failed to read "${definition.key}":`, error);
  }

  const columns = columnsOf(records);
  return {
    key: definition.key,
    label: definition.label,
    page: definition.page,
    columns,
    rows: records.map((record) => columns.map((column) => cell(record[column]))),
  };
}
