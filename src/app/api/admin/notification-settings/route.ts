import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    let settings = await prisma.notificationSettings.findUnique({
      where: { id: "singleton" },
    });

    if (!settings) {
      settings = await prisma.notificationSettings.create({
        data: { id: "singleton" },
      });
    }

    return NextResponse.json(settings);
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to fetch settings", detail: error.message?.slice(0, 200) },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();

    let settings = await prisma.notificationSettings.findUnique({
      where: { id: "singleton" },
    });

    if (!settings) {
      settings = await prisma.notificationSettings.create({
        data: { id: "singleton", ...body },
      });
    } else {
      settings = await prisma.notificationSettings.update({
        where: { id: "singleton" },
        data: body,
      });
    }

    return NextResponse.json(settings);
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to update settings", detail: error.message?.slice(0, 200) },
      { status: 500 }
    );
  }
}
