import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied } from "@/lib/api-auth";

function escapeCsvField(field: string | null | undefined): string {
  if (field == null) return "";
  const str = String(field);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsv(headers: string[], rows: (string | null | undefined)[][]): string {
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(row.map(escapeCsvField).join(","));
  }
  return lines.join("\n");
}

export async function GET(request: Request) {
  // The CSV carries discordId, stateId and joining dates, so a bare "is there
  // a token" check was not enough — that passed for any signed-in account.
  const auth = await requireAuth("roster.view");
  if (isDenied(auth)) return auth.error;

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");

  if (type === "members") {
    const members = await prisma.member.findMany({
      include: { section: true },
      orderBy: { order: "asc" },
    });

    const headers = ["Name", "Rank", "Call Sign", "Department", "Section", "Status", "Temp Rank", "Category", "Timezone", "Discord ID", "Date of Joining"];
    const rows = members.map((m) => [
      m.name,
      m.rank,
      m.callSign,
      m.dept,
      m.section?.name ?? "",
      m.activity,
      m.tempRank,
      m.category,
      m.timezone,
      m.discordId,
      m.dateOfJoining?.toISOString().split("T")[0] ?? "",
    ]);

    const csv = toCsv(headers, rows);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": 'attachment; filename="members.csv"',
      },
    });
  }

  if (type === "clock") {
    const entries = await prisma.clockEntry.findMany({
      include: { member: true },
      orderBy: { clockInAt: "desc" },
    });

    const headers = ["Member", "Call Sign", "Clock In", "Clock Out", "Duration (min)", "Status"];
    const rows = entries.map((e) => [
      e.member.name,
      e.member.callSign,
      e.clockInAt.toISOString(),
      e.clockOutAt?.toISOString() ?? "",
      e.durationSec != null ? String(Math.round(e.durationSec / 60)) : "",
      e.clockOutAt ? "Completed" : "Active",
    ]);

    const csv = toCsv(headers, rows);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": 'attachment; filename="clock-log.csv"',
      },
    });
  }

  return NextResponse.json({ error: "Invalid type parameter" }, { status: 400 });
}
