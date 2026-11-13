/**
 * D-136 (R6): plan CAPA del Anexo IV del PNT GC-00/033/04 (también para auditorías recibidas e inspecciones).
 * Un bloque por hallazgo (o por varios que comparten desviación y CAPA) con una fila de datos por CAPA y por acción propia, y debajo
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
 * Un bloque por hallazgo activo, salvo los que comparten desviación y CAPA (ver `groupBlocks`). Filas de datos: una por
 * CAPA (código, responsables, fecha prevista, estado y cierre) y una por acción propia sin código CAPA; sin ninguna, una
 * fila con el estado del tratamiento. Causa raíz: la de la desviación; si aún no la tiene, «Pendiente de investigación
 * (código)»; sin desviación, la del hallazgo. Una fecha de cierre pendiente sale como «Pendiente», como en el ejemplo de Calidad.
 */
export function capaPlanBlocks(findings: Finding[], links: CapaPlanLinks | undefined): CapaPlanBlock[] {
  const drafts = findings.filter(f => f.isActive).map((f): Draft => {
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
    const capaText = link.capas.flatMap(c => c.actions.map(text => `${c.code}: ${text}`)).join("\n");
    const ownText = [...actions.map(a => a.description), f.treatment?.trim() ?? ""].filter(Boolean).join("\n");
    const evidence = [f.evidenceReference, f.evidence, ...actions.flatMap(a => [a.evidenceReference, a.evidence])].map(v => v?.trim()).filter(Boolean).join("\n");
    // Solo se agrupan hallazgos sin acciones propias que comparten las mismas desviaciones activas y las mismas CAPA
    // (por expediente) y el mismo tipo (hallazgo o recomendación): así sus filas son idénticas.
    const groupable = link.deviations.length > 0 && !actions.length && link.deviations.every(d => d.recordId && d.active !== false) && link.capas.every(c => c.recordId);
    const key = groupable ? [f.findingType === "RECOMMENDATION", link.deviations.map(d => d.recordId).sort(), link.capas.map(c => c.recordId).sort(), rows].map(v => JSON.stringify(v)).join("|") : "";
    return { reference: f.reference, criticality: capaPlanCriticality(f), description: f.description, deviations: link.deviations.map(d => d.code).join("\n"), rootCause, rows, actions: [capaText, ownText].filter(Boolean).join("\n"), evidence, key, capaText, ownText };
  });
  return groupBlocks(drafts);
}

type Draft = CapaPlanBlock & { key: string; capaText: string; ownText: string };
const SEVERITY = ["Crítica", "Mayor", "Menor", "Recomendación", ""];
/** Caracteres de descripción que caben en una fila de 409 pt (unas 25 líneas de la columna C), con margen. */
const DESCRIPTION_PER_ROW = 1300;
const block = (d: Draft): CapaPlanBlock => ({ reference: d.reference, criticality: d.criticality, description: d.description, deviations: d.deviations, rootCause: d.rootCause, rows: d.rows, actions: d.actions, evidence: d.evidence });
/**
 * Ejemplo de Calidad (13/11/2026): los hallazgos con la misma desviación y las mismas CAPA van en el bloque del primero.
 * Nº con todas las referencias; descripciones, textos propios y evidencias con su referencia delante e íntegros; las
 * CAPA y sus acciones una vez; la criticidad más alta. Si las descripciones juntas no caben en las filas del bloque,
 * el hallazgo empieza un bloque nuevo.
 */
function groupBlocks(drafts: Draft[]): CapaPlanBlock[] {
  const open = new Map<string, Draft[]>(), groups: Draft[][] = [];
  const size = (members: Draft[]) => members.reduce((n, m) => n + m.reference.length + m.description.length + 4, 0);
  for (const d of drafts) {
    const members = d.key ? open.get(d.key) : undefined;
    if (members && size([...members, d]) <= DESCRIPTION_PER_ROW * d.rows.length) { members.push(d); continue; }
    groups.push([d]); if (d.key) open.set(d.key, groups[groups.length - 1]);
  }
  return groups.map((members) => {
    const [first] = members;
    if (members.length === 1) return block(first);
    const tagged = (text: (m: Draft) => string) => members.map(m => text(m) && `${m.reference}: ${text(m)}`).filter(Boolean);
    return {
      ...block(first),
      reference: members.map(m => m.reference).join("\n\n"),
      criticality: SEVERITY.find(level => members.some(m => m.criticality === level)) ?? first.criticality,
      description: members.map(m => `${m.reference}. ${m.description}`).join("\n\n"),
      actions: [first.capaText, ...tagged(m => m.ownText)].filter(Boolean).join("\n"),
      evidence: tagged(m => m.evidence).join("\n"),
    };
  });
}
