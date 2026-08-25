import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const FIELD_MAP: Record<string, string> = {
  coc: "cadetPhase1COC",
  cocBy: "cadetPhase1COCby",
  pcrs: "cadetPhase1PCRS",
  pcrsBy: "cadetPhase1PCRSby",
  useOfForce: "cadetPhase1UoF",
  useOfForceBy: "cadetPhase1UoFby",
  situationResponding: "cadetPhase1Situation",
  situationRespondingBy: "cadetPhase1Situationby",
  legalKnowledge: "cadetPhase2Legal",
  legalKnowledgeBy: "cadetPhase2Legalby",
  basicConstitution: "cadetPhase2Constitution",
  basicConstitutionBy: "cadetPhase2Constitutionby",
  radioEtiquette: "cadetPhase2Radio",
  radioEtiquetteBy: "cadetPhase2Radioby",
  reportProcessing: "cadetPhase2Report",
  reportProcessingBy: "cadetPhase2Reportby",
  negotiationTraining: "cadetPhase3Negotiation",
  negotiationTrainingBy: "cadetPhase3Negotiationby",
  hostageHandling: "cadetPhase3Hostage",
  hostageHandlingBy: "cadetPhase3Hostageby",
  trafficStopTraining: "cadetPhase3Traffic",
  trafficStopTrainingBy: "cadetPhase3Trafficby",
  ticketIssuing: "cadetPhase3Ticket",
  ticketIssuingBy: "cadetPhase3Ticketby",
  pursuit: "cadetPhase3Pursuit",
  pursuitBy: "cadetPhase3Pursuitby",
  phase2SignOff: "phase2Signoff",
  phase3SignOff: "phase3Signoff",
};

function mapFields(body: Record<string, unknown>): Record<string, unknown> {
  const mapped: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    const prismaKey = FIELD_MAP[key] ?? key;
    mapped[prismaKey] = value;
  }
  return mapped;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    const { memberId } = await params;

    let record = await prisma.trainingRecord.findUnique({
      where: { memberId },
      include: {
        remarks: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!record) {
      record = await prisma.trainingRecord.create({
        data: { memberId },
        include: {
          remarks: true,
        },
      });
    }

    return NextResponse.json(record);
  } catch (error) {
    console.error("Error fetching training record:", error);
    return NextResponse.json({ error: "Failed to fetch record" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    const { memberId } = await params;
    const body = await request.json();
    const mapped = mapFields(body);

    const record = await prisma.trainingRecord.upsert({
      where: { memberId },
      update: mapped,
      create: {
        memberId,
        ...mapped,
      },
    });

    return NextResponse.json(record);
  } catch (error) {
    console.error("Error updating training record:", error);
    return NextResponse.json({ error: "Failed to update record" }, { status: 500 });
  }
}
