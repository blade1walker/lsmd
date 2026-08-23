import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const requests = await prisma.fTPRequest.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(requests);
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to fetch FTP requests", detail: error.message?.slice(0, 200) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const request = await prisma.fTPRequest.create({
      data: {
        characterName: body.characterName,
        discordId: body.discordId,
        currentRole: body.currentRole,
        previousExperience: body.previousExperience,
        department: body.department,
      },
    });
    return NextResponse.json(request, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to submit FTP request", detail: error.message?.slice(0, 200) },
      { status: 500 }
    );
  }
}
