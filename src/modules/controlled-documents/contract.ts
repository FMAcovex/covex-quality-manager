import type { QmsModuleContract } from "@/modules/contract";

export const pntModule: QmsModuleContract = {
  contractVersion: 1,
  key: "PNT",
  recordType: null,
  labels: { singular: "Documento controlado", plural: "Documentación controlada" },
  href: "/controlled-documents",
  indicatorsHref: null,
  // PNT no usa expediente QmsRecord ni relaciones operativas por ahora (D-083 MC-3).
  relations: { outgoing: [] },
};
