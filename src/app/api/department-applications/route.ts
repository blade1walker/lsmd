import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import { DEPARTMENT_PERMISSIONS } from "@/lib/constants";

/** Join applications awaiting review, newest first. `?departmentId=` narrows to one department. */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(DEPARTMENT_PERMISSIONS.view);
  if (isDenied(auth)) return auth.error;

  try {
    const departmentId = req.nextUrl.searchParams.get("departmentId");

    const applications = await prisma.departmentApplication.findMany({
      where: departmentId ? { departmentId } : undefined,
      orderBy: { createdAt: "desc" },
      include: {
        department: { select: { id: true, name: true, tag: true, color: true } },
      },
    });

    return NextResponse.json(applications);
  } catch (error) {
    return apiError("Failed to fetch department applications", error);
  }
}
