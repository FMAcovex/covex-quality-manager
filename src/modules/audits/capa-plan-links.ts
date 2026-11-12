import type { Prisma } from "@prisma/client";
import { documentRecordCode } from "@/lib/qms/document-code";
import type { CapaPlanCapa, CapaPlanLinks } from "./capa-plan-annex";

type Db = Pick<Prisma.TransactionClient, "auditFindingRelation" | "qmsRelation" | "qmsRecord">;
const iso = (d: Date | null | undefined) => d ? d.toISOString().slice(0, 10) : null;

/**
 * D-136 (R6): desviaciones y CAPA de cada hallazgo para el plan CAPA del Anexo IV. Las CAPA salen de las
 * atribuciones del hallazgo (directas) y de las relaciones activas de sus desviaciones con CAPA, en ambos
 * sentidos. Solo relaciones activas; un expediente anulado sale como «código (anulado)».
 */
export async function loadCapaPlanLinks(db: Db, findingIds: string[]): Promise<CapaPlanLinks> {
  const links: CapaPlanLinks = Object.fromEntries(findingIds.map(id => [id, { deviations: [], capas: [] }]));
  if (!findingIds.length) return links;
  const attributions = await db.auditFindingRelation.findMany({
    where: { findingId: { in: findingIds }, isActive: true, qmsRelation: { isActive: true } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { findingId: true, qmsRelation: { select: { targetRecord: { select: { id: true, recordType: true, businessCode: true, annulledBusinessCode: true, deviation: { select: { rootCause: true } } } } } } },
  });
  const deviationIds = [...new Set(attributions.filter(a => a.qmsRelation.targetRecord.recordType === "DEVIATION").map(a => a.qmsRelation.targetRecord.id))];
  const deviationCapas = deviationIds.length ? await db.qmsRelation.findMany({
    where: { isActive: true, OR: [
      { sourceRecordId: { in: deviationIds }, targetRecord: { recordType: "CAPA" } },
      { targetRecordId: { in: deviationIds }, sourceRecord: { recordType: "CAPA" } },
    ] },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { sourceRecordId: true, targetRecordId: true },
  }) : [];
  const capasOfDeviation = new Map<string, string[]>();
  for (const r of deviationCapas) {
    const [deviation, capa] = deviationIds.includes(r.sourceRecordId) ? [r.sourceRecordId, r.targetRecordId] : [r.targetRecordId, r.sourceRecordId];
    capasOfDeviation.set(deviation, [...(capasOfDeviation.get(deviation) ?? []), capa]);
  }
  const capaIds = [...new Set([...attributions.filter(a => a.qmsRelation.targetRecord.recordType === "CAPA").map(a => a.qmsRelation.targetRecord.id), ...deviationCapas.flatMap(r => [r.sourceRecordId, r.targetRecordId]).filter(id => !deviationIds.includes(id))])];
  const capaRecords = capaIds.length ? await db.qmsRecord.findMany({
    where: { id: { in: capaIds } },
    select: { id: true, businessCode: true, annulledBusinessCode: true, capa: { select: {
      status: true, effectivenessStatus: true, effectiveClosedAt: true, operationalClosedAt: true,
      plannedActions: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }], select: { description: true, responsible: true, plannedExecutionDate: true, responsibleUser: { select: { displayName: true } } } },
    } } },
  }) : [];
  const capas = new Map<string, CapaPlanCapa>();
  for (const r of capaRecords) {
    if (!r.capa) continue;
    const dates = r.capa.plannedActions.map(a => iso(a.plannedExecutionDate)).filter((d): d is string => Boolean(d)).sort();
    capas.set(r.id, {
      code: documentRecordCode(r) ?? "Sin código", status: r.capa.status, effectivenessStatus: r.capa.effectivenessStatus,
      responsible: [...new Set(r.capa.plannedActions.map(a => a.responsible?.trim() || a.responsibleUser?.displayName || "").filter(Boolean))],
      // La CAPA se completa con su última acción planificada.
      plannedDate: dates.at(-1) ?? null,
      closedAt: iso(r.capa.effectiveClosedAt ?? r.capa.operationalClosedAt),
      actions: r.capa.plannedActions.map(a => a.description.trim()).filter(Boolean),
    });
  }
  for (const a of attributions) {
    const target = a.qmsRelation.targetRecord, link = links[a.findingId];
    const add = (id: string) => { const c = capas.get(id); if (c && !link.capas.some(x => x.code === c.code)) link.capas.push(c); };
    if (target.recordType === "DEVIATION") {
      const code = documentRecordCode(target) ?? "Sin código";
      if (!link.deviations.some(d => d.code === code)) link.deviations.push({ code, rootCause: target.deviation?.rootCause ?? null });
      for (const id of capasOfDeviation.get(target.id) ?? []) add(id);
    } else if (target.recordType === "CAPA") add(target.id);
  }
  return links;
}
