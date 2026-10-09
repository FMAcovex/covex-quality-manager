export const documentKinds = {
  WORKING_WORD: "Word de elaboración", DOCUMENT_PDF: "PDF documental",
  EXTERNAL_SIGNED_PDF: "PDF firmado externamente (sin verificar)",
  APPROVAL_EVIDENCE: "Evidencia de aprobación (sin verificar)", ANNEX: "Anexo documental",
} as const;
export type DocumentKind = keyof typeof documentKinds;
