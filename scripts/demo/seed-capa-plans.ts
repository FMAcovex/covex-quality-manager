/**
 * Versiones del CAPA plan de los ejemplos de la demo (D-109, D-110): la 00 de las auditorías
 * abiertas de ejemplo y un seguimiento 01 en la interna. Se ejecuta después de instalar las
 * plantillas, porque cada versión congela su A4.03: sin esa plantilla no hace nada. Las
 * auditorías que ya tienen versiones no se tocan. Todos los datos son inventados.
 */
import { randomUUID } from "node:crypto";
import { prisma } from "../../src/lib/db";
import { localDemoEnvironment } from "../../src/lib/auth/config";
import { establishCapaPlan, recordCapaPlanFollowup } from "../../src/modules/audits/capa-plan-service";
import { TemplateAssetError } from "../../src/modules/configuration/template-assets";

const MARK_PREFIX = "EJEMPLO DEMO (D-109)";
const ACTOR = "Demo · Garantía de Calidad";
const today = new Date();
/** Fecha a `n` días de hoy (negativo: pasado), como en los ejemplos. */
const day = (n: number) => new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + n)).toISOString().slice(0, 10);
const iso = (d: Date | null) => d ? d.toISOString().slice(0, 10) : "";

async function main() {
  if (!localDemoEnvironment() || process.env.ALLOW_DEMO_DATA !== "true") throw new Error("Solo para la demo (APP_ENV=demo, base covex_demo, ALLOW_DEMO_DATA=true).");
  const audits = await prisma.audit.findMany({
    where: { internalObservations: { startsWith: MARK_PREFIX }, status: "OPEN", scenario: { in: ["INTERNAL_COVEX", "SUPPLIER"] }, capaPlanVersions: { none: {} } },
    include: { findings: { where: { isActive: true }, include: { actions: { where: { isActive: true } } } } },
  });
  if (!audits.length) { console.log("CAPA plan de los ejemplos: nada que añadir."); return; }
  for (const audit of audits) {
    try {
      await establishCapaPlan(audit.id, { actor: ACTOR, requestId: randomUUID(), capaPlanDate: iso(audit.reportDate) || day(-18) });
    } catch (error) {
      if (error instanceof TemplateAssetError) { console.log("CAPA plan de los ejemplos: falta la plantilla A4.03; se establece desde la aplicación cuando esté instalada."); return; }
      throw error;
    }
    if (audit.scenario !== "INTERNAL_COVEX") continue;
    // Seguimiento 01: la acción abierta pasa a en curso, con su referencia de evidencia.
    const fresh = await prisma.auditFinding.findMany({ where: { auditId: audit.id, isActive: true }, include: { actions: { where: { isActive: true } } } });
    const form: Record<string, string> = { actor: ACTOR, requestId: randomUUID(), followupDate: day(-5), nextReviewDate: day(25), observations: "Seguimiento mensual del CAPA plan (ejemplo ficticio).", changeReason: "" };
    let moved = false;
    for (const f of fresh) {
      for (const a of f.actions) {
        const start = !moved && a.status === "OPEN";
        if (start) moved = true;
        Object.assign(form, { [`a.${a.id}.status`]: start ? "IN_PROGRESS" : a.status, [`a.${a.id}.closedAt`]: iso(a.closedAt), [`a.${a.id}.targetDate`]: iso(a.targetDate), [`a.${a.id}.evidenceReference`]: start ? "Recordatorio al personal enviado (ficticio)" : a.evidenceReference ?? "", [`a.${a.id}.evidence`]: a.evidence ?? "", [`a.${a.id}.updatedAt`]: a.updatedAt.toISOString() });
      }
      if (!f.actions.length) Object.assign(form, { [`f.${f.id}.treatmentStatus`]: f.treatmentStatus, [`f.${f.id}.treatment`]: f.treatment ?? "", [`f.${f.id}.closedAt`]: iso(f.closedAt), [`f.${f.id}.evidenceReference`]: f.evidenceReference ?? "", [`f.${f.id}.evidence`]: f.evidence ?? "", [`f.${f.id}.updatedAt`]: f.updatedAt.toISOString() });
    }
    await recordCapaPlanFollowup(audit.id, form);
  }
  console.log(`CAPA plan de los ejemplos: versiones añadidas en ${audits.length} auditorías.`);
}
main().finally(() => prisma.$disconnect()).catch((error) => { console.error(error); process.exitCode = 1; });
