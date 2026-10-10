import { z } from "zod";
import { createHash } from "node:crypto";

export const programmeDocumentTypes = {
  INTERNAL: "AUDIT_ANNUAL_INTERNAL_PROGRAMME",
  EXTERNAL: "AUDIT_ANNUAL_EXTERNAL_PROGRAMME",
} as const;
export const programmeReferences = { INTERNAL: "Anexo/PMAI/V04/01-2023", EXTERNAL: "ANEXO I del PMAE/V05/06-2026" } as const;
export const programmeApproversSchema = z.object({
  technicalApproverName: z.string().trim().max(250), qualityApproverName: z.string().trim().max(250),
  actor: z.string().trim().min(1).max(200), reason: z.string().trim().min(1).max(20000),
});
export const issueProgrammeSchema = z.object({
  actor: z.string().trim().min(1).max(200), reason: z.string().trim().max(20000),
  requestId: z.string().uuid(), expectedFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
});
export type ProgrammeRow = {
  entryId: string; auditId: string | null; subject: string; target: string; area: string;
  productService: string; scope: string; modality: string; planned: string; auditors: string;
  performed: string; partial: string; notes: string; auditStatus: string | null; auditActive: boolean | null;
};
export type ProgrammeContent = {
  schemaVersion: 1; planId: string; year: number; auditType: "INTERNAL" | "EXTERNAL";
  title: string; reference: string; technicalApproverName: string; qualityApproverName: string;
  rows: ProgrammeRow[]; warnings: string[];
};
export function programmeFingerprint(content: ProgrammeContent & { template?: { id: string; checksum: string | null } | null }) {
  return createHash("sha256").update(JSON.stringify(content)).digest("hex");
}
export function programmeDownloadName(type: string, year: number, sequence: number) {
  return `Programa_anual_${type === "INTERNAL" ? "interno" : "externo"}_${year}_R${String(sequence).padStart(2, "0")}.docx`;
}
export const modalityText = { ONSITE: "Presencial", REMOTE: "Remota", HYBRID: "Mixta" };
export function externalProgrammeNotes(row: ProgrammeRow) {
  return [row.modality && `Modalidad prevista: ${row.modality}`, row.partial && `Cierre parcial: ${row.partial}`, row.notes].filter(Boolean).join("\n");
}
