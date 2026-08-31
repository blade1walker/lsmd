import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied, actorLabel } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import { logAudit } from "@/lib/audit";
import {
  describeResult,
  getNotificationSettings,
  postToWebhookContent,
  resolveWebhookSource,
  type WebhookKind,
} from "@/lib/discord-webhook";

/** Discord refuses a message body over 2000 characters. */
const MAX_LENGTH = 2000;

const WEBHOOK_KINDS: WebhookKind[] = [
  "recruit",
  "onboarding",
  "ftp",
  "department",
  "loa",
  "promotion",
  "callsign",
];

const KIND_LABELS: Record<WebhookKind, string> = {
  recruit: "Recruit",
  onboarding: "Onboarding",
  ftp: "FTP",
  department: "Department joins",
  loa: "LOA",
  promotion: "Promotion / demotion",
  callsign: "Call sign",
};

/**
 * Where a manual post can be sent. Configured channels first, then any
 * department carrying a webhook of its own — those are real channels too, and
 * having to paste their URL back in would be silly.
 *
 * URLs are never returned: they are credentials, and the caller only needs to
 * name a target the send route can resolve for itself.
 */
export async function GET() {
  const auth = await requireAuth("notifications");
  if (isDenied(auth)) return auth.error;

  try {
    const settings = await getNotificationSettings();

    const channels = await Promise.all(
      WEBHOOK_KINDS.map(async (kind) => {
        const source = await resolveWebhookSource(kind, settings);
        return {
          value: `kind:${kind}`,
          label: KIND_LABELS[kind],
          configured: Boolean(source.url),
          // Names the channel it actually lands in when this kind borrows another's.
          borrowsFrom: source.kind && source.kind !== kind ? KIND_LABELS[source.kind] : null,
        };
      })
    );

    const departments = await prisma.departmentTemplate.findMany({
      where: { webhookUrl: { not: null } },
      orderBy: { order: "asc" },
      select: { id: true, name: true },
    });

    return NextResponse.json({
      channels,
      departments: departments.map((d) => ({
        value: `department:${d.id}`,
        label: `${d.name} (department)`,
        configured: true,
        borrowsFrom: null,
      })),
    });
  } catch (error) {
    return apiError("Failed to load webhook targets", error);
  }
}

/** Resolves a target token from the picker, or a pasted URL, to a real webhook URL. */
async function resolveTarget(
  target: string,
  customUrl: string
): Promise<{ url: string; label: string } | { error: string }> {
  if (target === "custom") {
    if (!/^https?:\/\//i.test(customUrl)) {
      return { error: "Enter a valid http(s) webhook URL" };
    }
    return { url: customUrl, label: "custom URL" };
  }

  if (target.startsWith("kind:")) {
    const kind = target.slice(5) as WebhookKind;
    if (!WEBHOOK_KINDS.includes(kind)) return { error: `Unknown channel "${kind}"` };
    const source = await resolveWebhookSource(kind);
    if (!source.url) return { error: `No webhook URL configured for ${KIND_LABELS[kind]}` };
    return { url: source.url, label: KIND_LABELS[kind] };
  }

  if (target.startsWith("department:")) {
    const department = await prisma.departmentTemplate.findUnique({
      where: { id: target.slice(11) },
      select: { name: true, webhookUrl: true },
    });
    if (!department) return { error: "Department not found" };
    if (!department.webhookUrl) return { error: `${department.name} has no webhook of its own` };
    return { url: department.webhookUrl, label: department.name };
  }

  return { error: "Pick a channel to post to" };
}

/**
 * Posts a hand-written message to a channel. Goes through the same helper the
 * automated posts use, so it lands in the delivery log alongside them.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAuth("notifications");
  if (isDenied(auth)) return auth.error;

  try {
    const body = (await req.json()) as { target?: string; url?: string; content?: string };
    const content = String(body.content ?? "").trim();

    if (!content) {
      return NextResponse.json({ error: "Message cannot be empty" }, { status: 400 });
    }
    if (content.length > MAX_LENGTH) {
      return NextResponse.json(
        { error: `Discord rejects anything over ${MAX_LENGTH} characters` },
        { status: 400 }
      );
    }

    const resolved = await resolveTarget(
      String(body.target ?? ""),
      String(body.url ?? "").trim()
    );
    if ("error" in resolved) {
      return NextResponse.json({ error: resolved.error }, { status: 400 });
    }

    const performedBy = actorLabel(auth.access);
    const result = await postToWebhookContent(
      resolved.url,
      content,
      "manual.webhook",
      resolved.label
    );

    await logAudit({
      action: "create",
      entityType: "WebhookMessage",
      entityId: resolved.label,
      entityLabel: `Post to ${resolved.label}`,
      details: { ok: result.ok, preview: content.slice(0, 120) },
      performedBy,
    });

    return NextResponse.json(
      { ok: result.ok, detail: describeResult(result), target: resolved.label },
      { status: result.ok ? 200 : 502 }
    );
  } catch (error) {
    return apiError("Failed to post message", error);
  }
}
