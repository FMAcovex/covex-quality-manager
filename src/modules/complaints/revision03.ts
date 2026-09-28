import type { Prisma } from "@prisma/client";

export type ComplaintTriState = "YES" | "NO" | "NA" | null;

export type ComplaintDerivedAction = {
  typeCode: string;
  actionEvidence: string;
  responsible: string;
  plannedDate: string;
};

export type ComplaintRevision03Data = {
  receivedAt: string | null;
  sourceFlags: string[];
  sourceOther: string | null;
  scopeFlags: string[];
  scopeOther: string | null;
  objectFlags: string[];
  objectOther: string | null;
  categoryFlags: string[];
  categoryOther: string | null;
  impactQualityGmp: ComplaintTriState;
  impactSafetyEfficacy: ComplaintTriState;
  impactRegulatory: ComplaintTriState;
  impactEnvironment: ComplaintTriState;
  impactOtherLots: ComplaintTriState;
  containmentFlags: string[];
  containmentOther: string | null;
  riskJustification: string | null;
  regulatoryMayRequireRecall: ComplaintTriState;
  regulatoryActivateRecall: ComplaintTriState;
  regulatoryAuthorityNotification: ComplaintTriState;
  regulatoryResponsibleCommunication: ComplaintTriState;
  regulatoryJustification: string | null;
  derivedActions: ComplaintDerivedAction[];
  communicationDate: string | null;
  communicationMedium: string | null;
  communicationFromTo: string | null;
  partIOutcome: "CONTINUE_PART_II" | "CLOSE_PART_I" | null;
  responseSufficient: boolean | null;
  finalActionsStatus: "COMPLETED" | "INDEPENDENT_FOLLOWUP" | "PENDING" | null;
  finalActionsReferences: string | null;
  nextFollowupDate: string | null;
};

export const emptyComplaintRevision03: ComplaintRevision03Data = {
  receivedAt: null,
  sourceFlags: [],
  sourceOther: null,
  scopeFlags: [],
  scopeOther: null,
  objectFlags: [],
  objectOther: null,
  categoryFlags: [],
  categoryOther: null,
  impactQualityGmp: null,
  impactSafetyEfficacy: null,
  impactRegulatory: null,
  impactEnvironment: null,
  impactOtherLots: null,
  containmentFlags: [],
  containmentOther: null,
  riskJustification: null,
  regulatoryMayRequireRecall: null,
  regulatoryActivateRecall: null,
  regulatoryAuthorityNotification: null,
  regulatoryResponsibleCommunication: null,
  regulatoryJustification: null,
  derivedActions: [],
  communicationDate: null,
  communicationMedium: null,
  communicationFromTo: null,
  partIOutcome: null,
  responseSufficient: null,
  finalActionsStatus: null,
  finalActionsReferences: null,
  nextFollowupDate: null,
};

function stringOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}
function tri(value: unknown): ComplaintTriState {
  return value === "YES" || value === "NO" || value === "NA" ? value : null;
}
function booleanOrNull(value: unknown) {
  return value === true ? true : value === false ? false : null;
}

export function parseComplaintRevision03Json(value: unknown): ComplaintRevision03Data {
  const root =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const raw =
    root.revision03 && typeof root.revision03 === "object" && !Array.isArray(root.revision03)
      ? (root.revision03 as Record<string, unknown>)
      : root;
  const derived = Array.isArray(raw.derivedActions)
    ? raw.derivedActions
        .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
        .map((item) => ({
          typeCode: stringOrNull(item.typeCode) ?? "",
          actionEvidence: stringOrNull(item.actionEvidence) ?? "",
          responsible: stringOrNull(item.responsible) ?? "",
          plannedDate: stringOrNull(item.plannedDate) ?? "",
        }))
        .filter((item) => item.typeCode || item.actionEvidence || item.responsible || item.plannedDate)
    : [];

  return {
    receivedAt: stringOrNull(raw.receivedAt),
    sourceFlags: stringArray(raw.sourceFlags),
    sourceOther: stringOrNull(raw.sourceOther),
    scopeFlags: stringArray(raw.scopeFlags),
    scopeOther: stringOrNull(raw.scopeOther),
    objectFlags: stringArray(raw.objectFlags),
    objectOther: stringOrNull(raw.objectOther),
    categoryFlags: stringArray(raw.categoryFlags),
    categoryOther: stringOrNull(raw.categoryOther),
    impactQualityGmp: tri(raw.impactQualityGmp),
    impactSafetyEfficacy: tri(raw.impactSafetyEfficacy),
    impactRegulatory: tri(raw.impactRegulatory),
    impactEnvironment: tri(raw.impactEnvironment),
    impactOtherLots: tri(raw.impactOtherLots),
    containmentFlags: stringArray(raw.containmentFlags),
    containmentOther: stringOrNull(raw.containmentOther),
    riskJustification: stringOrNull(raw.riskJustification),
    regulatoryMayRequireRecall: tri(raw.regulatoryMayRequireRecall),
    regulatoryActivateRecall: tri(raw.regulatoryActivateRecall),
    regulatoryAuthorityNotification: tri(raw.regulatoryAuthorityNotification),
    regulatoryResponsibleCommunication: tri(raw.regulatoryResponsibleCommunication),
    regulatoryJustification: stringOrNull(raw.regulatoryJustification),
    derivedActions: derived,
    communicationDate: stringOrNull(raw.communicationDate),
    communicationMedium: stringOrNull(raw.communicationMedium),
    communicationFromTo: stringOrNull(raw.communicationFromTo),
    partIOutcome:
      raw.partIOutcome === "CONTINUE_PART_II" || raw.partIOutcome === "CLOSE_PART_I"
        ? raw.partIOutcome
        : null,
    responseSufficient: booleanOrNull(raw.responseSufficient),
    finalActionsStatus:
      raw.finalActionsStatus === "COMPLETED" ||
      raw.finalActionsStatus === "INDEPENDENT_FOLLOWUP" ||
      raw.finalActionsStatus === "PENDING"
        ? raw.finalActionsStatus
        : null,
    finalActionsReferences: stringOrNull(raw.finalActionsReferences),
    nextFollowupDate: stringOrNull(raw.nextFollowupDate),
  };
}

export function complaintRevision03ToJson(data: ComplaintRevision03Data): Prisma.InputJsonValue {
  return { revision03: data } as unknown as Prisma.InputJsonValue;
}
