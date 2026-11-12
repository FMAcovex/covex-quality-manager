/**
 * D-136 (R6): plan CAPA del Anexo IV del PNT GC-00/033/04 (también para auditorías recibidas e inspecciones).
 * Un bloque por hallazgo con una fila de datos por CAPA y por acción propia de la auditoría, y debajo
 * «Acciones / Justificación / Observaciones» y «Evidencias». Lógica pura: la carga de vínculos está en
 * `capa-plan-links.ts` y la escritura en Excel en el generador.
 */
import type { AuditScenario } from "@prisma/client";

/** Una CAPA vinculada al hallazgo directamente o a través de su desviación. */
export type CapaPlanCapa = {
  code: string; status: string; effectivenessStatus: string;
  responsible: string[]; plannedDate: string | null; closedAt: string | null; actions: string[];
};
export type CapaPlanFindingLinks = { deviations: { code: string; rootCause: string | null }[]; capas: CapaPlanCapa[] };
/** Vínculos de cada hallazgo, por su id. Se congelan en la foto de cada versión del plan CAPA. */
export type CapaPlanLinks = Record<string, CapaPlanFindingLinks>;

type Finding = {
  id: string; reference: string; findingType: string; criticality: string; description: string; isActive: boolean;
  rootCause?: string | null; treatment?: string | null; treatmentStatus: string; closedAt?: string | null;
  evidence?: string | null; evidenceReference?: string | null;
  actions: { isActive: boolean; description: string; responsible?: string | null; targetDate?: string | null; status: string; closedAt?: string | null; evidence?: string | null; evidenceReference?: string | null }[];
};
export type CapaPlanRow = { code: string; responsible: string; plannedDate: string; status: string; closedAt: string };
export type CapaPlanBlock = {
  reference: string; criticality: string; description: string; deviations: string; rootCause: string;
  rows: CapaPlanRow[]; actions: string; evidence: string;
};

/** Lista desplegable «Tipo» de la cabecera de la plantilla. */
export const capaPlanAuditTypeLabels: Record<AuditScenario, string> = {
  INTERNAL_COVEX: "Auditoría Interna", INTERNAL_CONTRACTED: "Auditoría Subcontratada", SUPPLIER: "Auditoría Externa",
  CLIENT: "Auditoría de Cliente", AUTHORITY: "Inspección",
};
/** Lista desplegable «Tipo / criticidad»: Crítica, Mayor, Menor, Recomendación. */
export function capaPlanCriticality(f: { findingType: string; criticality: string }) {
  if (f.findingType === "RECOMMENDATION") return "Recomendación";
  return ({ CRITICAL: "Crítica", MAJOR: "Mayor", MINOR: "Menor" } as Record<string, string>)[f.criticality] ?? "";
}
/**
 * Estado de la CAPA con la lista de la plantilla (Abierta / Pendiente / Cerrada), según lo acordado con Calidad:
 * abierta o en curso; cerrada a falta de verificar la eficacia; cerrada y eficaz (o sin eficacia aplicable).
 * Una cancelada sale como «Cerrada (cancelada)» y una no eficaz como «Cerrada (no eficaz)».
 */
export function capaPlanCapaStatus(c: { status: string; effectivenessStatus: string }) {
  if (c.status === "CANCELLED") return "Cerrada (cancelada)";
  if (c.status !== "CLOSED") return "Abierta";
  if (c.effectivenessStatus === "PENDING") return "Pendiente";
  if (c.effectivenessStatus === "NONCONFORMING") return "Cerrada (no eficaz)";
  return "Cerrada";
}
/** Estado de una acción propia de la auditoría con la misma lista. */
export function capaPlanActionStatus(status: string) {
  return ({ OPEN: "Abierta", IN_PROGRESS: "Abierta", PENDING_VERIFICATION: "Pendiente", CLOSED: "Cerrada", NOT_APPLICABLE: "No aplica" } as Record<string, string>)[status] ?? status;
}
const dmy = (v: string | null | undefined) => v ? v.slice(0, 10).split("-").reverse().join("/") : "";
const terminal = (s: string) => s.startsWith("Cerrada") || s === "No aplica";

/**
 * Un bloque por hallazgo activo. Filas de datos: una por CAPA (código, responsables, fecha prevista, estado y
 * cierre) y una por acción propia sin código CAPA; sin ninguna, una fila con el estado del tratamiento.
 * Causa raíz: la de la desviación; si aún no la tiene, «Pendiente de investigación (código)»; sin desviación,
 * la del hallazgo. Una fecha de cierre pendiente sale como «Pendiente», como en el ejemplo de Calidad.
 */
export function capaPlanBlocks(findings: Finding[], links: CapaPlanLinks | undefined): CapaPlanBlock[] {
  return findings.filter(f => f.isActive).map(f => {
    const link = links?.[f.id] ?? { deviations: [], capas: [] };
    const actions = f.actions.filter(a => a.isActive);
    const rootCause = link.deviations.length
      ? link.deviations.map(d => d.rootCause?.trim() || `Pendiente de investigación (${d.code})`).join("\n")
      : f.rootCause?.trim() ?? "";
    const rows: CapaPlanRow[] = [
      ...link.capas.map(c => { const status = capaPlanCapaStatus(c); return { code: c.code, responsible: c.responsible.join("\n"), plannedDate: dmy(c.plannedDate), status, closedAt: terminal(status) ? dmy(c.closedAt) : "Pendiente" }; }),
      ...actions.map(a => { const status = capaPlanActionStatus(a.status); return { code: "", responsible: a.responsible ?? "", plannedDate: dmy(a.targetDate), status, closedAt: terminal(status) ? dmy(a.closedAt) : "Pendiente" }; }),
    ];
    if (!rows.length) { const status = capaPlanActionStatus(f.treatmentStatus); rows.push({ code: "", responsible: "", plannedDate: "", status, closedAt: terminal(status) ? dmy(f.closedAt) : "Pendiente" }); }
    const actionText = [
      ...link.capas.flatMap(c => c.actions.map(text => `${c.code}: ${text}`)),
      ...actions.map(a => a.description),
      f.treatment?.trim() ?? "",
    ].filter(Boolean).join("\n");
    const evidence = [f.evidenceReference, f.evidence, ...actions.flatMap(a => [a.evidenceReference, a.evidence])].map(v => v?.trim()).filter(Boolean).join("\n");
    return { reference: f.reference, criticality: capaPlanCriticality(f), description: f.description, deviations: link.deviations.map(d => d.code).join("\n"), rootCause, rows, actions: actionText, evidence };
  });
}
