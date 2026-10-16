import type { QmsModuleContract } from "@/modules/contract";

export const pntModule: QmsModuleContract = {
  contractVersion: 1,
  key: "PNT",
  recordType: null,
  labels: { singular: "Documento controlado", plural: "Documentación controlada" },
  href: "/controlled-documents",
  indicatorsHref: null,
  permissions: [
    "READ",
    "CREATE",
    "EDIT",
    "ANNUL",
    "DOWNLOAD",
    "EXPORT",
    "IMPORT",
    "ATTACH_DOCUMENT",
    "PNT_VERIFY",
    "PNT_RECORD_APPROVAL",
    "PNT_ACCEPT_APPROVAL",
    "PNT_ACTIVATE",
    "PNT_RETIRE",
    "PNT_CORRECT",
    "PNT_LEGACY_REGISTER",
    "PNT_MANAGE_STATE",
  ],
  // PNT no usa expediente QmsRecord ni relaciones operativas por ahora (D-083 MC-3).
  relations: { outgoing: [] },
};
