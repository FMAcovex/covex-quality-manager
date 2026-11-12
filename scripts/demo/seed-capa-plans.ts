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
import { templateActivationBlocked, templateActivationCheck } from "../../src/modules/configuration/template-activation";

const MARK_PREFIX = "EJEMPLO DEMO (D-109)";
const ACTOR = "Demo · Garantía de Calidad";
const today = new Date();
/** Fecha a `n` días de hoy (negativo: pasado), como en los ejemplos. */
const day = (n: number) => new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + n)).toISOString().slice(0, 10);
const iso = (d: Date | null) => d ? d.toISOString().slice(0, 10) : "";

/**
 * D-137 (R6): en la demo se activan las plantillas de Auditorías de los PNT GC-00/033/04 y GC-00/034/05 si están
 * instaladas, como haría Calidad en Configuración → Versiones. Las auditorías abiertas antes del 15/11/2026 siguen con las
 * anteriores (D-134); los ejemplos R6 se abren desde esa fecha.
 */
const R6_TEMPLATES: Record<string, string> = {
  AUDIT_INTERNAL_REPORT: "04", AUDIT_EXTERNAL_REPORT: "05", AUDIT_EXTERNAL_PLAN: "05", AUDIT_CAPA_PLAN: "04",
  AUDIT_ANNUAL_INTERNAL_PROGRAMME: "GC-00-033-04-ANEXO-V", AUDIT_ANNUAL_EXTERNAL_PROGRAMME: "GC-00-034-05-ANEXO-V",
};
async function activateR6Templates() {
  let activated = 0;
  for (const [documentType, versionCode] of Object.entries(R6_TEMPLATES)) {
    const target = await prisma.templateVersion.findFirst({ where: { module: "AUDIT", documentType: documentType as never, versionCode, isActive: false } });
    if (!target) continue;
    const current = await prisma.templateVersion.findFirst({ where: { module: "AUDIT", documentType: documentType as never, isActive: true }, orderBy: { effectiveFrom: "desc" } });
    if (current && current.effectiveFrom >= target.effectiveFrom) continue;
    // Las mismas comprobaciones que Configuración → Versiones (D-100): archivo presente, con su SHA-256 y compatible.
    const check = await templateActivationCheck(target);
    if (templateActivationBlocked(check)) { console.log(`Plantilla ${documentType} ${versionCode} sin activar: ${check.status === "incompatible" ? check.differences[0] : ""}`); continue; }
    await prisma.$transaction(async tx => {
      const active = await tx.templateVersion.findMany({ where: { module: "AUDIT", documentType: documentType as never, isActive: true } });
      for (const old of active) await tx.templateVersion.update({ where: { id: old.id }, data: { isActive: false, effectiveTo: new Date(target.effectiveFrom.getTime() - 86400000) } });
      const updated = await tx.templateVersion.update({ where: { id: target.id }, data: { isActive: true, effectiveTo: null } });
      // Queda en Configuración → Historial como una activación desde la aplicación.
      await tx.configurationChange.create({ data: { entityType: "TemplateVersion", entityKey: `AUDIT:${documentType}:${versionCode}`, action: "ACTIVATE", oldValue: summary(target), newValue: summary(updated), changedByText: ACTOR, reason: "Demo: activación de las plantillas de los PNT GC-00/033/04 y GC-00/034/05 (D-137)" } });
      activated++;
    });
  }
  if (activated) console.log(`Plantillas de Auditorías R6 activadas en la demo: ${activated}.`);
}
type TemplateRow = { id: string; module: string; documentType: string; versionCode: string; effectiveFrom: Date; effectiveTo: Date | null; isActive: boolean; fileName: string | null; fileSize: number | null; checksum: string | null };
const summary = (v: TemplateRow) => JSON.parse(JSON.stringify({ id: v.id, module: v.module, documentType: v.documentType, versionCode: v.versionCode, effectiveFrom: v.effectiveFrom, effectiveTo: v.effectiveTo, isActive: v.isActive, fileName: v.fileName, fileSize: v.fileSize, checksum: v.checksum }));

async function main() {
  if (!localDemoEnvironment() || process.env.ALLOW_DEMO_DATA !== "true") throw new Error("Solo para la demo (APP_ENV=demo, base covex_demo, ALLOW_DEMO_DATA=true).");
  await activateR6Templates();
  const audits = await prisma.audit.findMany({
    where: { internalObservations: { startsWith: MARK_PREFIX }, status: "OPEN", scenario: { in: ["INTERNAL_COVEX", "SUPPLIER", "AUTHORITY"] }, capaPlanVersions: { none: {} } },
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
    // El ejemplo R6 (D-137) se queda en la versión 00: su seguimiento sería anterior a la propia auditoría.
    if (audit.scenario !== "INTERNAL_COVEX" || audit.internalObservations?.endsWith(" R6")) continue;
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
