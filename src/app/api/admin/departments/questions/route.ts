import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import { DEPARTMENT_PERMISSIONS } from "@/lib/constants";
import { isQuestionType } from "@/lib/departments";

/**
 * The join-form builder. One question per row, ordered — the public form
 * renders exactly what is here, so a department can ask whatever it needs
 * instead of the single fixed "previous experience" box the FTP form had.
 */

function readFields(
  body: Record<string, unknown>,
  { partial }: { partial: boolean }
): Record<string, unknown> | { error: string } {
  const data: Record<string, unknown> = {};

  if (body.label !== undefined || !partial) {
    const label = String(body.label ?? "").trim();
    if (!label) return { error: "Question text is required" };
    data.label = label;
  }

  if (body.type !== undefined || !partial) {
    const type = String(body.type ?? "textarea");
    if (!isQuestionType(type)) return { error: `"${type}" is not a question type` };
    data.type = type;
  }

  if (body.options !== undefined) {
    const raw = Array.isArray(body.options) ? body.options : [];
    const options = raw
      .map((o) => String(o ?? "").trim())
      .filter((o, i, all) => o !== "" && all.indexOf(o) === i);
    data.options = options;
  }

  if (body.placeholder !== undefined) {
    const placeholder = String(body.placeholder ?? "").trim();
    data.placeholder = placeholder || null;
  }

  if (body.required !== undefined) data.required = Boolean(body.required);
  if (body.order !== undefined) data.order = Number(body.order) || 0;

  // A multiple-choice question with no choices is unanswerable, so it is
  // rejected here rather than rendering as an empty dropdown on the form.
  const type = (data.type as string | undefined) ?? (partial ? undefined : "textarea");
  if (type === "select" && Array.isArray(data.options) && data.options.length === 0) {
    return { error: "A multiple-choice question needs at least one choice" };
  }

  return data;
}

export async function POST(request: Request) {
  const auth = await requireAuth(DEPARTMENT_PERMISSIONS.manage);
  if (isDenied(auth)) return auth.error;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const departmentId = String(body.departmentId ?? "");
    if (!departmentId) {
      return NextResponse.json({ error: "departmentId required" }, { status: 400 });
    }

    const data = readFields(body, { partial: false });
    if ("error" in data) {
      return NextResponse.json({ error: data.error as string }, { status: 400 });
    }

    // Appended to the end unless the caller says otherwise, so adding a
    // question never reshuffles the ones already on the form.
    if (data.order === undefined) {
      data.order = await prisma.departmentQuestion.count({ where: { departmentId } });
    }

    const question = await prisma.departmentQuestion.create({
      data: { departmentId, options: [], ...data } as never,
    });

    return NextResponse.json(question, { status: 201 });
  } catch (error) {
    return apiError("Failed to add question", error);
  }
}

export async function PATCH(request: Request) {
  const auth = await requireAuth(DEPARTMENT_PERMISSIONS.manage);
  if (isDenied(auth)) return auth.error;

  try {
    const body = (await request.json()) as Record<string, unknown>;

    // A reorder sends the whole ordered list at once; a field edit sends one id.
    if (Array.isArray(body.order)) {
      const ids = (body.order as unknown[]).map((id) => String(id));
      await prisma.$transaction(
        ids.map((id, index) =>
          prisma.departmentQuestion.update({ where: { id }, data: { order: index } })
        )
      );
      return NextResponse.json({ success: true });
    }

    const id = String(body.id ?? "");
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

    const data = readFields(body, { partial: true });
    if ("error" in data) {
      return NextResponse.json({ error: data.error as string }, { status: 400 });
    }

    const question = await prisma.departmentQuestion.update({
      where: { id },
      data: data as never,
    });

    return NextResponse.json(question);
  } catch (error) {
    return apiError("Failed to update question", error);
  }
}

export async function DELETE(request: Request) {
  const auth = await requireAuth(DEPARTMENT_PERMISSIONS.manage);
  if (isDenied(auth)) return auth.error;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

    // Answers already submitted keep their own copy of the label, so removing
    // a question never blanks out what past applicants were asked.
    await prisma.departmentQuestion.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError("Failed to delete question", error);
  }
}
