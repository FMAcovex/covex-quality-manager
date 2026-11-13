/**
 * D-136 (R6): plan CAPA del Anexo IV del PNT GC-00/033/04 (también para auditorías recibidas e inspecciones).
 * Un bloque por hallazgo con una fila de datos por CAPA y por acción propia de la auditoría, y debajo
 * «Acciones / Justificación / Observaciones» y «Evidencias». Lógica pura: la carga de vínculos está en
 * `capa-plan-links.ts` y la escritura en Excel en el generador.
 */
import type { AuditScenario } from "@prisma/client";

/** Una CAPA vinculada al hallazgo directamente o a través de su desviación. */
export type CapaPlanCapa = {
  /** Id del expediente (para no confundir dos CAPA sin código) y si está activo (no anulado). */
  recordId?: string; active?: boolean;
  code: string; status: string; effectivenessStatus: string;
  responsible: string[]; plannedDate: string | null; closedAt: string | null; actions: string[];
};
export type CapaPlanFindingLinks = { deviations: { recordId?: string; code: string; rootCause: string | null; active?: boolean }[]; capas: CapaPlanCapa[] };
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
export function capaPlanCapaStatus(c: { status: string; effectivenessStatus: string; active?: boolean }) {
  // Una CAPA anulada (administrativamente) no es abierta ni cerrada.
  if (c.active === false) return "Anulada";
  if (c.status === "CANCELLED") return "Cerrada (cancelada)";
  if (c.status !== "CLOSED") return "Abierta";
  if (c.effectivenessStatus === "PENDING") return "Pendiente";
  if (c.effectivenessStatus === "NONCONFORMING") return "Cerrada (no eficaz)";
  return "Cerrada";
}
/** Estado de una acción propia de la auditoría con la misma lista. */
export function capaPlanActionStatus(status: string) {
  return ({ OPEN: "Abierta", IN_PROGRESS: "Abierta", PENDING_VERIFICATION: "Pendiente", CLOSED: "Cerrada", NOT_APPLICABLE: "No procede" } as Record<string, string>)[status] ?? status;
}
const dmy = (v: string | null | undefined) => v ? v.slice(0, 10).split("-").reverse().join("/") : "";
const terminal = (s: string) => s.startsWith("Cerrada") || s === "No procede";

/**
 * Un bloque por hallazgo activo. Filas de datos: una por CAPA (código, responsables, fecha prevista, estado y
 * cierre) y una por acción propia sin código CAPA; sin ninguna, una fila con el estado del tratamiento.
 * Causa raíz: la de la desviación; si aún no la tiene, «Pendiente de investigación (código)»; sin desviación,
 * la del hallazgo. Una fecha de cierre pendiente sale como «Pendiente», como en el ejemplo de Calidad.
 * Los hallazgos con las mismas desviaciones salen en un solo bloque (ejemplo de Calidad del 13/11/2026).
 */
export function capaPlanBlocks(findings: Finding[], links: CapaPlanLinks | undefined): CapaPlanBlock[] {
  const blocks = findings.filter(f => f.isActive).map(f => {
    const link = links?.[f.id] ?? { deviations: [], capas: [] };
    const actions = f.actions.filter(a => a.isActive);
    const rootCause = link.deviations.length
      // Una desviación anulada no pide investigación.
      ? link.deviations.map(d => d.rootCause?.trim() || (d.active === false ? "" : `Pendiente de investigación (${d.code})`)).filter(Boolean).join("\n")
      : f.rootCause?.trim() ?? "";
    const rows: CapaPlanRow[] = [
      ...link.capas.map(c => { const status = capaPlanCapaStatus(c); return { code: c.code, responsible: c.responsible.join("\n"), plannedDate: dmy(c.plannedDate), status, closedAt: status === "Anulada" ? "" : terminal(status) ? dmy(c.closedAt) : "Pendiente" }; }),
      ...actions.map(a => { const status = capaPlanActionStatus(a.status); return { code: "", responsible: a.responsible ?? "", plannedDate: dmy(a.targetDate), status, closedAt: terminal(status) ? dmy(a.closedAt) : "Pendiente" }; }),
    ];
    if (!rows.length) { const status = capaPlanActionStatus(f.treatmentStatus); rows.push({ code: "", responsible: "", plannedDate: "", status, closedAt: terminal(status) ? dmy(f.closedAt) : "Pendiente" }); }
    const actionText = [
      ...link.capas.flatMap(c => c.actions.map(text => `${c.code}: ${text}`)),
      ...actions.map(a => a.description),
      f.treatment?.trim() ?? "",
    ].filter(Boolean).join("\n");
    const evidence = [f.evidenceReference, f.evidence, ...actions.flatMap(a => [a.evidenceReference, a.evidence])].map(v => v?.trim()).filter(Boolean).join("\n");
    const group = link.deviations.map(d => d.recordId ?? d.code).sort().join("|");
    return { reference: f.reference, criticality: capaPlanCriticality(f), description: f.description, deviations: link.deviations.map(d => d.code).join("\n"), rootCause, rows, actions: actionText, evidence, group };
  });
  return groupByDeviation(blocks);
}

const SEVERITY = ["Crítica", "Mayor", "Menor", "Recomendación", ""];
const unique = <T,>(items: T[], key: (item: T) => string = String) => items.filter((item, i) => items.findIndex(other => key(other) === key(item)) === i);
const lines = (texts: string[]) => unique(texts.flatMap(t => t.split("\n")).filter(Boolean)).join("\n");
/**
 * Une en el bloque del primero los hallazgos que comparten las mismas desviaciones: Nº con todas las referencias,
 * descripciones precedidas de su referencia, la criticidad más alta, y CAPA, acciones y evidencias sin repetir.
 */
function groupByDeviation(blocks: (CapaPlanBlock & { group: string })[]): CapaPlanBlock[] {
  const byGroup = new Map<string, CapaPlanBlock[]>(), ordered: CapaPlanBlock[][] = [];
  for (const { group, ...block } of blocks) {
    const members = group ? byGroup.get(group) : undefined;
    if (members) { members.push(block); continue; }
    ordered.push([block]); if (group) byGroup.set(group, ordered[ordered.length - 1]);
  }
  return ordered.map(([first, ...rest]) => {
    if (!rest.length) return first;
    const members = [first, ...rest];
    return {
      ...first,
      reference: members.map(m => m.reference).join("\n\n"),
      criticality: SEVERITY.find(level => members.some(m => m.criticality === level)) ?? first.criticality,
      description: members.map(m => `${m.reference}. ${m.description}`).join("\n\n"),
      rows: unique(members.flatMap(m => m.rows), r => JSON.stringify(r)),
      actions: lines(members.map(m => m.actions)),
      evidence: lines(members.map(m => m.evidence)),
    };
  });
}
