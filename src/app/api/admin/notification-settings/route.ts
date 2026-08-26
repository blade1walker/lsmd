import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";

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
  } catch (error) {
      return apiError("Failed to fetch settings", error);
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAuth("notifications");
  if (isDenied(auth)) return auth.error;

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
  } catch (error) {
      return apiError("Failed to update settings", error);
  }
}
