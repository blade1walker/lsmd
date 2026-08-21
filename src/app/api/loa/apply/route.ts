import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { postToLOAWebhook } from "@/lib/discord-webhook";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const loa = await prisma.lOA.create({
      data: {
        memberId: body.memberId,
        reason: body.reason,
        startDate: new Date(body.startDate),
        endDate: new Date(body.endDate),
        status: "Pending",
        notes: body.notes,
        createdBy: body.createdBy || "self",
      },
      include: { member: true },
    });

    await postToLOAWebhook({
      title: "LOA Requested",
      description: `**${loa.member.name}** has requested a Leave of Absence.`,
      color: 0xf59e0b,
      fields: [
        { name: "Member", value: loa.member.name, inline: true },
        { name: "Rank", value: loa.member.rank, inline: true },
        { name: "Call Sign", value: loa.member.callSign || "N/A", inline: true },
        { name: "Start Date", value: loa.startDate.toLocaleDateString(), inline: true },
        { name: "End Date", value: loa.endDate.toLocaleDateString(), inline: true },
        { name: "Reason", value: loa.reason || "Not specified", inline: false },
        { name: "Status", value: "Pending", inline: true },
      ],
    });

    return NextResponse.json(loa, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to apply for LOA", detail: error.message?.slice(0, 200) },
      { status: 500 }
    );
  }
}
