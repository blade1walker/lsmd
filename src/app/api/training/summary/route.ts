import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isDenied } from "@/lib/api-auth";

function mapRecord(record: any) {
  return {
    id: record.id,
    memberId: record.memberId,
    member: record.member,
    // Phase 1
    coc: record.cadetPhase1COC,
    cocBy: record.cadetPhase1COCby,
    pcrs: record.cadetPhase1PCRS,
    pcrsBy: record.cadetPhase1PCRSby,
    useOfForce: record.cadetPhase1UoF,
    useOfForceBy: record.cadetPhase1UoFby,
    situationResponding: record.cadetPhase1Situation,
    situationRespondingBy: record.cadetPhase1Situationby,
    // Phase 2
    legalKnowledge: record.cadetPhase2Legal,
    legalKnowledgeBy: record.cadetPhase2Legalby,
    basicConstitution: record.cadetPhase2Constitution,
    basicConstitutionBy: record.cadetPhase2Constitutionby,
    radioEtiquette: record.cadetPhase2Radio,
    radioEtiquetteBy: record.cadetPhase2Radioby,
    reportProcessing: record.cadetPhase2Report,
    reportProcessingBy: record.cadetPhase2Reportby,
    // Phase 3
    negotiationTraining: record.cadetPhase3Negotiation,
    negotiationTrainingBy: record.cadetPhase3Negotiationby,
    hostageHandling: record.cadetPhase3Hostage,
    hostageHandlingBy: record.cadetPhase3Hostageby,
    trafficStopTraining: record.cadetPhase3Traffic,
    trafficStopTrainingBy: record.cadetPhase3Trafficby,
    ticketIssuing: record.cadetPhase3Ticket,
    ticketIssuingBy: record.cadetPhase3Ticketby,
    pursuit: record.cadetPhase3Pursuit,
    pursuitBy: record.cadetPhase3Pursuitby,
    // Probationary
    probationaryReportNumber: record.probationaryReportNumber,
    probationaryTrafficStops: record.probationaryTrafficStops,
    probationaryMDTReports: record.probationaryMDTReports,
    probationaryNegotiation: record.probationaryNegotiation,
    probationaryNegotiationBy: record.probationaryNegotiationby,
    probationaryCommunication: record.probationaryCommunication,
    probationaryCommunicationBy: record.probationaryCommunicationby,
    probationaryRecommendation: record.probationaryRecommendation,
    probationaryRecommendationBy: record.probationaryRecommendationby,
    probationaryTheory: record.probationaryTheory,
    probationaryTheoryBy: record.probationaryTheoryby,
    probationaryPractical: record.probationaryPractical,
    probationaryPracticalBy: record.probationaryPracticalby,
    probationaryStatus: record.probationaryStatus,
    // Phase sign-offs
    phase2SignOff: record.phase2Signoff,
    phase2SignedBy: record.phase2SignedBy,
    phase2SignedAt: record.phase2SignedAt,
    phase3SignOff: record.phase3Signoff,
    phase3SignedBy: record.phase3SignedBy,
    phase3SignedAt: record.phase3SignedAt,
  };
}

export async function GET() {
  const auth = await requireAuth("training.view");
  if (isDenied(auth)) return auth.error;

  try {
    const records = await prisma.trainingRecord.findMany({
      include: {
        member: {
          select: { name: true, callSign: true, rank: true, ftoRole: true },
        },
      },
    });

    return NextResponse.json(records.map(mapRecord));
  } catch (error) {
    console.error("Error fetching training summary:", error);
    return NextResponse.json({ error: "Failed to fetch training" }, { status: 500 });
  }
}
