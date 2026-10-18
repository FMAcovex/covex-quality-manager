export const changeControlDetailTabs = [
  ["information", "Información"],
  ["request", "Solicitud"],
  ["dictamen", "Dictamen"],
  ["followups", "Seguimiento"],
  ["documents", "Documentos"],
  ["evidence", "Evidencias"],
  ["relations", "Relaciones"],
  ["review", "Revisión"],
  ["timeline", "Cronología"],
  ["audit-trail", "Audit Trail"],
] as const;

export type ChangeRequirementRow = {
  key: "committee" | "clientNotification" | "authority" | "pqr" | "stability" | "additionalAnalysis" | "additionalValidation" | "otherImplication";
  question: string;
  evaluation: string;
  detail: string;
};

type RequirementSource = {
  committeeRequired: boolean | null;
  committeeDetails: string | null;
  clientNotificationRequired: boolean | null;
  clientNotificationDetails: string | null;
  authorityRequired: boolean | null;
  authorityDetails: string | null;
  pqrRequired: string | null;
  pqrProducts: string | null;
  pqrPeriod: string | null;
  stabilityRequired: string | null;
  stabilityAccelerated: boolean;
  stabilityOngoing: boolean;
  additionalAnalysisRequired: string | null;
  additionalAnalysisDetails: string | null;
  additionalValidationRequired: string | null;
  additionalValidationDetails: string | null;
  otherImplicationRequired: boolean | null;
  otherImplicationDetails: string | null;
};

export function displayValue(value: string | null | undefined) {
  return value?.trim() || "—";
}

export function yesNoLabel(value: boolean | null | undefined) {
  return value === true ? "Sí" : value === false ? "No" : "—";
}

export function triStateLabel(value: string | null | undefined) {
  if (value === "YES") return "Sí";
  if (value === "NO") return "No";
  if (value === "NA") return "No aplica";
  return "—";
}

function joinedDetail(parts: Array<string | null | undefined>) {
  const values = parts.map((item) => item?.trim()).filter(Boolean);
  return values.length ? values.join(" · ") : "—";
}

export function changeRequirementRows(record: RequirementSource): ChangeRequirementRow[] {
  const stabilityTypes = [
    record.stabilityAccelerated ? "Acelerada" : null,
    record.stabilityOngoing ? "En curso" : null,
  ];

  return [
    {
      key: "committee",
      question: "¿Se requiere Comité de cambios?",
      evaluation: yesNoLabel(record.committeeRequired),
      detail: displayValue(record.committeeDetails),
    },
    {
      key: "clientNotification",
      question: "¿Es necesario informar al cliente?",
      evaluation: yesNoLabel(record.clientNotificationRequired),
      detail: displayValue(record.clientNotificationDetails),
    },
    {
      key: "authority",
      question: "¿Interviene la autoridad sanitaria?",
      evaluation: yesNoLabel(record.authorityRequired),
      detail: displayValue(record.authorityDetails),
    },
    {
      key: "pqr",
      question: "¿Debe reflejarse en PQR?",
      evaluation: triStateLabel(record.pqrRequired),
      detail: joinedDetail([
        record.pqrProducts ? `Productos: ${record.pqrProducts}` : null,
        record.pqrPeriod ? `Periodo: ${record.pqrPeriod}` : null,
      ]),
    },
    {
      key: "stability",
      question: "¿Deben incluirse lotes en estabilidad?",
      evaluation: triStateLabel(record.stabilityRequired),
      detail: joinedDetail(stabilityTypes),
    },
    {
      key: "additionalAnalysis",
      question: "¿Se requieren análisis adicionales?",
      evaluation: triStateLabel(record.additionalAnalysisRequired),
      detail: displayValue(record.additionalAnalysisDetails),
    },
    {
      key: "additionalValidation",
      question: "¿Se requiere validación adicional?",
      evaluation: triStateLabel(record.additionalValidationRequired),
      detail: displayValue(record.additionalValidationDetails),
    },
    {
      key: "otherImplication",
      question: "¿Existen otras implicaciones?",
      evaluation: yesNoLabel(record.otherImplicationRequired),
      detail: displayValue(record.otherImplicationDetails),
    },
  ];
}

export function requestDecisionTone(value: string) {
  if (value === "ACCEPTED") return "closed";
  if (value === "DENIED") return "major";
  return "warning";
}

export function dictamenResultTone(value: string) {
  if (value === "APPROVED") return "closed";
  if (value === "REJECTED") return "major";
  return "warning";
}

export function changeControlDocumentUrls(id: string) {
  return {
    annexIII: `/api/changes/${id}/annex-iii`,
    annexIV: `/api/changes/${id}/annex-iv`,
    annexVII: "/changes",
  };
}

export function changeControlVersionDocumentUrls(id: string, sequenceNumber: number) {
  const version = `?version=${sequenceNumber}`;
  return {
    annexIII: `/api/changes/${id}/annex-iii${version}`,
    annexIV: `/api/changes/${id}/annex-iv${version}`,
    annexV: `/api/changes/${id}/annex-v${version}`,
  };
}
