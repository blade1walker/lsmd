import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api-error";

export async function GET() {
  try {
    const requests = await prisma.fTPRequest.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(requests);
  } catch (error) {
      return apiError("Failed to fetch FTP requests", error);
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
  } catch (error) {
      return apiError("Failed to submit FTP request", error);
  }
}
