import { z } from "zod";
import { createHash } from "node:crypto";

export const programmeDocumentTypes = {
  INTERNAL: "AUDIT_ANNUAL_INTERNAL_PROGRAMME",
  EXTERNAL: "AUDIT_ANNUAL_EXTERNAL_PROGRAMME",
} as const;
/** Plantillas anteriores (Plan Maestro PMAI V04 / PMAE V05); solo para programas emitidos con ellas. */
export const programmeReferences = { INTERNAL: "Anexo/PMAI/V04/01-2023", EXTERNAL: "ANEXO I del PMAE/V05/06-2026" } as const;
/**
 * D-135 (R6): desde los PNT GC-00/033/04 y GC-00/034/05 el programa es el Anexo V del PNT. El formato
 * se deduce de la versión de catálogo de la plantilla vigente: «GC-00-033-04-ANEXO-V» → «Anexo V del PNT GC-00/033/04».
 */
export type ProgrammeFormat = "ANNEX_V" | "MASTER_PLAN";
export function programmeTemplateFormat(versionCode: string | null | undefined): ProgrammeFormat {
  return versionCode && /^GC-\d{2}-\d{3}-\d{2}-ANEXO-V$/.test(versionCode) ? "ANNEX_V" : "MASTER_PLAN";
}
export function programmeReference(auditType: "INTERNAL" | "EXTERNAL", versionCode: string | null | undefined) {
  const m = versionCode?.match(/^GC-(\d{2})-(\d{3})-(\d{2})-ANEXO-V$/);
  return m ? `Anexo V del PNT GC-${m[1]}/${m[2]}/${m[3]}` : programmeReferences[auditType];
}
export const programmeApproversSchema = z.object({
  preparedByName: z.string().trim().max(250).default(""),
  technicalApproverName: z.string().trim().max(250).default(""), qualityApproverName: z.string().trim().max(250),
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
  /** D-135: código de la auditoría, comentarios del Anexo V y entrada cancelada después de emitirse. */
  code: string; comments: string; cancelled: boolean;
};
export type ProgrammeContent = {
  schemaVersion: 2; planId: string; year: number; auditType: "INTERNAL" | "EXTERNAL"; format: ProgrammeFormat;
  title: string; reference: string; preparedByName: string; technicalApproverName: string; qualityApproverName: string;
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
const dmy = /^(\d{2})\/(\d{2})\/(\d{4})$/;
const sortable = (v: string) => { const m = v.match(dmy); return m ? `${m[3]}-${m[2]}-${m[1]}` : null; };
/**
 * D-135 (R6): columna «Comentarios» del Anexo V. Aplazada o cancelada con su motivo, la modalidad prevista
 * en externas y las observaciones de la entrada. «Adelantada» solo cuando ambas fechas son exactas y la nueva es anterior.
 */
export function programmeComments(input: { external: boolean; notes: string; modality: string; planned: string; initialPlanned?: string | null; rescheduleReason?: string | null; cancelledReason?: string | null }) {
  const lines: string[] = [];
  if (input.cancelledReason !== undefined && input.cancelledReason !== null) lines.push(`Cancelada.${input.cancelledReason ? ` Motivo: ${input.cancelledReason}` : ""}`);
  else if (input.initialPlanned && input.initialPlanned !== input.planned) {
    const before = sortable(input.initialPlanned), after = sortable(input.planned);
    lines.push(`${before && after && after < before ? "Adelantada" : "Aplazada"} (prevista inicialmente: ${input.initialPlanned}).${input.rescheduleReason ? ` Motivo: ${input.rescheduleReason}` : ""}`);
  }
  if (input.external && input.modality) lines.push(`Modalidad prevista: ${input.modality}`);
  if (input.notes) lines.push(input.notes);
  return lines.join("\n");
}
const changeFields: [keyof ProgrammeRow, string][] = [["target", "entidad / área"], ["scope", "alcance"], ["productService", "producto / servicio"], ["area", "ámbito"], ["planned", "fecha prevista"], ["auditors", "equipo auditor"], ["code", "código de auditoría"], ["performed", "fecha de auditoría"], ["partial", "fecha de cierre parcial"], ["comments", "comentarios"]];
/** D-135: qué cambia la nueva versión respecto a la última emitida, para revisarlo antes de emitir. */
export function programmeChanges(previous: Partial<ProgrammeContent> | null | undefined, current: ProgrammeContent) {
  if (!previous?.rows) return [];
  const out: string[] = [];
  const name = (r: Partial<ProgrammeRow>) => r.target || r.subject || "Entrada";
  const before = new Map(previous.rows.map(r => [r.entryId, r]));
  for (const row of current.rows) {
    const old = before.get(row.entryId);
    if (!old) { out.push(`Nueva auditoría: ${name(row)}.`); continue; }
    if (row.cancelled && !old.cancelled) { out.push(`Cancelada: ${name(row)}.`); continue; }
    for (const [key, label] of changeFields) {
      // Una emisión anterior a D-135 no tenía código ni comentarios: no es un cambio.
      if ((key === "comments" && row.cancelled) || old[key] === undefined) continue;
      const a = String(old[key] ?? ""), b = String(row[key] ?? "");
      if (a !== b) out.push(`${name(row)}: ${label} ${a ? `«${a}»` : "vacío"} → ${b ? `«${b}»` : "vacío"}.`);
    }
  }
  const now = new Set(current.rows.map(r => r.entryId));
  for (const row of previous.rows) if (!now.has(row.entryId)) out.push(`Ya no se incluye: ${name(row)}.`);
  for (const [key, label] of [["preparedByName", "Elaborado por"], ["qualityApproverName", "Aprobado por"]] as const) {
    if (String(previous[key] ?? "") !== current[key]) out.push(`${label}: ${previous[key] ? `«${previous[key]}»` : "vacío"} → ${current[key] ? `«${current[key]}»` : "vacío"}.`);
  }
  return out;
}
