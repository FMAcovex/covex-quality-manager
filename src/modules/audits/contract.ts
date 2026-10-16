import type { QmsRecordModuleContract } from "@/modules/contract";

export const auditModule: QmsRecordModuleContract = {
  contractVersion: 1,
  key: "AUDIT",
  recordType: "AUDIT",
  labels: { singular: "Auditoría", plural: "Auditorías" },
  href: "/audits",
  indicatorsHref: null,
  permissions: [
    "READ",
    "CREATE",
    "EDIT",
    "FOLLOWUP",
    "REVIEW",
    "CLOSE",
    "ANNUL",
    "DOWNLOAD",
    "ATTACH_DOCUMENT",
    "GENERATE_DOCUMENT",
    "AUDIT_ISSUE_REPORT",
    "AUDIT_ISSUE_PROGRAMME",
  ],
  relations: {
    outgoing: [
      { target: "DEVIATION", type: "GENERATES", label: "Auditoría → Desviación" },
      { target: "CAPA", type: "GENERATES", label: "Auditoría → CAPA" },
    ],
  },
};
