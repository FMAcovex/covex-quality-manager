import type { DocumentType, QmsRecordType } from "@prisma/client";

/**
 * Catálogo único de plantillas controladas (D-099). Es la única fuente de las huellas
 * SHA-256 aceptadas: lo usa `pnpm templates:install` para reconocer cada archivo por su
 * contenido, no por su nombre. Los binarios no se versionan en Git.
 *
 * Fuentes:
 * - `file`: el archivo se guarda tal cual.
 * - `pnt-range`: el anexo se recorta del PNT completo entre dos textos.
 * - `oos-pnt`: Anexos de OOS derivados del PNT GC-10/014/04 (sin encabezado ni pie del PNT).
 * - `office-normalized`: se limpian los metadatos; `convertDoc` convierte antes un .doc a .docx.
 */
export type TemplateSource =
  | { kind: "file"; sha256: string }
  | { kind: "pnt-range"; sha256: string; start: string; end?: string }
  | { kind: "oos-pnt"; sha256: string }
  | { kind: "office-normalized"; sha256: string; convertDoc?: boolean };

export type CatalogTemplate = {
  module: QmsRecordType;
  documentType: DocumentType;
  versionCode: string;
  label: string;
  fileName: string;
  effectiveFrom: string;
  sources: TemplateSource[];
  /** Derivaciones anteriores del mismo origen que se pueden sustituir por la actual. */
  supersededChecksums?: string[];
};

const RETURN_PNT_V03 = "7f6b318e936cef9d2685347decf52b8951c34585dbd2ef1ebca05232a0c59a5a";
const COMPLAINT_PNT_V02 = "f717ae907da9ed8b575f740fbf8b1536d4157174de5b7b4d240220910b570df4";
const OOS_PNT_V04 = "1dc7d0a7f0937f90b75f6ba94f3cdbaf0cfdd3b6558503c2f1658d1fd837ad40";

const file = (sha256: string): TemplateSource[] => [{ kind: "file", sha256 }];

export const templateCatalog: CatalogTemplate[] = [
  { module: "DEVIATION", documentType: "DEVIATION_ANNEX_III", versionCode: "06", label: "Desviaciones · Anexo III", fileName: "Anexo III Informe Desviaciones 06.docx", effectiveFrom: "2026-03-12", sources: file("8639c29198101a73253f0681620c89a3e2848b335d2a4be61b946f9b7a353d43") },
  { module: "DEVIATION", documentType: "DEVIATION_ANNEX_V", versionCode: "06", label: "Desviaciones · Anexo V", fileName: "Anexo V.xlsx", effectiveFrom: "2026-03-12", sources: file("1f92410bc94e2037fe632450ce766b3ce5d44c4f55b8868056bad73c882c03f2") },

  { module: "CAPA", documentType: "CAPA_ANNEX_III", versionCode: "05", label: "CAPA · Anexo III", fileName: "Anexo III INFORME CAPA 05.docx", effectiveFrom: "2026-03-11", sources: file("73c3d57ca5ae6f4e9644a4f1cbe416992de6b367973ba98cd67f7f0bd1fea540") },
  { module: "CAPA", documentType: "CAPA_ANNEX_IV", versionCode: "05", label: "CAPA · Anexo IV", fileName: "Anexo IV LISTADO CAPA 05 oficial.xlsx", effectiveFrom: "2026-03-11", sources: file("47f3d757c2c00cbcbdba9e4f7daf2cb4d804ce522a5e1145ab5260efd8147ac3") },

  { module: "CHANGE_CONTROL", documentType: "CHANGE_ANNEX_III", versionCode: "03", label: "Controles de cambios · Anexo III", fileName: "Anexo III Solicitud GC-00-003-03.docx", effectiveFrom: "2026-05-05", sources: file("a436d4aa732209e1aeb9620d5442a154a68899f875d1aa5d0dc437edd751a49f") },
  { module: "CHANGE_CONTROL", documentType: "CHANGE_ANNEX_IV", versionCode: "03", label: "Controles de cambios · Anexo IV", fileName: "Anexo IV Dictamen GC-00-003-03.docx", effectiveFrom: "2026-05-05", sources: file("742b1de11e0e0dece4e9c65c97613c112325189e183b9cb02c56ca82cd06cc60") },
  { module: "CHANGE_CONTROL", documentType: "CHANGE_ANNEX_V", versionCode: "03", label: "Controles de cambios · Anexo V", fileName: "Anexo V Seguimiento GC-00-003-03.docx", effectiveFrom: "2026-05-05", sources: file("3012e81b0172c77c59c9c97514d788e10eb332a73e4490b9c0a1c87afa6ad1e4") },
  { module: "CHANGE_CONTROL", documentType: "CHANGE_ANNEX_VII", versionCode: "03", label: "Controles de cambios · Anexo VII", fileName: "Anexo VII Listado GC-00-003-03.xlsx", effectiveFrom: "2026-05-05", sources: file("b65671cdd652f104f4038c65e07c025b5c7374dee4b683d74fbeef55f12bc8eb") },

  { module: "COMPLAINT", documentType: "COMPLAINT_ANNEX_III", versionCode: "03", label: "Reclamaciones · Anexo III", fileName: "Anexo III Informe Reclamacion 03.docx", effectiveFrom: "2026-09-28", sources: file("764e12076b407e9675f6291f03c8bab477f7850fbdb62fed8a904b4693b2bcde") },
  // La cabecera controlada dice GC-00/027/03 aunque el nombre del archivo original diga 02.
  { module: "COMPLAINT", documentType: "COMPLAINT_ANNEX_IV", versionCode: "03", label: "Reclamaciones · Anexo IV", fileName: "Anexo IV Respuesta Reclamacion 03.docx", effectiveFrom: "2026-09-28", sources: file("61b642c608cf4f8726a6ec04325e2cbbdbec30f3cf727b96acab746be1861dce") },
  { module: "COMPLAINT", documentType: "COMPLAINT_ANNEX_V", versionCode: "03", label: "Reclamaciones · Anexo V", fileName: "Anexo V Listado Reclamaciones 03.xlsx", effectiveFrom: "2026-09-28", sources: file("8d9a572fcfbc8bba05d99e3772aa0fec6fd3b716b6db2eaa5a056737d79d1d83") },
  // v02 histórica: el generador recorta cada anexo del PNT completo.
  ...(["COMPLAINT_ANNEX_III", "COMPLAINT_ANNEX_IV", "COMPLAINT_ANNEX_V"] as const).map((documentType): CatalogTemplate => ({
    module: "COMPLAINT", documentType, versionCode: "02", label: `Reclamaciones · ${documentType.replace("COMPLAINT_ANNEX_", "Anexo ")} (PNT histórico)`,
    fileName: "GC-00-027-02 Reclamaciones.docx", effectiveFrom: "2026-05-26", sources: file(COMPLAINT_PNT_V02),
  })),

  { module: "RETURN", documentType: "RETURN_ANNEX_III", versionCode: "03", label: "Devoluciones · Anexo III", fileName: "Anexo III Formulario Devolucion 03.docx", effectiveFrom: "2026-05-26", sources: file("9716477f2b261a4fec8b1d459fb8aa62bd42840f8fa352b4b66b15c2669745f4") },
  // D-099 (opción A): los Anexos IV y V se recortan del PNT GC-00/028/03, con su título.
  { module: "RETURN", documentType: "RETURN_ANNEX_IV", versionCode: "03", label: "Devoluciones · Anexo IV", fileName: "Anexo IV Hoja Devolucion Producto 03.docx", effectiveFrom: "2026-05-26", sources: [{ kind: "pnt-range", sha256: RETURN_PNT_V03, start: "Anexo IV:", end: "Anexo V:" }] },
  { module: "RETURN", documentType: "RETURN_ANNEX_V", versionCode: "03", label: "Devoluciones · Anexo V", fileName: "Anexo V Declaracion Cliente Conservacion 03.docx", effectiveFrom: "2026-05-26", sources: [{ kind: "pnt-range", sha256: RETURN_PNT_V03, start: "Anexo V:", end: "Anexo VI:" }] },
  { module: "RETURN", documentType: "RETURN_ANNEX_VI", versionCode: "03", label: "Devoluciones · Anexo VI", fileName: "Anexo VI Listado Devoluciones 03.xlsx", effectiveFrom: "2026-05-26", sources: file("fa027508995beca7e39368f92e9d75ac2fdcf0dd7dffa57dfef8d59e6696db64") },

  // D-088: los anexos de OOS salen del PNT GC-10/014/04 con el encabezado corregido a 04.
  { module: "OOS", documentType: "OOS_ANNEX_III", versionCode: "04", label: "OOS · Anexo III", fileName: "Anexo III OOS Fase I GC-10-014-04.docx", effectiveFrom: "2025-06-15", sources: [{ kind: "oos-pnt", sha256: OOS_PNT_V04 }], supersededChecksums: ["66d885876c2ef9b6de56aed21f8b4b6a81b06a6b3142674e17c3dbeaa1ee6903"] },
  { module: "OOS", documentType: "OOS_ANNEX_IV", versionCode: "04", label: "OOS · Anexo IV", fileName: "Anexo IV OOS Fase II GC-10-014-04.docx", effectiveFrom: "2025-06-15", sources: [{ kind: "oos-pnt", sha256: OOS_PNT_V04 }], supersededChecksums: ["bb30562e5893887f5f932d8696e526971dd31fc46e25874295e55dbd591fd391"] },
  { module: "OOS", documentType: "OOS_ANNEX_VI", versionCode: "04", label: "OOS · Anexo VI", fileName: "Anexo VI Listado general OOS GC-10-014-04.docx", effectiveFrom: "2025-06-15", sources: [{ kind: "oos-pnt", sha256: OOS_PNT_V04 }], supersededChecksums: ["40c851beff49620f41fcda800028d0b33869d83c8af100c874a09b5054d85007"] },

  { module: "AUDIT", documentType: "AUDIT_INTERNAL_REPORT", versionCode: "03", label: "Auditorías · Informe interno", fileName: "A3.03 INFORME AUDITORIA INTERNA.docx", effectiveFrom: "2026-04-10", sources: file("d461403cecfb8b6cfb601ad9e395e6f3d1f0247156570633b0e287ac2f87b7f9") },
  { module: "AUDIT", documentType: "AUDIT_CAPA_PLAN", versionCode: "03", label: "Auditorías · CAPA Plan", fileName: "A4.03 CAPA PLAN.xlsx", effectiveFrom: "2026-04-10", sources: file("88d1a49e814cb3f035bc85c025ebefb2e5da6f7eb4da2d245d2b0deb9de32414") },
  { module: "AUDIT", documentType: "AUDIT_EXTERNAL_REPORT", versionCode: "04", label: "Auditorías · Informe externo", fileName: "A3. INFORME AUDITORIA_V04.docx", effectiveFrom: "2026-06-08", sources: file("ed09292702a08c73a26a42d019e81c1d7d74ac63264b278dd6d6fa6e2acbc40d") },
  // El generador extrae el Anexo IV del PNT completo de auditorías externas.
  { module: "AUDIT", documentType: "AUDIT_EXTERNAL_PLAN", versionCode: "04", label: "Auditorías · Plan externo (PNT fuente)", fileName: "GC-00.034.04 Auditorías externas.docx", effectiveFrom: "2026-06-08", sources: file("1c73fa4fbe06b42a797000ce0a95ccee034261a230ddc7602920ace17bcae6af") },
  // El original del programa interno es .doc: se convierte con LibreOffice y la conversión no es
  // idéntica entre instalaciones, así que una versión ya instalada nunca se vuelve a convertir.
  { module: "AUDIT", documentType: "AUDIT_ANNUAL_INTERNAL_PROGRAMME", versionCode: "PMAI-V04-01-2023-GENERAL", label: "Auditorías · Programa anual interno (PMAI V04)", fileName: "PMAI-V04-01-2023-GENERAL.docx", effectiveFrom: "2023-01-01", sources: [{ kind: "office-normalized", sha256: "fa1296da0c6bbb9561e2ab992e717b7b2e31f73cc70ce274bac0a79a3b457e36", convertDoc: true }] },
  { module: "AUDIT", documentType: "AUDIT_ANNUAL_EXTERNAL_PROGRAMME", versionCode: "PMAE-V05-06-2026-ANEXO-I", label: "Auditorías · Programa anual externo (PMAE V05)", fileName: "PMAE-V05-06-2026-ANEXO-I.docx", effectiveFrom: "2026-06-01", sources: [{ kind: "office-normalized", sha256: "e55c7b2623604c45aa7282c6601479189a56395cbfa05fc421742a7e9db98cda" }] },
];

export const templateKey = (item: { module: string; documentType: string; versionCode: string }) =>
  `${item.module}:${item.documentType}:${item.versionCode}`;

/** Huellas de origen que el instalador reconoce. */
export function catalogSourceHashes() {
  return new Set(templateCatalog.flatMap((item) => item.sources.map((source) => source.sha256)));
}
