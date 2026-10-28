-- CreateTable
CREATE TABLE "Section" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Member" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "order" INTEGER NOT NULL DEFAULT 0,
    "name" TEXT NOT NULL,
    "dept" TEXT NOT NULL DEFAULT 'LSMD',
    "rank" TEXT NOT NULL,
    "stateId" TEXT,
    "steamId" TEXT,
    "position" TEXT,
    "callSign" TEXT,
    "activity" TEXT NOT NULL DEFAULT 'Active',
    "ptd" BOOLEAN NOT NULL DEFAULT false,
    "hr" BOOLEAN NOT NULL DEFAULT false,
    "asd" BOOLEAN NOT NULL DEFAULT false,
    "bike" BOOLEAN NOT NULL DEFAULT false,
    "speedUnit" BOOLEAN NOT NULL DEFAULT false,
    "timezone" TEXT,
    "dateOfJoining" DATETIME,
    "lastPromotion" DATETIME,
    "discordId" TEXT,
    "ftoRole" TEXT,
    "tempRank" TEXT,
    "category" TEXT,
    "sectionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Member_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClockEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "memberId" TEXT NOT NULL,
    "clockInAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clockOutAt" DATETIME,
    "durationSec" INTEGER,
    "source" TEXT NOT NULL DEFAULT 'site',
    CONSTRAINT "ClockEntry_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SopContent" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'sop-main',
    "content" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SopDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "order" INTEGER NOT NULL DEFAULT 0,
    "relatedLinks" JSONB NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "TrainingRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "memberId" TEXT NOT NULL,
    "cadetPhase1COC" BOOLEAN NOT NULL DEFAULT false,
    "cadetPhase1COCCby" TEXT,
    "cadetPhase1PCRS" BOOLEAN NOT NULL DEFAULT false,
    "cadetPhase1PCRSby" TEXT,
    "cadetPhase1UoF" BOOLEAN NOT NULL DEFAULT false,
    "cadetPhase1UoFby" TEXT,
    "cadetPhase1Situation" BOOLEAN NOT NULL DEFAULT false,
    "cadetPhase1Situationby" TEXT,
    "cadetPhase2Legal" BOOLEAN NOT NULL DEFAULT false,
    "cadetPhase2Legalby" TEXT,
    "cadetPhase2Constitution" BOOLEAN NOT NULL DEFAULT false,
    "cadetPhase2Constitutionby" TEXT,
    "cadetPhase2Radio" BOOLEAN NOT NULL DEFAULT false,
    "cadetPhase2Radioby" TEXT,
    "cadetPhase2Report" BOOLEAN NOT NULL DEFAULT false,
    "cadetPhase2Reportby" TEXT,
    "cadetPhase3Negotiation" BOOLEAN NOT NULL DEFAULT false,
    "cadetPhase3Negotiationby" TEXT,
    "cadetPhase3Hostage" BOOLEAN NOT NULL DEFAULT false,
    "cadetPhase3Hostageby" TEXT,
    "cadetPhase3Traffic" BOOLEAN NOT NULL DEFAULT false,
    "cadetPhase3Trafficby" TEXT,
    "cadetPhase3Ticket" BOOLEAN NOT NULL DEFAULT false,
    "cadetPhase3Ticketby" TEXT,
    "cadetPhase3Pursuit" BOOLEAN NOT NULL DEFAULT false,
    "cadetPhase3Pursuitby" TEXT,
    "probationaryReportNumber" TEXT NOT NULL DEFAULT '',
    "probationaryTrafficStops" INTEGER NOT NULL DEFAULT 0,
    "probationaryMDTReports" INTEGER NOT NULL DEFAULT 0,
    "probationaryNegotiation" BOOLEAN NOT NULL DEFAULT false,
    "probationaryNegotiationby" TEXT,
    "probationaryCommunication" BOOLEAN NOT NULL DEFAULT false,
    "probationaryCommunicationby" TEXT,
    "probationaryRecommendation" BOOLEAN NOT NULL DEFAULT false,
    "probationaryRecommendationby" TEXT,
    "probationaryTheory" BOOLEAN NOT NULL DEFAULT false,
    "probationaryTheoryby" TEXT,
    "probationaryPractical" BOOLEAN NOT NULL DEFAULT false,
    "probationaryPracticalby" TEXT,
    "probationaryStatus" TEXT NOT NULL DEFAULT '',
    "phase2Signoff" BOOLEAN NOT NULL DEFAULT false,
    "phase2SignedBy" TEXT,
    "phase2SignedAt" DATETIME,
    "phase3Signoff" BOOLEAN NOT NULL DEFAULT false,
    "phase3SignedBy" TEXT,
    "phase3SignedAt" DATETIME,
    "emsProgress" JSONB NOT NULL DEFAULT '{}',
    CONSTRAINT "TrainingRecord_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LOA" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "memberId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "notes" TEXT,
    "createdBy" TEXT,
    "approvedBy" TEXT,
    "approvedAt" DATETIME,
    "endedAt" DATETIME,
    "endedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LOA_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InactivityRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "memberId" TEXT NOT NULL,
    "submittedBy" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "adminNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InactivityRequest_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PromotionNotification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "memberId" TEXT,
    "memberName" TEXT NOT NULL,
    "callSign" TEXT,
    "fromRank" TEXT NOT NULL,
    "toRank" TEXT NOT NULL,
    "promotedBy" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AdminRole" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "permissions" JSONB NOT NULL DEFAULT '[]',
    "order" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "TempRankTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "CategoryTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#eab308',
    "order" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "DepartmentTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "documentLink" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "tag" TEXT,
    "color" TEXT NOT NULL DEFAULT '#dc2626',
    "description" TEXT,
    "webhookUrl" TEXT,
    "openForApplications" BOOLEAN NOT NULL DEFAULT true,
    "minRank" TEXT,
    "discordRoleId" TEXT
);

-- CreateTable
CREATE TABLE "DepartmentQuestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "departmentId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'textarea',
    "options" JSONB NOT NULL DEFAULT '[]',
    "placeholder" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "DepartmentQuestion_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "DepartmentTemplate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DepartmentApplication" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "departmentId" TEXT NOT NULL,
    "memberId" TEXT,
    "characterName" TEXT NOT NULL,
    "discordId" TEXT NOT NULL,
    "currentRank" TEXT NOT NULL,
    "answers" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "reviewedBy" TEXT,
    "reviewNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DepartmentApplication_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "DepartmentTemplate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DepartmentMembership" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "departmentId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'Member',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DepartmentMembership_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "DepartmentTemplate" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DepartmentMembership_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ShiftSignup" (
    "memberId" TEXT NOT NULL PRIMARY KEY,
    "primarySlot" INTEGER NOT NULL,
    "secondarySlot" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ShiftSignup_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "discordId" TEXT NOT NULL,
    "discordName" TEXT NOT NULL,
    "roleId" TEXT,
    "extraPermissions" JSONB NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AdminUser_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "AdminRole" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RemovalRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "memberId" TEXT NOT NULL,
    "memberName" TEXT NOT NULL,
    "memberRank" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "reviewedBy" TEXT,
    "reviewNote" TEXT,
    "isPTDCase" BOOLEAN NOT NULL DEFAULT false,
    "ptdReviewStatus" TEXT,
    "ptdReviewedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RemovalRequest_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RadioCode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "section" TEXT NOT NULL DEFAULT 'ten',
    "order" INTEGER NOT NULL DEFAULT 0,
    "highlighted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SignOffDefinition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "pendingName" TEXT,
    "pendingAction" TEXT,
    "createdBy" TEXT,
    "approvedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "FTOSignOffRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ftoMemberId" TEXT NOT NULL,
    "signOffDefinitionId" TEXT NOT NULL,
    "completedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedBy" TEXT,
    "notes" TEXT,
    CONSTRAINT "FTOSignOffRecord_ftoMemberId_fkey" FOREIGN KEY ("ftoMemberId") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FTOSignOffRecord_signOffDefinitionId_fkey" FOREIGN KEY ("signOffDefinitionId") REFERENCES "SignOffDefinition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Remark" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trainingRecordId" TEXT NOT NULL,
    "authorCallSign" TEXT,
    "authorRole" TEXT,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Remark_trainingRecordId_fkey" FOREIGN KEY ("trainingRecordId") REFERENCES "TrainingRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DeletionLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "entityLabel" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "deletedBy" TEXT NOT NULL,
    "deletedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "OnboardingRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "discordId" TEXT NOT NULL,
    "stateId" TEXT,
    "steamId" TEXT,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "assignedRank" TEXT,
    "reviewedBy" TEXT,
    "reviewNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "FTPRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "characterName" TEXT NOT NULL,
    "discordId" TEXT NOT NULL,
    "currentRole" TEXT NOT NULL,
    "previousExperience" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "reviewedBy" TEXT,
    "reviewNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "RecruitRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "discordId" TEXT NOT NULL,
    "discordUsername" TEXT,
    "steamId" TEXT NOT NULL,
    "characterName" TEXT,
    "user" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "rank" TEXT,
    "reviewedBy" TEXT,
    "reviewNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "NotificationSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "recruitWebhook" BOOLEAN NOT NULL DEFAULT true,
    "recruitDM" BOOLEAN NOT NULL DEFAULT true,
    "recruitWebhookApprove" TEXT NOT NULL DEFAULT 'Congratulations! Your EMS application has been Accepted, <@{discordId}> For further details, please check your DMs',
    "recruitWebhookDecline" TEXT NOT NULL DEFAULT 'Unfortunately, your EMS application has been Declined, <@{discordId}> For further details, please check your DMs',
    "recruitDMApprove" TEXT NOT NULL DEFAULT 'Congratulations, {name}! 🎉

Your recruitment application has been **Accepted**!

**Assigned Rank:** {rank}

Join our state Discord server to get started:
{inviteLink}

Welcome aboard! 🚑🚀',
    "recruitDMDecline" TEXT NOT NULL DEFAULT 'Dear {name},

We regret to inform you that your recruitment application has been **Declined**.

If you have questions, please contact HR.',
    "onboardingWebhook" BOOLEAN NOT NULL DEFAULT false,
    "onboardingDM" BOOLEAN NOT NULL DEFAULT true,
    "onboardingWebhookMessage" TEXT NOT NULL DEFAULT '<@{discordId}> **{name}** has been enrolled in the EMS roster.',
    "onboardingDMApprove" TEXT NOT NULL DEFAULT 'Congratulations, {name}! 🎉

You have been accepted into the Emergency Medical Services!

**Your Details:**
• Rank: {rank}
• Call Sign: {callSign}
• State ID: {stateId}

Join our state Discord server to get started:
{inviteLink}

Welcome aboard! 🚑🚀',
    "onboardingDMDecline" TEXT NOT NULL DEFAULT 'Dear {name},

We regret to inform you that your application has been **Declined**.

If you have questions, please contact HR.',
    "ftpWebhook" BOOLEAN NOT NULL DEFAULT false,
    "ftpDM" BOOLEAN NOT NULL DEFAULT true,
    "ftpDMApprove" TEXT NOT NULL DEFAULT 'Congratulations, {name}! 🎉

Your Field Training Program (FTP) application has been **Accepted**! You have been assigned the FTP role and a trainer will reach out to you shortly.

Join our state Discord server:
{inviteLink}',
    "ftpDMDecline" TEXT NOT NULL DEFAULT 'Dear {name},

Your Field Training Program (FTP) application has been **Declined**.

If you have questions, please contact HR.',
    "ftpWebhookApprove" TEXT NOT NULL DEFAULT '🎓 {name} ({callSign}) has enrolled in the Field Training Program!',
    "departmentWebhook" BOOLEAN NOT NULL DEFAULT true,
    "departmentDM" BOOLEAN NOT NULL DEFAULT true,
    "departmentWebhookSubmitted" TEXT NOT NULL DEFAULT '📥 **{department}** — new join application from **{name}** ({rank}) <@{discordId}>',
    "departmentWebhookApprove" TEXT NOT NULL DEFAULT '✅ <@{discordId}> **{name}** has joined **{department}**.',
    "departmentWebhookDecline" TEXT NOT NULL DEFAULT '❌ **{name}**''s application to **{department}** has been declined.',
    "departmentDMApprove" TEXT NOT NULL DEFAULT 'Congratulations, {name}! 🎉

Your application to join **{department}** has been **Accepted**.

Welcome to the team!',
    "departmentDMDecline" TEXT NOT NULL DEFAULT 'Dear {name},

Your application to join **{department}** has been **Declined**.

If you have questions, please contact HR.',
    "loaWebhook" BOOLEAN NOT NULL DEFAULT true,
    "loaDM" BOOLEAN NOT NULL DEFAULT false,
    "loaWebhookApprove" TEXT NOT NULL DEFAULT '<@{discordId}> **{name}** has been granted a Leave of Absence.',
    "loaWebhookDecline" TEXT NOT NULL DEFAULT '<@{discordId}> **{name}**''s Leave of Absence request has been declined.',
    "loaDMApprove" TEXT NOT NULL DEFAULT 'Your Leave of Absence has been **Approved**.

Start: {startDate}
End: {endDate}
Reason: {reason}',
    "loaDMDecline" TEXT NOT NULL DEFAULT 'Your Leave of Absence request has been **Declined**.

If you have questions, please contact HR.',
    "loaReminderDM" BOOLEAN NOT NULL DEFAULT true,
    "loaReminderMessage" TEXT NOT NULL DEFAULT 'Hi {name}, your Leave of Absence ends on {endDate} — {daysLeft} day(s) from now. Let HR know if you need an extension.',
    "loaExpiredDM" BOOLEAN NOT NULL DEFAULT true,
    "loaExpiredMessage" TEXT NOT NULL DEFAULT 'Welcome back, {name}! Your Leave of Absence ended on {endDate} and your roster status is Active again.',
    "promotionWebhook" BOOLEAN NOT NULL DEFAULT true,
    "promotionWebhookMessage" TEXT NOT NULL DEFAULT '🎉 Congratulations <@{discordId}>! {name} ({callSign}) has been promoted from **{fromRank}** to **{toRank}**!',
    "demotionWebhook" BOOLEAN NOT NULL DEFAULT false,
    "demotionWebhookMessage" TEXT NOT NULL DEFAULT '📋 {name} ({callSign}) has been moved from **{fromRank}** to **{toRank}**.',
    "callsignWebhook" BOOLEAN NOT NULL DEFAULT true,
    "callsignWebhookMessage" TEXT NOT NULL DEFAULT '📻 <@{discordId}>''s call sign has been updated: **{oldCallSign}** → **{newCallSign}**',
    "testWebhook" BOOLEAN NOT NULL DEFAULT true,
    "testDM" BOOLEAN NOT NULL DEFAULT true,
    "webhookUrls" JSONB,
    "botSettings" JSONB
);

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "event" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "target" TEXT,
    "ok" BOOLEAN NOT NULL,
    "status" INTEGER,
    "error" TEXT,
    "preview" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "entityLabel" TEXT NOT NULL,
    "details" JSONB NOT NULL DEFAULT '{}',
    "performedBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "DMThread" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "discordId" TEXT NOT NULL,
    "channelId" TEXT,
    "username" TEXT,
    "memberId" TEXT,
    "memberName" TEXT,
    "lastMessageAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReadAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DirectMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "threadId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "discordMessageId" TEXT,
    "event" TEXT NOT NULL DEFAULT 'manual',
    "sentBy" TEXT,
    "ok" BOOLEAN NOT NULL DEFAULT true,
    "error" TEXT,
    "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DirectMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "DMThread" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MedicalDocumentType" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'Report',
    "numberPrefix" TEXT NOT NULL DEFAULT 'EMS-MED',
    "order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MedicalForm" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "documentTypeId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "department" TEXT,
    "createdBy" TEXT,
    "publishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MedicalForm_documentTypeId_fkey" FOREIGN KEY ("documentTypeId") REFERENCES "MedicalDocumentType" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MedicalFormVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "formId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "fields" JSONB NOT NULL DEFAULT '[]',
    "exportConfig" JSONB NOT NULL DEFAULT '{}',
    "signatureMode" TEXT NOT NULL DEFAULT 'optional',
    "published" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MedicalFormVersion_formId_fkey" FOREIGN KEY ("formId") REFERENCES "MedicalForm" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MedicalDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentNumber" TEXT,
    "documentTypeId" TEXT NOT NULL,
    "formVersionId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "patientMemberId" TEXT,
    "patientName" TEXT NOT NULL,
    "patientStateId" TEXT,
    "answers" JSONB NOT NULL DEFAULT '{}',
    "authorDiscordId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "authorRank" TEXT,
    "signedBy" TEXT,
    "signedAt" DATETIME,
    "finalizedAt" DATETIME,
    "finalizedBy" TEXT,
    "archivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MedicalDocument_documentTypeId_fkey" FOREIGN KEY ("documentTypeId") REFERENCES "MedicalDocumentType" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MedicalDocument_formVersionId_fkey" FOREIGN KEY ("formVersionId") REFERENCES "MedicalFormVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MedicalDocument_patientMemberId_fkey" FOREIGN KEY ("patientMemberId") REFERENCES "Member" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MedicalAttachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentId" TEXT NOT NULL,
    "fieldName" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "uploadedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MedicalAttachment_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "MedicalDocument" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MedicalNumberSequence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "prefix" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "MedicalSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "departmentName" TEXT NOT NULL DEFAULT 'EMERGENCY MEDICAL SERVICES',
    "subDepartment" TEXT,
    "logoUrl" TEXT,
    "address" TEXT,
    "contact" TEXT,
    "confidentialityNotice" TEXT NOT NULL DEFAULT 'CONFIDENTIAL MEDICAL RECORD — This document contains privileged medical information intended only for the named recipient.',
    "disclaimer" TEXT,
    "secondaryName" TEXT,
    "secondaryLogoUrl" TEXT,
    "secondaryAddress" TEXT,
    "secondaryContact" TEXT,
    "secondaryDetail" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "RosterBanner" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "active" BOOLEAN NOT NULL DEFAULT false,
    "label" TEXT NOT NULL DEFAULT '',
    "highlight" TEXT NOT NULL DEFAULT '',
    "message" TEXT NOT NULL DEFAULT '',
    "updatedBy" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "EmsCall" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "callNumber" TEXT NOT NULL,
    "occurredAt" DATETIME NOT NULL,
    "location" TEXT NOT NULL,
    "nature" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'P2',
    "outcome" TEXT NOT NULL,
    "hospital" TEXT,
    "patientName" TEXT,
    "patientStateId" TEXT,
    "notes" TEXT,
    "medicalDocumentNumber" TEXT,
    "createdByDiscordId" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "EmsCallResponder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "callId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'Responder',
    CONSTRAINT "EmsCallResponder_callId_fkey" FOREIGN KEY ("callId") REFERENCES "EmsCall" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EmsCallResponder_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PromotionRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "memberId" TEXT,
    "memberName" TEXT NOT NULL,
    "callSign" TEXT,
    "fromRank" TEXT NOT NULL,
    "toRank" TEXT NOT NULL,
    "direction" TEXT NOT NULL DEFAULT 'Promotion',
    "promotedBy" TEXT NOT NULL,
    "promotedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "legacyNotificationId" TEXT,
    "interviewId" TEXT,
    "interviewSessionId" TEXT,
    "finalScore" INTEGER
);

-- CreateTable
CREATE TABLE "PromotionSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "passingScore" INTEGER NOT NULL DEFAULT 70,
    "minSopScore" INTEGER NOT NULL DEFAULT 60,
    "minMedicalScore" INTEGER NOT NULL DEFAULT 60,
    "minSituationScore" INTEGER NOT NULL DEFAULT 60,
    "minOverallScore" INTEGER NOT NULL DEFAULT 60,
    "minDaysInRank" INTEGER NOT NULL DEFAULT 14,
    "minDaysInDepartment" INTEGER NOT NULL DEFAULT 30,
    "minTrainingPercent" INTEGER NOT NULL DEFAULT 0,
    "requiredDepartments" JSONB NOT NULL DEFAULT '[]',
    "requireActive" BOOLEAN NOT NULL DEFAULT true,
    "cooldownDays" INTEGER NOT NULL DEFAULT 14,
    "requireTrainingCheck" BOOLEAN NOT NULL DEFAULT true,
    "divergenceThreshold" INTEGER NOT NULL DEFAULT 20,
    "readinessWindowDays" INTEGER NOT NULL DEFAULT 14,
    "announceWebhook" BOOLEAN NOT NULL DEFAULT true,
    "announcementWebhookUrl" TEXT,
    "announcementTemplate" TEXT NOT NULL DEFAULT '**EMS PROMOTION ANNOUNCEMENT**

Congratulations to <@{discordId}> **{name}** on successfully clearing the EMS Promotion Examination.

**Previous Rank:** {fromRank}
**New Rank:** {toRank}
**Final Score:** {finalScore}%
**Exam Status:** PASSED

The employee''s EMS roster has been updated accordingly.

**Interview Panel:**
{panel}',
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT
);

-- CreateTable
CREATE TABLE "PromotionInterview" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "memberId" TEXT,
    "memberName" TEXT NOT NULL,
    "callSign" TEXT,
    "discordId" TEXT,
    "currentRank" TEXT NOT NULL,
    "targetRank" TEXT NOT NULL,
    "joinedEmsAt" DATETIME,
    "rankSince" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'Ongoing',
    "result" TEXT NOT NULL DEFAULT 'Pending',
    "finalScore" INTEGER,
    "categoryScores" JSONB,
    "eligibility" JSONB NOT NULL DEFAULT '{}',
    "eligibilityOverride" BOOLEAN NOT NULL DEFAULT false,
    "eligibilityWaivers" JSONB NOT NULL DEFAULT '[]',
    "trainingVerified" BOOLEAN NOT NULL DEFAULT false,
    "trainingVerifiedBy" TEXT,
    "trainingVerifiedAt" DATETIME,
    "cooldownUntil" DATETIME,
    "improvementNotes" TEXT,
    "rosterUpdated" BOOLEAN NOT NULL DEFAULT false,
    "promotionRecordId" TEXT,
    "announcementStatus" TEXT,
    "announcementDetail" TEXT,
    "scheduledAt" DATETIME,
    "location" TEXT,
    "reviewedByDiscordId" TEXT,
    "reviewedByName" TEXT,
    "reviewedAt" DATETIME,
    "reviewNote" TEXT,
    "createdByDiscordId" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "finalizedByDiscordId" TEXT,
    "finalizedByName" TEXT,
    "finalizedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "InterviewPanelist" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "interviewId" TEXT NOT NULL,
    "discordId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rank" TEXT,
    "memberId" TEXT,
    "role" TEXT NOT NULL DEFAULT 'Interviewer',
    "sopScore" INTEGER,
    "medicalScore" INTEGER,
    "situationScore" INTEGER,
    "overallScore" INTEGER,
    "sopNotes" TEXT,
    "medicalNotes" TEXT,
    "situationNotes" TEXT,
    "overallNotes" TEXT,
    "recommendation" TEXT,
    "submittedAt" DATETIME,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InterviewPanelist_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "PromotionInterview" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InterviewNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "interviewId" TEXT NOT NULL,
    "authorDiscordId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InterviewNote_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "PromotionInterview" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "mention" TEXT NOT NULL DEFAULT 'none',
    "color" INTEGER NOT NULL DEFAULT 14427686,
    "imageUrl" TEXT,
    "footer" TEXT,
    "scheduledFor" DATETIME NOT NULL,
    "repeat" TEXT NOT NULL DEFAULT 'none',
    "status" TEXT NOT NULL DEFAULT 'Scheduled',
    "claimedAt" DATETIME,
    "sentAt" DATETIME,
    "messageUrl" TEXT,
    "error" TEXT,
    "createdByDiscordId" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "cancelledByName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "BotCommandGrant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "guildId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "targetName" TEXT NOT NULL,
    "command" TEXT NOT NULL,
    "grantedByDiscordId" TEXT NOT NULL,
    "grantedByName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "FiveMSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "serverAddress" TEXT,
    "joinCode" TEXT,
    "showPublicStatus" BOOLEAN NOT NULL DEFAULT true,
    "showPublicNames" BOOLEAN NOT NULL DEFAULT false,
    "matchByName" BOOLEAN NOT NULL DEFAULT false,
    "dutySync" BOOLEAN NOT NULL DEFAULT true,
    "callSync" BOOLEAN NOT NULL DEFAULT true,
    "statusSync" BOOLEAN NOT NULL DEFAULT true,
    "lastHeartbeatAt" DATETIME,
    "lastHeartbeat" JSONB,
    "updatedBy" TEXT,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "CitySession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "memberId" TEXT NOT NULL,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" DATETIME,
    "durationSec" INTEGER,
    "characterName" TEXT,
    CONSTRAINT "CitySession_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UnitStatus" (
    "memberId" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL DEFAULT 'Available',
    "unit" TEXT,
    "note" TEXT,
    "source" TEXT NOT NULL DEFAULT 'site',
    "updatedBy" TEXT,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UnitStatus_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ActivitySettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "weeklyHoursTarget" INTEGER NOT NULL DEFAULT 4,
    "graceDays" INTEGER NOT NULL DEFAULT 7,
    "updatedBy" TEXT,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Test" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "instructions" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "questions" JSONB NOT NULL DEFAULT '[]',
    "passingScore" INTEGER NOT NULL DEFAULT 70,
    "timeLimitMinutes" INTEGER,
    "maxAttempts" INTEGER DEFAULT 1,
    "shuffleQuestions" BOOLEAN NOT NULL DEFAULT false,
    "shuffleOptions" BOOLEAN NOT NULL DEFAULT false,
    "showResults" BOOLEAN NOT NULL DEFAULT true,
    "showCorrectAnswers" BOOLEAN NOT NULL DEFAULT false,
    "showOnHomepage" BOOLEAN NOT NULL DEFAULT false,
    "minRank" TEXT,
    "examMode" BOOLEAN NOT NULL DEFAULT true,
    "maxTabSwitches" INTEGER NOT NULL DEFAULT 1,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "TestAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "testId" TEXT NOT NULL,
    "memberId" TEXT,
    "memberName" TEXT NOT NULL,
    "callSign" TEXT,
    "discordId" TEXT NOT NULL,
    "questions" JSONB NOT NULL DEFAULT '[]',
    "answers" JSONB NOT NULL DEFAULT '{}',
    "manualPoints" JSONB NOT NULL DEFAULT '{}',
    "comments" JSONB NOT NULL DEFAULT '{}',
    "tabSwitches" INTEGER NOT NULL DEFAULT 0,
    "autoSubmittedReason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'In Progress',
    "earned" REAL,
    "total" REAL NOT NULL DEFAULT 0,
    "score" INTEGER,
    "passed" BOOLEAN,
    "feedback" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" DATETIME,
    "gradedBy" TEXT,
    "gradedAt" DATETIME,
    CONSTRAINT "TestAttempt_testId_fkey" FOREIGN KEY ("testId") REFERENCES "Test" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RankSetting" (
    "name" TEXT NOT NULL PRIMARY KEY,
    "position" INTEGER NOT NULL,
    "shape" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "color" TEXT,
    "layout" TEXT NOT NULL DEFAULT 'row',
    "updatedBy" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "LoaSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "autoRole" BOOLEAN NOT NULL DEFAULT true,
    "roleName" TEXT NOT NULL DEFAULT 'EMS LOA',
    "discordRoleId" TEXT,
    "guildId" TEXT,
    "lastSyncAt" DATETIME,
    "lastSyncSummary" JSONB,
    "updatedBy" TEXT,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "SiteContent" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "draft" TEXT,
    "published" TEXT,
    "updatedBy" TEXT,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedBy" TEXT,
    "publishedAt" DATETIME
);

-- CreateTable
CREATE TABLE "SiteNotice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "tone" TEXT NOT NULL DEFAULT 'info',
    "linkUrl" TEXT,
    "linkLabel" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "order" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" DATETIME,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fileName" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "alt" TEXT,
    "uploadedBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "_AdminUserRoles" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_AdminUserRoles_A_fkey" FOREIGN KEY ("A") REFERENCES "AdminRole" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_AdminUserRoles_B_fkey" FOREIGN KEY ("B") REFERENCES "AdminUser" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Member_sectionId_idx" ON "Member"("sectionId");

-- CreateIndex
CREATE INDEX "Member_discordId_idx" ON "Member"("discordId");

-- CreateIndex
CREATE INDEX "ClockEntry_memberId_clockInAt_idx" ON "ClockEntry"("memberId", "clockInAt");

-- CreateIndex
CREATE INDEX "ClockEntry_clockOutAt_idx" ON "ClockEntry"("clockOutAt");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingRecord_memberId_key" ON "TrainingRecord"("memberId");

-- CreateIndex
CREATE INDEX "LOA_memberId_idx" ON "LOA"("memberId");

-- CreateIndex
CREATE INDEX "LOA_status_endDate_idx" ON "LOA"("status", "endDate");

-- CreateIndex
CREATE INDEX "InactivityRequest_memberId_idx" ON "InactivityRequest"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminRole_name_key" ON "AdminRole"("name");

-- CreateIndex
CREATE UNIQUE INDEX "TempRankTemplate_name_key" ON "TempRankTemplate"("name");

-- CreateIndex
CREATE UNIQUE INDEX "CategoryTemplate_name_key" ON "CategoryTemplate"("name");

-- CreateIndex
CREATE UNIQUE INDEX "DepartmentTemplate_name_key" ON "DepartmentTemplate"("name");

-- CreateIndex
CREATE INDEX "DepartmentQuestion_departmentId_idx" ON "DepartmentQuestion"("departmentId");

-- CreateIndex
CREATE INDEX "DepartmentApplication_departmentId_status_idx" ON "DepartmentApplication"("departmentId", "status");

-- CreateIndex
CREATE INDEX "DepartmentApplication_createdAt_idx" ON "DepartmentApplication"("createdAt");

-- CreateIndex
CREATE INDEX "DepartmentMembership_memberId_idx" ON "DepartmentMembership"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "DepartmentMembership_departmentId_memberId_key" ON "DepartmentMembership"("departmentId", "memberId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_discordId_key" ON "AdminUser"("discordId");

-- CreateIndex
CREATE INDEX "AdminUser_roleId_idx" ON "AdminUser"("roleId");

-- CreateIndex
CREATE INDEX "RemovalRequest_memberId_idx" ON "RemovalRequest"("memberId");

-- CreateIndex
CREATE INDEX "FTOSignOffRecord_ftoMemberId_idx" ON "FTOSignOffRecord"("ftoMemberId");

-- CreateIndex
CREATE INDEX "FTOSignOffRecord_signOffDefinitionId_idx" ON "FTOSignOffRecord"("signOffDefinitionId");

-- CreateIndex
CREATE INDEX "Remark_trainingRecordId_idx" ON "Remark"("trainingRecordId");

-- CreateIndex
CREATE INDEX "NotificationLog_createdAt_idx" ON "NotificationLog"("createdAt");

-- CreateIndex
CREATE INDEX "NotificationLog_event_idx" ON "NotificationLog"("event");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_performedBy_idx" ON "AuditLog"("performedBy");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DMThread_discordId_key" ON "DMThread"("discordId");

-- CreateIndex
CREATE INDEX "DMThread_lastMessageAt_idx" ON "DMThread"("lastMessageAt");

-- CreateIndex
CREATE UNIQUE INDEX "DirectMessage_discordMessageId_key" ON "DirectMessage"("discordMessageId");

-- CreateIndex
CREATE INDEX "DirectMessage_threadId_sentAt_idx" ON "DirectMessage"("threadId", "sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "MedicalDocumentType_name_key" ON "MedicalDocumentType"("name");

-- CreateIndex
CREATE INDEX "MedicalForm_documentTypeId_idx" ON "MedicalForm"("documentTypeId");

-- CreateIndex
CREATE INDEX "MedicalForm_status_idx" ON "MedicalForm"("status");

-- CreateIndex
CREATE INDEX "MedicalFormVersion_formId_idx" ON "MedicalFormVersion"("formId");

-- CreateIndex
CREATE UNIQUE INDEX "MedicalFormVersion_formId_version_key" ON "MedicalFormVersion"("formId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "MedicalDocument_documentNumber_key" ON "MedicalDocument"("documentNumber");

-- CreateIndex
CREATE INDEX "MedicalDocument_status_idx" ON "MedicalDocument"("status");

-- CreateIndex
CREATE INDEX "MedicalDocument_patientMemberId_idx" ON "MedicalDocument"("patientMemberId");

-- CreateIndex
CREATE INDEX "MedicalDocument_authorDiscordId_idx" ON "MedicalDocument"("authorDiscordId");

-- CreateIndex
CREATE INDEX "MedicalDocument_documentTypeId_idx" ON "MedicalDocument"("documentTypeId");

-- CreateIndex
CREATE INDEX "MedicalDocument_createdAt_idx" ON "MedicalDocument"("createdAt");

-- CreateIndex
CREATE INDEX "MedicalDocument_formVersionId_idx" ON "MedicalDocument"("formVersionId");

-- CreateIndex
CREATE INDEX "MedicalAttachment_documentId_idx" ON "MedicalAttachment"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "MedicalNumberSequence_prefix_year_key" ON "MedicalNumberSequence"("prefix", "year");

-- CreateIndex
CREATE UNIQUE INDEX "EmsCall_callNumber_key" ON "EmsCall"("callNumber");

-- CreateIndex
CREATE INDEX "EmsCall_occurredAt_idx" ON "EmsCall"("occurredAt");

-- CreateIndex
CREATE INDEX "EmsCall_patientStateId_idx" ON "EmsCall"("patientStateId");

-- CreateIndex
CREATE INDEX "EmsCall_createdByDiscordId_idx" ON "EmsCall"("createdByDiscordId");

-- CreateIndex
CREATE INDEX "EmsCallResponder_memberId_idx" ON "EmsCallResponder"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "EmsCallResponder_callId_memberId_key" ON "EmsCallResponder"("callId", "memberId");

-- CreateIndex
CREATE UNIQUE INDEX "PromotionRecord_legacyNotificationId_key" ON "PromotionRecord"("legacyNotificationId");

-- CreateIndex
CREATE INDEX "PromotionRecord_memberId_idx" ON "PromotionRecord"("memberId");

-- CreateIndex
CREATE INDEX "PromotionRecord_promotedAt_idx" ON "PromotionRecord"("promotedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PromotionInterview_sessionId_key" ON "PromotionInterview"("sessionId");

-- CreateIndex
CREATE INDEX "PromotionInterview_memberId_idx" ON "PromotionInterview"("memberId");

-- CreateIndex
CREATE INDEX "PromotionInterview_status_idx" ON "PromotionInterview"("status");

-- CreateIndex
CREATE INDEX "PromotionInterview_result_idx" ON "PromotionInterview"("result");

-- CreateIndex
CREATE INDEX "PromotionInterview_createdAt_idx" ON "PromotionInterview"("createdAt");

-- CreateIndex
CREATE INDEX "PromotionInterview_scheduledAt_idx" ON "PromotionInterview"("scheduledAt");

-- CreateIndex
CREATE INDEX "InterviewPanelist_interviewId_idx" ON "InterviewPanelist"("interviewId");

-- CreateIndex
CREATE UNIQUE INDEX "InterviewPanelist_interviewId_discordId_key" ON "InterviewPanelist"("interviewId", "discordId");

-- CreateIndex
CREATE INDEX "InterviewNote_interviewId_idx" ON "InterviewNote"("interviewId");

-- CreateIndex
CREATE INDEX "Announcement_status_scheduledFor_idx" ON "Announcement"("status", "scheduledFor");

-- CreateIndex
CREATE INDEX "Announcement_createdAt_idx" ON "Announcement"("createdAt");

-- CreateIndex
CREATE INDEX "BotCommandGrant_guildId_idx" ON "BotCommandGrant"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "BotCommandGrant_guildId_targetType_targetId_command_key" ON "BotCommandGrant"("guildId", "targetType", "targetId", "command");

-- CreateIndex
CREATE INDEX "CitySession_memberId_idx" ON "CitySession"("memberId");

-- CreateIndex
CREATE INDEX "CitySession_leftAt_idx" ON "CitySession"("leftAt");

-- CreateIndex
CREATE INDEX "CitySession_joinedAt_idx" ON "CitySession"("joinedAt");

-- CreateIndex
CREATE INDEX "Test_status_idx" ON "Test"("status");

-- CreateIndex
CREATE INDEX "TestAttempt_testId_status_idx" ON "TestAttempt"("testId", "status");

-- CreateIndex
CREATE INDEX "TestAttempt_discordId_idx" ON "TestAttempt"("discordId");

-- CreateIndex
CREATE INDEX "SiteNotice_status_order_idx" ON "SiteNotice"("status", "order");

-- CreateIndex
CREATE UNIQUE INDEX "MediaAsset_fileName_key" ON "MediaAsset"("fileName");

-- CreateIndex
CREATE UNIQUE INDEX "_AdminUserRoles_AB_unique" ON "_AdminUserRoles"("A", "B");

-- CreateIndex
CREATE INDEX "_AdminUserRoles_B_index" ON "_AdminUserRoles"("B");
