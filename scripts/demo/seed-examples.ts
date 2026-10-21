/**
 * Ejemplos de la demo (D-109): seis a ocho expedientes ficticios por módulo, en distintos
 * momentos del ciclo, con relaciones entre módulos, acciones asignadas a los perfiles de demo y
 * fechas relativas al día de carga (siempre hay algo vencido, algo próximo y algo cerrado).
 *
 * Solo en la demo local o de Codespaces (`localDemoEnvironment`) y con ALLOW_DEMO_DATA=true.
 * Si los ejemplos ya están cargados no hace nada. Todos los datos son inventados.
 */
import { PrismaClient, type Prisma, type QmsRecordType } from "@prisma/client";
import { localDemoEnvironment } from "../../src/lib/auth/config";
import { demoProfiles } from "../../src/lib/auth/demo-profiles";
import { createQmsRelation } from "../../src/lib/qms/relation-service";
import { serializeChangeControlVersion, snapshotJson } from "../../src/lib/qms/versioning";

const prisma = new PrismaClient();
const MARK = "EJEMPLO DEMO (D-109). Datos ficticios: no corresponden a ningún expediente real.";
const ACTOR = "Demo · Garantía de Calidad";
const QA = demoProfiles[0].id;
const MANAGER = demoProfiles[1].id;

const today = new Date();
/** Fecha a `n` días de hoy (negativo: pasado), a medianoche UTC. */
const day = (n: number) => new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + n));
const yearOf = (date: Date) => date.getUTCFullYear();

type Department = { id: string; code: string; name: string };
let departments: Record<string, Department> = {};
const dep = (code: string) => {
  const d = departments[code];
  if (!d) throw new Error(`Falta el departamento ${code}: ejecuta pnpm db:seed.`);
  return { departmentId: d.id, departmentCodeSnapshot: d.code, departmentNameSnapshot: d.name };
};

// Códigos con el formato de la aplicación, continuando la numeración que ya exista.
const used = new Map<string, number>();
async function nextCode(type: QmsRecordType, prefix: string, year: number, digits: number) {
  const key = `${type}|${prefix}|${year}`;
  if (!used.has(key)) {
    const rows = await prisma.qmsRecord.findMany({
      where: { recordType: type, OR: [{ businessCode: { startsWith: prefix } }, { annulledBusinessCode: { startsWith: prefix } }] },
      select: { businessCode: true, annulledBusinessCode: true },
    });
    const pattern = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}(\\d+)/${year}$`);
    const max = Math.max(0, ...rows.flatMap((r) => [r.businessCode, r.annulledBusinessCode]).map((c) => Number(pattern.exec(c ?? "")?.[1] ?? 0)));
    used.set(key, max);
  }
  const next = used.get(key)! + 1;
  used.set(key, next);
  return `${prefix}${String(next).padStart(digits, "0")}/${year}`;
}

/** Registro común del expediente; un borrador no lleva código. */
async function record(type: QmsRecordType, opened: Date, code: string | null, annul?: { reason: string; at: Date }) {
  const row = await prisma.qmsRecord.create({
    data: annul
      ? { recordType: type, year: yearOf(opened), businessCode: null, annulledBusinessCode: code, isActive: false, annulledAt: annul.at, annulledByText: ACTOR, annulledReason: annul.reason }
      : { recordType: type, year: yearOf(opened), businessCode: code },
  });
  await prisma.changeHistory.create({ data: { qmsRecordId: row.id, changedAt: opened, changedByText: ACTOR, fieldPath: "__created__", reason: "Ejemplo de la demo", source: "SYSTEM" } });
  return row;
}

const relations: [string, string][] = [];
const relate = (source: { id: string }, target: { id: string }) => relations.push([source.id, target.id]);

// ───────────────────────────── Desviaciones ─────────────────────────────
async function deviations() {
  const out: Record<string, { id: string; code: string | null }> = {};
  const base = (code: string, opened: Date) => ({ ...dep(code), issueDate: opened, createdByText: ACTOR, internalObservations: MARK });

  // 1. Borrador recién detectado.
  {
    const opened = day(-1);
    const r = await record("DEVIATION", opened, null);
    await prisma.deviation.create({ data: { qmsRecordId: r.id, status: "DRAFT", ...base("PM-10", opened), eventDateTime: opened, detectedBy: "Operario de acondicionamiento (turno de mañana)", provenance: "EQUIPMENT_LINE", affectedEquipmentLine: "Blistadora B-2", materialProcessAffected: "Acondicionamiento primario · blistadora B-2", productLot: "L26-0418", whatHappened: "Rotura del film de aluminio durante el sellado; la línea se detuvo automáticamente con 120 blísteres sin sellar en la tolva." } });
    out.borrador = { id: r.id, code: null };
  }
  // 2. Abierta, mayor, investigación en curso y CAPA propuesta vencida (asignada a Garantía de Calidad).
  {
    const opened = day(-40), code = await nextCode("DEVIATION", "D/LG-30/", yearOf(opened), 3);
    const r = await record("DEVIATION", opened, code);
    const d = await prisma.deviation.create({ data: { qmsRecordId: r.id, status: "OPEN", ...base("LG-30", opened), eventDateTime: opened, detectedBy: "Técnico de almacén", provenance: "OTHER", otherOrigin: "Registro continuo de temperatura", materialProcessAffected: "Almacenamiento en cámara fría C-03", productLot: "L26-0233", additionalLots: [{ lot: "L26-0241" }], whatHappened: "El registrador de la cámara fría C-03 marcó 9,4 °C durante 3 horas (rango 2–8 °C).", whoInvolved: "Técnico de almacén del turno de noche.", whenHappened: "Madrugada del día de apertura, entre las 02:10 y las 05:15.", whereHappened: "Cámara fría C-03, almacén farma.", howHappened: "La alarma acústica no se activó; se detectó al revisar el registro al inicio del turno.", classification: "MAJOR", investigation: "En curso: se revisa el histórico del compresor, el mantenimiento de la alarma y los datos de estabilidad de los lotes afectados.", investigationMethods: ["ISHIKAWA"], dataQualityStatus: "INCOMPLETE" } });
    await prisma.deviationImmediateAction.create({ data: { deviationId: d.id, description: "Bloqueo de los lotes L26-0233 y L26-0241 y traslado a la cámara de reserva C-04.", executedBy: "Responsable de almacén", executedAt: opened, sortOrder: 10 } });
    await prisma.deviationCapaPlan.create({ data: { deviationId: d.id, actionType: "CORRECTIVE", description: "Sustituir el relé de la alarma de la cámara C-03 y verificar el aviso remoto.", plannedExecutionDate: day(-5), responsible: "Responsable de Garantía de Calidad", responsibleUserId: QA, proposalStatus: "PROPOSED" } });
    await prisma.deviationFollowup.create({ data: { deviationId: d.id, followupDate: day(-20), completedByText: ACTOR, followupType: "Seguimiento de la investigación", comment: "Mantenimiento confirma fallo intermitente del relé de alarma. Pendiente informe de estabilidad.", nextFollowupDate: day(3) } });
    out.camara = { id: r.id, code };
  }
  // 3. Abierta, menor, investigación concluida y CAPA creada (acción para el responsable de departamento).
  {
    const opened = day(-25), code = await nextCode("DEVIATION", "D/GC-00/", yearOf(opened), 3);
    const r = await record("DEVIATION", opened, code);
    const d = await prisma.deviation.create({ data: { qmsRecordId: r.id, status: "OPEN", ...base("GC-00", opened), eventDateTime: opened, detectedBy: "Técnico de Garantía de Calidad", provenance: "OTHER", otherOrigin: "Revisión de documentación de lote", materialProcessAffected: "Limpieza de la sala de pesadas 2", affectedDocumentation: "Registro de limpieza de la sala de pesadas, semana 14", whatHappened: "El registro de limpieza de la sala de pesadas tiene tres días sin la firma de verificación.", whoInvolved: "Personal de limpieza y supervisor de turno.", whenHappened: "Detectado en la revisión semanal de registros.", whereHappened: "Sala de pesadas 2.", howHappened: "Revisión documental previa a la liberación del lote.", investigation: "El formato vigente no indica quién verifica cuando el supervisor está ausente.", investigationConclusive: "YES", investigationMethods: ["FIVE_WHYS"], rootCause: "Formato de registro sin responsable suplente de verificación.", rootCauseCategories: ["METHOD"], recurrentRootCause: "NO", classification: "MINOR", validationImpact: "NO", registrationImpact: "NO", stabilityImpact: "NA", otherProcessesImpact: "NO", affectsFinishedProduct: "NO", capaRequired: true, dataQualityStatus: "COMPLETE" } });
    await prisma.deviationCapaPlan.create({ data: { deviationId: d.id, actionType: "CORRECTIVE", description: "Revisar el formato e incluir el suplente de verificación.", plannedExecutionDate: day(10), responsible: "Responsable de departamento", responsibleUserId: MANAGER, proposalStatus: "PROPOSED" } });
    out.limpieza = { id: r.id, code };
  }
  // 4. Cerrada, menor, sin CAPA.
  {
    const opened = day(-210), code = await nextCode("DEVIATION", "D/LG-30/", yearOf(opened), 3);
    const r = await record("DEVIATION", opened, code);
    await prisma.deviation.create({ data: { qmsRecordId: r.id, status: "CLOSED", closedAt: day(-185), ...base("LG-30", opened), detectedBy: "Técnico de expediciones", provenance: "FINISHED_PRODUCT_SYSTEM", finishedProductSystem: "Ibuprofeno 600 mg comprimidos (ficticio)", materialProcessAffected: "Expedición · impresión de cajas", productLot: "L25-1102", affectedQuantity: "3 cajas", whatHappened: "Tres cajas de expedición con el lote impreso ilegible.", investigation: "Cabezal de impresión con suciedad puntual; el resto del lote es correcto.", investigationConclusive: "YES", rootCause: "Limpieza insuficiente del cabezal de la impresora de cajas.", rootCauseCategories: ["MACHINE"], recurrentRootCause: "NO", classification: "MINOR", validationImpact: "NO", registrationImpact: "NO", stabilityImpact: "NA", otherProcessesImpact: "NO", affectsFinishedProduct: "NO", capaRequired: false, conclusion: "Se reetiquetan las tres cajas. No se requiere CAPA: hecho aislado y corregido.", disposition: "Reetiquetado", dispositionQuantity: "3 cajas", clientNotification: "NO", dataQualityStatus: "COMPLETE" } });
    await prisma.deviationImmediateAction.create({ data: { deviationId: (await prisma.deviation.findUniqueOrThrow({ where: { qmsRecordId: r.id } })).id, description: "Reetiquetado de las tres cajas con verificación de un segundo operario.", executedBy: "Técnico de expediciones", executedAt: opened, sortOrder: 10 } });
    out.etiquetas = { id: r.id, code };
  }
  // 5. Cerrada, mayor, con CAPA (2025).
  {
    const opened = day(-330), code = await nextCode("DEVIATION", "D/PM-10/", yearOf(opened), 3);
    const r = await record("DEVIATION", opened, code);
    await prisma.deviation.create({ data: { qmsRecordId: r.id, status: "CLOSED", closedAt: day(-290), ...base("PM-10", opened), detectedBy: "Control en proceso", provenance: "FINISHED_PRODUCT_SYSTEM", finishedProductSystem: "Paracetamol 1 g comprimidos (ficticio)", materialProcessAffected: "Compresión · compresora C-1", productLot: "L25-0712", lotSize: "400.000 comprimidos", whatHappened: "Peso medio de los comprimidos un 4 % por debajo del objetivo en dos controles consecutivos.", investigation: "Desgaste de los punzones inferiores de la compresora C-1.", investigationConclusive: "YES", investigationMethods: ["ISHIKAWA"], rootCause: "Plan de sustitución de punzones basado en tiempo y no en número de compresiones.", rootCauseCategories: ["MACHINE", "METHOD"], recurrentRootCause: "NO", classification: "MAJOR", validationImpact: "NO", registrationImpact: "NO", stabilityImpact: "NO", otherProcessesImpact: "YES", otherProcessesImpactDetails: "Revisar el plan de las compresoras C-2 y C-3.", affectsFinishedProduct: "YES", capaRequired: true, conclusion: "Se segrega la fracción afectada; el resto del lote cumple. CAPA para cambiar el criterio de sustitución.", disposition: "Rechazo parcial", dispositionQuantity: "18.000 comprimidos", clientNotification: "NO", dataQualityStatus: "COMPLETE" } });
    out.peso = { id: r.id, code };
  }
  // 6. Abierta, mayor, originada por un OOS confirmado.
  {
    const opened = day(-12), code = await nextCode("DEVIATION", "D/GC-00/", yearOf(opened), 3);
    const r = await record("DEVIATION", opened, code);
    const d = await prisma.deviation.create({ data: { qmsRecordId: r.id, status: "OPEN", ...base("GC-00", opened), detectedBy: "Laboratorio de control de calidad", provenance: "FINISHED_PRODUCT_SYSTEM", finishedProductSystem: "Omeprazol 20 mg cápsulas (ficticio)", materialProcessAffected: "Mezcla y encapsulado", productLot: "L26-0301", whatHappened: "La Fase I del OOS de valoración no encontró error de laboratorio; se abre desviación para investigar el proceso.", classification: "MAJOR", investigation: "En curso: revisión de la documentación de fabricación y de la mezcla.", dataQualityStatus: "INCOMPLETE" } });
    await prisma.deviationImmediateAction.create({ data: { deviationId: d.id, description: "Lote L26-0301 retenido en cuarentena.", executedBy: "Garantía de Calidad", executedAt: opened, executedByUserId: QA, sortOrder: 10 } });
    out.oos = { id: r.id, code };
  }
  // 7. Anulada por registro duplicado.
  {
    const opened = day(-60), code = await nextCode("DEVIATION", "D/PM-10/", yearOf(opened), 3);
    const r = await record("DEVIATION", opened, code, { reason: "Registro duplicado: el mismo evento se gestiona en otra desviación.", at: day(-58) });
    await prisma.deviation.create({ data: { qmsRecordId: r.id, status: "OPEN", ...base("PM-10", opened), detectedBy: "Supervisor de producción", provenance: "OTHER", whatHappened: "Registro abierto por duplicado del mismo evento de la blistadora." } });
  }
  return out;
}

// ───────────────────────────── CAPA ─────────────────────────────
async function capas() {
  const out: Record<string, { id: string; code: string | null }> = {};
  const capa = async (o: { key: string; opened: Date; dept: string; type: "CORRECTIVE" | "PREVENTIVE"; draft?: boolean; data: Omit<Prisma.CapaUncheckedCreateInput, "qmsRecordId" | "actionType">; actions?: Omit<Prisma.CapaPlannedActionUncheckedCreateInput, "capaId">[]; followups?: Omit<Prisma.CapaFollowupUncheckedCreateInput, "capaId">[] }) => {
    const code = o.draft ? null : await nextCode("CAPA", `${o.type === "CORRECTIVE" ? "AC" : "AP"}/${o.dept}/`, yearOf(o.opened), 3);
    const r = await record("CAPA", o.opened, code);
    const c = await prisma.capa.create({ data: { qmsRecordId: r.id, actionType: o.type, ...dep(o.dept), openedAt: o.opened, createdByText: ACTOR, internalObservations: MARK, ...o.data } });
    for (const [i, a] of (o.actions ?? []).entries()) await prisma.capaPlannedAction.create({ data: { capaId: c.id, sortOrder: (i + 1) * 10, ...a } });
    for (const f of o.followups ?? []) await prisma.capaFollowup.create({ data: { capaId: c.id, ...f } });
    out[o.key] = { id: r.id, code };
  };
  await capa({ key: "limpieza", opened: day(-20), dept: "GC-00", type: "CORRECTIVE", data: { status: "OPEN", originType: "Desviación", defectDescription: "Registros de limpieza sin firma de verificación por ausencia del supervisor.", rootCause: "Formato sin responsable suplente.", rootCauseCategories: ["METHOD"], nextFollowupDate: day(12), effectivenessCriteria: "Ningún registro sin verificar en las cuatro semanas siguientes a la implantación.", dataQualityStatus: "COMPLETE" }, actions: [{ description: "Revisar el formato de registro de limpieza e incluir el suplente de verificación.", responsible: "Responsable de departamento", responsibleUserId: MANAGER, plannedExecutionDate: day(10) }, { description: "Formar al personal de limpieza y supervisores en el nuevo formato.", responsible: "Responsable de departamento", responsibleUserId: MANAGER, plannedExecutionDate: day(18) }], followups: [{ sequenceNumber: 1, followupDate: day(-5), completedByText: ACTOR, description: "Borrador del nuevo formato en revisión.", nextFollowupDate: day(12) }] });
  await capa({ key: "estuches", opened: day(-45), dept: "PM-10", type: "CORRECTIVE", data: { status: "OPEN", originType: "Reclamación", defectDescription: "Estuches con blísteres rotos detectados por un cliente.", rootCause: "Ajuste del empujador de la estuchadora fuera de rango tras un cambio de formato.", rootCauseCategories: ["MACHINE"], nextFollowupDate: day(-2), effectivenessCriteria: "Ninguna reclamación por rotura en los seis meses siguientes.", dataQualityStatus: "COMPLETE" }, actions: [{ description: "Incluir la verificación del empujador en la lista de cambio de formato.", responsible: "Responsable de Garantía de Calidad", responsibleUserId: QA, plannedExecutionDate: day(-7) }, { description: "Reforzar la inspección visual al final de línea durante un mes.", responsible: "Supervisor de acondicionamiento", plannedExecutionDate: day(15) }], followups: [{ sequenceNumber: 1, followupDate: day(-30), completedByText: ACTOR, description: "Acciones planificadas y comunicadas a producción.", nextFollowupDate: day(-2) }] });
  await capa({ key: "auditoria", opened: day(-75), dept: "PM-10", type: "PREVENTIVE", data: { status: "CLOSED", operationalClosedAt: day(-30), originType: "Auditoría interna", defectDescription: "La auditoría interna detectó que el plan de mantenimiento preventivo no cubre las balanzas de proceso.", rootCause: "Las balanzas se gestionaban solo con calibración externa.", rootCauseCategories: ["METHOD"], operationalStatusDescription: "Acciones ejecutadas; pendiente de verificar la eficacia.", effectivenessStatus: "PENDING", effectivenessCriteria: "Tres meses sin desviaciones de pesada atribuibles a balanzas.", dataQualityStatus: "COMPLETE" }, actions: [{ description: "Incluir las balanzas de proceso en el plan de mantenimiento preventivo.", responsible: "Mantenimiento", plannedExecutionDate: day(-40) }], followups: [{ sequenceNumber: 1, followupDate: day(-35), completedByText: ACTOR, description: "Plan actualizado y aprobado. Eficacia a verificar en tres meses." }] });
  await capa({ key: "punzones", opened: day(-300), dept: "PM-10", type: "CORRECTIVE", data: { status: "CLOSED", originType: "Desviación", defectDescription: "Peso medio bajo por desgaste de punzones.", rootCause: "Sustitución de punzones por tiempo y no por número de compresiones.", rootCauseCategories: ["MACHINE", "METHOD"], operationalClosedAt: day(-240), effectivenessStatus: "CONFORMING", effectivenessCriteria: "Seis lotes consecutivos con peso medio dentro de límites.", effectivenessAssessment: "Los seis lotes siguientes cumplieron; no hubo nuevas desviaciones de peso.", effectivenessEvidence: "Controles en proceso de los lotes L25-0790 a L25-0815.", effectiveClosedAt: day(-150), conclusion: "CAPA eficaz. Criterio de sustitución por número de compresiones implantado en las tres compresoras.", dataQualityStatus: "COMPLETE" }, actions: [{ description: "Cambiar el criterio de sustitución de punzones a 2 millones de compresiones.", responsible: "Mantenimiento", plannedExecutionDate: day(-260) }], followups: [{ sequenceNumber: 1, followupDate: day(-240), completedByText: ACTOR, description: "Acción implantada en C-1, C-2 y C-3." }] });
  await capa({ key: "tendencia", opened: day(-400), dept: "GC-00", type: "PREVENTIVE", data: { status: "CLOSED", originType: "Revisión de tendencias", defectDescription: "Aumento de desviaciones documentales en el segundo trimestre.", rootCause: "Rotación de personal sin formación documental inicial.", rootCauseCategories: ["PEOPLE"], operationalClosedAt: day(-330), effectivenessStatus: "CONFORMING", effectivenessCriteria: "Reducir a la mitad las desviaciones documentales en el trimestre siguiente.", effectivenessAssessment: "Se redujeron de 14 a 5.", effectiveClosedAt: day(-240), conclusion: "CAPA eficaz.", dataQualityStatus: "COMPLETE" }, actions: [{ description: "Incluir un módulo de buenas prácticas documentales en la acogida.", responsible: "Recursos Humanos / Garantía de Calidad", plannedExecutionDate: day(-350) }] });
  await capa({ key: "borrador", opened: day(-2), dept: "LG-30", type: "CORRECTIVE", draft: true, data: { status: "DRAFT", originType: "Desviación", defectDescription: "Borrador: alarma de temperatura de la cámara C-03 sin aviso remoto." } });
  await capa({ key: "cancelada", opened: day(-90), dept: "GC-00", type: "CORRECTIVE", data: { status: "CANCELLED", originType: "Desviación", defectDescription: "CAPA abierta por error para un evento ya cubierto por otra CAPA.", cancellationReason: "Duplicada: las acciones se gestionan en otra CAPA del mismo origen." } });
  return out;
}

// ───────────────────────────── Controles de cambios ─────────────────────────────
async function changes() {
  const out: Record<string, { id: string; code: string | null }> = {};
  const cc = async (key: string, opened: Date, dept: string, draft: boolean, data: Omit<Prisma.ChangeControlUncheckedCreateInput, "qmsRecordId">) => {
    const code = draft ? null : await nextCode("CHANGE_CONTROL", `C/${dept}/`, yearOf(opened), 3);
    const r = await record("CHANGE_CONTROL", opened, code);
    const c = await prisma.changeControl.create({ data: { qmsRecordId: r.id, ...dep(dept), requestDate: opened, internalObservations: MARK, ...data } });
    out[key] = { id: r.id, code };
    return c;
  };
  await cc("borrador", day(-3), "PM-10", true, { finalStatus: "DRAFT", requesterName: "Supervisor de producción", scope: ["EQUIPMENT"], description: "Borrador: sustituir la impresora de lote de la línea 3." });
  await cc("decision", day(-8), "GC-00", false, { finalStatus: "OPEN", requesterName: "Compras", requesterPosition: "Técnico de compras", scope: ["SUPPLIER", "MATERIAL"], description: "Cambio de proveedor de estuches de cartón para la familia de analgésicos.", justification: "El proveedor actual deja de fabricar el formato.", providedDocuments: "Especificación del nuevo estuche · Certificado del proveedor (ficticios)", requestDecision: "PENDING", requestDecisionResponsible: "Responsable de Garantía de Calidad", requestDecisionResponsibleUserId: QA, requestDecisionRole: "Garantía de Calidad" });
  await cc("dictamen", day(-15), "LG-30", false, { finalStatus: "OPEN", requesterName: "Responsable de almacén", scope: ["INSTALLATIONS"], description: "Ampliar la cámara fría C-04 con un segundo evaporador.", justification: "Aumento de volumen de producto termolábil.", requestDecision: "ACCEPTED", requestDecisionResponsible: "Responsable de Garantía de Calidad", requestDecisionRole: "Garantía de Calidad", requestDecisionDate: day(-12), evaluation: "En evaluación: impacto en la cualificación térmica y en el plan de mapeo.", classification: "MAJOR", plannedImplementationDate: day(60), dictamenResult: "PENDING" });
  {
    const c = await cc("ejecucion", day(-50), "GC-00", false, { finalStatus: "OPEN", requesterName: "Responsable de laboratorio", scope: ["EQUIPMENT", "DOCUMENTATION"], description: "Sustitución de la balanza analítica BA-02 por un modelo nuevo.", justification: "Fin de soporte del fabricante.", requestDecision: "ACCEPTED", requestDecisionResponsible: "Responsable de Garantía de Calidad", requestDecisionRole: "Garantía de Calidad", requestDecisionDate: day(-48), evaluation: "Requiere cualificación del nuevo equipo y actualización del PNT de uso.", classification: "MINOR", plannedImplementationDate: day(20), committeeRequired: false, clientNotificationRequired: false, authorityRequired: false, pqrRequired: "NO", stabilityRequired: "NA", additionalAnalysisRequired: "NO", additionalValidationRequired: "YES", additionalValidationDetails: "Cualificación IQ/OQ de la balanza nueva.", dictamenResult: "APPROVED", dictamenDate: day(-45), followupResponsible: "Responsable de departamento", followupResponsibleUserId: MANAGER, dictamenObservations: "Aprobado. Mantener la BA-02 hasta cerrar la cualificación.", approvalNames: "Garantía de Calidad / Dirección Técnica" });
    const t1 = await prisma.changeControlTask.create({ data: { changeControlId: c.id, ...dep("GC-00"), description: "Cualificación IQ/OQ de la balanza nueva.", responsible: "Responsable de departamento", responsibleUserId: MANAGER, plannedDate: day(-3), origin: "DICTAMEN", sortOrder: 10 } });
    const t2 = await prisma.changeControlTask.create({ data: { changeControlId: c.id, ...dep("GC-00"), description: "Actualizar el PNT de uso de balanzas analíticas.", responsible: "Responsable de Garantía de Calidad", responsibleUserId: QA, plannedDate: day(14), origin: "DICTAMEN", sortOrder: 20 } });
    const f = await prisma.changeControlFollowup.create({ data: { changeControlId: c.id, sequenceNumber: 0, followupDate: day(-20), responsible: "Responsable de departamento", responsibleUserId: MANAGER, observations: "Equipo recibido e instalado; cualificación en curso.", executionStatus: "NOT_EXECUTED", effectivenessStatus: "PENDING", closeChange: false, nextFollowupDate: day(7), remainOpenReason: "Pendiente de cualificación y del PNT.", conclusion: "El cambio continúa abierto." } });
    await prisma.changeControlTaskState.createMany({ data: [{ followupId: f.id, taskId: t1.id, status: "PENDING", evidenceComment: "IQ completada; OQ en curso." }, { followupId: f.id, taskId: t2.id, status: "PENDING" }] });
  }
  for (const [key, opened, closed, dept, description] of [["cerrado", -160, -60, "PM-10", "Nuevo formato de lista de comprobación de despeje de línea."], ["cerrado2025", -380, -300, "DT-00", "Actualización del organigrama y de las delegaciones de firma."]] as const) {
    const c = await cc(key, day(opened), dept, false, { finalStatus: "CLOSED", requesterName: "Garantía de Calidad", scope: ["DOCUMENTATION"], description, justification: "Mejora documental.", requestDecision: "ACCEPTED", requestDecisionResponsible: "Responsable de Garantía de Calidad", requestDecisionRole: "Garantía de Calidad", requestDecisionDate: day(opened + 2), evaluation: "Cambio documental sin impacto en producto.", classification: "MINOR", plannedImplementationDate: day(opened + 40), pqrRequired: "NO", stabilityRequired: "NA", additionalAnalysisRequired: "NO", additionalValidationRequired: "NO", dictamenResult: "APPROVED", dictamenDate: day(opened + 5), followupResponsible: "Garantía de Calidad", approvalNames: "Garantía de Calidad / Dirección Técnica", executionStatus: "EXECUTED", executionDate: day(closed - 20), operationalClosedAt: day(closed - 20), effectivenessStatus: "ACCEPTABLE", effectiveClosedAt: day(closed), closureConclusion: "Cambio implantado y eficaz." });
    const t = await prisma.changeControlTask.create({ data: { changeControlId: c.id, ...dep(dept), description: "Aprobar y distribuir el documento revisado.", responsible: "Garantía de Calidad", plannedDate: day(opened + 30), origin: "DICTAMEN", sortOrder: 10 } });
    const f0 = await prisma.changeControlFollowup.create({ data: { changeControlId: c.id, sequenceNumber: 0, followupDate: day(closed - 20), responsible: "Garantía de Calidad", executionStatus: "EXECUTED", effectivenessStatus: "PENDING", closeChange: false, nextFollowupDate: day(closed), conclusion: "Ejecutado; se verifica la eficacia en el siguiente seguimiento." } });
    await prisma.changeControlTaskState.create({ data: { followupId: f0.id, taskId: t.id, status: "COMPLETED", evidenceComment: "Documento distribuido." } });
    await prisma.changeControlFollowup.create({ data: { changeControlId: c.id, sequenceNumber: 1, followupDate: day(closed), responsible: "Garantía de Calidad", executionStatus: "EXECUTED", effectivenessStatus: "ACCEPTABLE", effectivenessObservations: "Sin incidencias en el uso del documento.", closeChange: true, conclusion: "Se cierra el cambio." } });
  }
  return out;
}

// ───────────────────────────── Reclamaciones y devoluciones ─────────────────────────────
async function complaintsAndReturns() {
  const out: Record<string, { id: string; code: string | null }> = {};
  const complaint = async (key: string, opened: Date, type: "CUSTOMER" | "PROVIDER", draft: boolean, data: Omit<Prisma.ComplaintUncheckedCreateInput, "qmsRecordId" | "complaintType">) => {
    const code = draft ? null : await nextCode("COMPLAINT", type === "CUSTOMER" ? "R/C/" : "R/P/", yearOf(opened), 3);
    const r = await record("COMPLAINT", opened, code);
    const c = await prisma.complaint.create({ data: { qmsRecordId: r.id, complaintType: type, ...dep("GC-00"), openedAt: opened, receptionDate: opened, detectionDate: opened, createdByText: ACTOR, internalObservations: MARK, ...data } });
    out[key] = { id: r.id, code };
    return c;
  };
  const returnRecord = async (key: string, opened: Date, draft: boolean, data: Omit<Prisma.ReturnRecordUncheckedCreateInput, "qmsRecordId">, product: { name: string; lot: string; quantity: string; type?: "MEDICINE" | "SUPPLEMENT" | "API" }) => {
    const code = draft ? null : await nextCode("RETURN", "DEV/LG-30/", yearOf(opened), 3);
    const r = await record("RETURN", opened, code);
    const ret = await prisma.returnRecord.create({ data: { qmsRecordId: r.id, ...dep("LG-30"), communicationDate: opened, createdByText: ACTOR, country: "España", internalObservations: MARK, ...data } });
    await prisma.returnProduct.create({ data: { returnRecordId: ret.id, departmentId: departments["LG-30"].id, productType: product.type ?? "MEDICINE", productNameCode: product.name, lot: product.lot, quantity: product.quantity, unit: "cajas", sortOrder: 10 } });
    out[key] = { id: r.id, code };
    return ret;
  };

  await complaint("borrador", day(-1), "CUSTOMER", true, { status: "DRAFT", partyName: "Farmacia Ejemplo (ficticia)", description: "Borrador: el cliente indica que falta el prospecto en una caja." });
  {
    const opened = day(-6);
    const c = await complaint("rotos", opened, "CUSTOMER", false, { status: "OPEN", sourceTypes: ["CUSTOMER"], scopeTypes: ["MEDICINE"], affectedObjectTypes: ["PRODUCT_MATERIAL"], categoryTypes: ["PACKAGING"], partyName: "Distribuidora Ficticia del Norte", contact: "Atención al cliente · contacto@example.invalid", reference: "Ibuprofeno 400 mg comprimidos (ficticio)", lotReference: "L26-0150", quantity: "12 cajas", description: "Blísteres con comprimidos rotos en 12 cajas de un mismo pedido.", recurrent: false, investigation: "En curso: se solicitan las cajas y se revisa el registro de lote.", partIIRequired: true, hasDerivedActions: true, nextFollowupDate: day(4), dataQualityStatus: "INCOMPLETE" });
    await prisma.complaintDerivedAction.create({ data: { complaintId: c.id, actionType: "RETURN", description: "Recoger las 12 cajas para su análisis.", responsible: "Responsable de Garantía de Calidad", responsibleUserId: QA, plannedExecutionDate: day(5), sortOrder: 10 } });
    await prisma.complaintFollowup.create({ data: { complaintId: c.id, followupDate: day(-4), completedByText: ACTOR, comment: "Cliente informado; recogida programada.", nextFollowupDate: day(4) } });
  }
  {
    const c = await complaint("procedente", day(-50), "CUSTOMER", false, { status: "OPEN", sourceTypes: ["CUSTOMER"], scopeTypes: ["MEDICINE"], affectedObjectTypes: ["PRODUCT_MATERIAL"], categoryTypes: ["PACKAGING"], partyName: "Hospital Ficticio San Ejemplo", reference: "Paracetamol 1 g comprimidos (ficticio)", lotReference: "L26-0090", quantity: "3 estuches", description: "Estuches con blísteres rotos recibidos en el servicio de farmacia.", investigation: "Se reproduce el defecto en la estuchadora tras el cambio de formato.", impactQualityGmp: "YES", impactSafetyEfficacy: "NO", impactRegulatory: "NO", impactEnvironment: "NO", impactOtherSimilar: "YES", investigationResult: "PROCEDENT", rootCause: "Ajuste del empujador de la estuchadora fuera de rango.", classification: "MINOR", potentialRecall: "NO", authorityNotificationRequired: "NO", responsiblePartyCommunicationRequired: "YES", resolutionActions: ["REPLACEMENT", "CORRECTIVE_ACTION"], partIIRequired: true, hasDerivedActions: false, nextFollowupDate: day(20), communicationDate: day(-40), communicationMedium: "Correo electrónico", communicationSummary: "Se comunica la investigación y la reposición de los estuches.", dataQualityStatus: "COMPLETE" });
    await prisma.complaintFollowup.create({ data: { complaintId: c.id, followupDate: day(-40), completedByText: ACTOR, comment: "Reposición enviada; CAPA abierta.", nextFollowupDate: day(20) } });
  }
  {
    const c = await complaint("proveedor", day(-18), "PROVIDER", false, { status: "OPEN", sourceTypes: ["INTERNAL"], scopeTypes: ["API"], affectedObjectTypes: ["DOCUMENTATION"], categoryTypes: ["DOCUMENTATION"], partyName: "Proveedor Ficticio de Principios Activos S.A.", reference: "Ibuprofeno API (ficticio)", lotReference: "PROV-23-118", description: "El certificado de análisis recibido indica un lote distinto al del bulto.", investigation: "Pendiente de la respuesta del proveedor.", partIIRequired: true, nextFollowupDate: day(-1), dataQualityStatus: "INCOMPLETE" });
    await prisma.complaintCapaPlan.create({ data: { complaintId: c.id, actionType: "PREVENTIVE", description: "Añadir la comprobación del lote del certificado en la recepción de API.", plannedExecutionDate: day(12), responsible: "Responsable de departamento", responsibleUserId: MANAGER, proposalStatus: "PROPOSED" } });
  }
  await complaint("noprocedente", day(-120), "CUSTOMER", false, { status: "CLOSED", closedAt: day(-95), sourceTypes: ["CUSTOMER"], scopeTypes: ["MEDICINE"], categoryTypes: ["ORGANOLEPTIC"], partyName: "Farmacia Ficticia Centro", reference: "Omeprazol 20 mg cápsulas (ficticio)", lotReference: "L25-1201", description: "El paciente percibe un olor distinto en las cápsulas.", investigation: "Muestra de retención y muestras del cliente conformes; olor propio del excipiente.", investigationResult: "NOT_PROCEDENT", classification: "NO_GMP_IMPACT", partIIRequired: false, effectivenessStatus: "NOT_REQUIRED", responseDate: day(-100), responseSummary: "Se explica al cliente que el producto cumple especificaciones.", responseSufficient: true, closeConclusion: "Reclamación no procedente. Cierre con respuesta al cliente.", closeActionStatus: "COMPLETED", dataQualityStatus: "COMPLETE" });
  await complaint("cerrada2025", day(-320), "CUSTOMER", false, { status: "CLOSED", closedAt: day(-230), sourceTypes: ["CUSTOMER"], scopeTypes: ["SUPPLEMENT"], categoryTypes: ["LABELLING"], partyName: "Parafarmacia Ficticia Sur", reference: "Vitamina D complemento (ficticio)", lotReference: "L25-0520", description: "Error tipográfico en la dosis del etiquetado.", investigationResult: "PROCEDENT", classification: "MINOR", rootCause: "Arte final aprobado con una errata.", resolutionActions: ["REPLACEMENT", "CORRECTIVE_ACTION"], partIIRequired: true, effectivenessRequired: true, effectivenessStatus: "ACCEPTABLE", effectivenessAssessment: "No se han repetido reclamaciones de etiquetado.", responseDate: day(-300), responseSummary: "Se repone el producto con etiquetado corregido.", responseSufficient: true, closeConclusion: "Reclamación procedente resuelta y eficaz.", closeActionStatus: "COMPLETED", dataQualityStatus: "COMPLETE" });

  // Devoluciones
  await returnRecord("borrador", day(-2), true, { status: "DRAFT", returnType: "COMMERCIAL", customerEntity: "Farmacia Ejemplo (ficticia)", reasonObservations: "Borrador: pedido duplicado." }, { name: "Paracetamol 1 g comprimidos (ficticio)", lot: "L26-0310", quantity: "4" });
  await returnRecord("reclamacion", day(-3), false, { status: "OPEN", returnType: "COMPLAINT", customerEntity: "Distribuidora Ficticia del Norte", relatedDocument: out.rotos.code, receivedAt: day(-1), reasonObservations: "Cajas de la reclamación por blísteres rotos.", withinAcceptedReturnPeriod: "YES", packagingIntegrityOk: "YES", decision: "PENDING" }, { name: "Ibuprofeno 400 mg comprimidos (ficticio)", lot: "L26-0150", quantity: "12" });
  await returnRecord("evaluacion", day(-9), false, { status: "OPEN", returnType: "EXPIRY", customerEntity: "Farmacia Ficticia Centro", receivedAt: day(-6), reasonObservations: "Producto próximo a caducar devuelto por el cliente.", withinAcceptedReturnPeriod: "YES", roomTemperatureWithinTenDays: "YES", coldChainWithinFortyEightHours: "NA", packagingIntegrityOk: "YES", qcAssessmentCompleted: "NO", decision: "PENDING" }, { name: "Vitamina D complemento (ficticio)", lot: "L25-0911", quantity: "20", type: "SUPPLEMENT" });
  await returnRecord("aceptada", day(-70), false, { status: "CLOSED", closedAt: day(-60), returnType: "COMMERCIAL", customerEntity: "Hospital Ficticio San Ejemplo", receivedAt: day(-68), reasonObservations: "Exceso de pedido.", withinAcceptedReturnPeriod: "YES", roomTemperatureWithinTenDays: "YES", coldChainWithinFortyEightHours: "NA", uniqueIdentifierActive: "YES", tamperEvidenceIntact: "YES", packagingIntegrityOk: "YES", storageTransportConditionsOk: "YES", noUseDamageContamination: "YES", noRecallAlertBlock: "YES", expiryAcceptable: "YES", qcAssessmentCompleted: "YES", decision: "ACCEPTED", finalDestination: "Reintegro a stock vendible", decisionDate: day(-62), qaApprovalName: "Responsable de Garantía de Calidad", technicalApprovalName: "Dirección Técnica", traceabilityUpdated: "YES" }, { name: "Paracetamol 1 g comprimidos (ficticio)", lot: "L26-0011", quantity: "30" });
  await returnRecord("rechazada", day(-140), false, { status: "CLOSED", closedAt: day(-120), returnType: "TRANSPORT", customerEntity: "Distribuidora Ficticia del Norte", receivedAt: day(-138), reasonObservations: "Producto termolábil con rotura de cadena de frío durante el transporte.", coldChainWithinFortyEightHours: "NO", receiptTemperatureAcceptable: "NO", temperatureExcursionEvaluated: "YES", decision: "REJECTED", finalDestination: "Destrucción", destructionManagedBy: "Gestor de residuos autorizado (ficticio)", destructionCertificate: "CD-2026-0045 (ficticio)", decisionDate: day(-130), qaApprovalName: "Responsable de Garantía de Calidad", technicalApprovalName: "Dirección Técnica", traceabilityUpdated: "YES" }, { name: "Insulina ficticia 100 UI/ml", lot: "L26-0007", quantity: "6" });
  await returnRecord("cerrada2025", day(-280), false, { status: "CLOSED", closedAt: day(-265), returnType: "RECALL", customerEntity: "Farmacia Ficticia Sur", receivedAt: day(-275), reasonObservations: "Retirada voluntaria por error de etiquetado.", decision: "REJECTED", finalDestination: "Destrucción", destructionManagedBy: "Gestor de residuos autorizado (ficticio)", destructionCertificate: "CD-2025-0112 (ficticio)", decisionDate: day(-268), qaApprovalName: "Responsable de Garantía de Calidad", technicalApprovalName: "Dirección Técnica", traceabilityUpdated: "YES" }, { name: "Vitamina D complemento (ficticio)", lot: "L25-0520", quantity: "48", type: "SUPPLEMENT" });
  return out;
}

// ───────────────────────────── Auditorías ─────────────────────────────
async function audits() {
  const out: Record<string, { id: string; code: string | null }> = {};
  const audit = async (o: { key: string; opened: Date; type: "INTERNAL" | "EXTERNAL"; scenario: "INTERNAL_COVEX" | "SUPPLIER" | "CLIENT"; entityCode?: string; draft?: boolean; audited: string[]; data: Omit<Prisma.AuditUncheckedCreateInput, "qmsRecordId">; findings?: { reference: string; findingType: "FINDING" | "RECOMMENDATION"; criticality: "CRITICAL" | "MAJOR" | "MINOR" | "NA"; description: string; treatmentStatus?: "OPEN" | "IN_PROGRESS" | "PENDING_VERIFICATION" | "CLOSED"; closedAt?: Date; actions?: Omit<Prisma.AuditFindingActionUncheckedCreateInput, "findingId" | "createdByText">[] }[] }) => {
    const code = o.draft || o.scenario === "CLIENT" ? null
      : o.type === "INTERNAL" ? await nextCode("AUDIT", "AI/GC-00/", yearOf(o.opened), 2)
      : await nextCode("AUDIT", `AE/${o.entityCode}/`, yearOf(o.opened), 2);
    const r = await record("AUDIT", o.opened, code);
    const a = await prisma.audit.create({ data: { qmsRecordId: r.id, auditType: o.type, scenario: o.scenario, entityCode: o.entityCode, codingDepartmentId: departments["GC-00"].id, codingDepartmentCodeSnapshot: "GC-00", codingDepartmentNameSnapshot: departments["GC-00"].name, openedAt: o.opened, createdByText: ACTOR, internalObservations: MARK, ...o.data } });
    for (const code of o.audited) { const d = departments[code]; await prisma.auditDepartment.create({ data: { auditId: a.id, departmentId: d.id, departmentCodeSnapshot: d.code, departmentNameSnapshot: d.name } }); }
    await prisma.auditParticipant.createMany({ data: [{ auditId: a.id, displayName: "Auditora jefe (ficticia)", position: "Garantía de Calidad", role: "LEAD_AUDITOR", sortOrder: 0 }, { auditId: a.id, displayName: "Auditor (ficticio)", position: "Dirección Técnica", role: "AUDITOR", sortOrder: 10 }, { auditId: a.id, displayName: "Responsable del área auditada (ficticio)", role: "AUDITEE", sortOrder: 20 }] });
    for (const [i, f] of (o.findings ?? []).entries()) {
      const finding = await prisma.auditFinding.create({ data: { auditId: a.id, reference: f.reference, findingType: f.findingType, criticality: f.criticality, description: f.description, treatmentStatus: f.treatmentStatus ?? "OPEN", closedAt: f.closedAt, sortOrder: i * 10, createdByText: ACTOR } });
      for (const [j, action] of (f.actions ?? []).entries()) await prisma.auditFindingAction.create({ data: { findingId: finding.id, createdByText: ACTOR, sortOrder: j * 10, ...action } });
    }
    out[o.key] = { id: r.id, code };
    return a;
  };
  await audit({ key: "interna", opened: day(-30), type: "INTERNAL", scenario: "INTERNAL_COVEX", audited: ["PM-10"], data: { status: "OPEN", title: "Auditoría interna de fabricación de formas sólidas", scope: "Compresión, recubrimiento y mantenimiento de equipos de proceso.", modality: "ONSITE", plannedDate: day(-30), performedDate: day(-28), reportDate: day(-20), dataQualityStatus: "COMPLETE" }, findings: [
    { reference: "OBS 01", findingType: "FINDING", criticality: "MAJOR", description: "El plan de mantenimiento preventivo no incluye las balanzas de proceso.", treatmentStatus: "IN_PROGRESS", actions: [{ description: "Incluir las balanzas en el plan de mantenimiento preventivo.", responsible: "Responsable de Garantía de Calidad", responsibleUserId: QA, targetDate: day(-2), status: "IN_PROGRESS" }] },
    { reference: "OBS 02", findingType: "FINDING", criticality: "MINOR", description: "Dos registros de limpieza de equipos sin hora de finalización.", actions: [{ description: "Recordar al personal la cumplimentación completa de los registros.", responsible: "Responsable de departamento", responsibleUserId: MANAGER, targetDate: day(20), status: "OPEN" }] },
    { reference: "Rk 01", findingType: "RECOMMENDATION", criticality: "NA", description: "Valorar la digitalización de los registros de limpieza." },
  ] });
  await audit({ key: "planificada", opened: day(-5), type: "INTERNAL", scenario: "INTERNAL_COVEX", draft: true, audited: ["LG-30"], data: { status: "DRAFT", title: "Auditoría interna del almacén farma", scope: "Recepción, almacenamiento en frío y expediciones.", modality: "ONSITE", plannedDate: day(30) } });
  await audit({ key: "cerrada", opened: day(-200), type: "INTERNAL", scenario: "INTERNAL_COVEX", audited: ["GC-00"], data: { status: "CLOSED", title: "Auditoría interna del sistema documental", scope: "Control de documentos y registros.", modality: "ONSITE", plannedDate: day(-200), performedDate: day(-199), reportDate: day(-190), closedAt: day(-120), conclusion: "Sistema documental conforme; una observación menor cerrada y verificada.", closureEvidence: "Registros revisados en la verificación (ficticios).", dataQualityStatus: "COMPLETE" }, findings: [
    { reference: "OBS 01", findingType: "FINDING", criticality: "MINOR", description: "Copias controladas sin sello en un área.", treatmentStatus: "CLOSED", closedAt: day(-120), actions: [{ description: "Sellar las copias y revisar el resto de áreas.", responsible: "Garantía de Calidad", targetDate: day(-160), status: "CLOSED", closedAt: day(-150), verificationResult: "CONFORMING", verifiedAt: day(-120), verifiedBy: "Auditora jefe (ficticia)", evidence: "Lista de comprobación de copias controladas." }] },
  ] });
  await audit({ key: "proveedor", opened: day(-35), type: "EXTERNAL", scenario: "SUPPLIER", entityCode: "PROV-ESTUCHES", audited: ["GC-00"], data: { status: "OPEN", title: "Auditoría al proveedor de estuches", auditedEntityName: "Cartonajes Ficticios S.L.", auditedEntityAddress: "Polígono Ejemplo, nave 4 (ficticia)", supplierType: "Material de acondicionamiento", modality: "ONSITE", ...SUPPLIER_PLAN.estuches, plannedDate: day(-35), performedDate: day(-34), reportDate: day(-25), reportSentAt: day(-24), responseRequired: true, dataQualityStatus: "COMPLETE" }, findings: [
    { reference: "OBS 01", findingType: "FINDING", criticality: "MAJOR", description: "No hay control de cambios de los artes finales de impresión.", treatmentStatus: "PENDING_VERIFICATION", actions: [{ description: "El proveedor implanta un procedimiento de control de cambios de artes finales.", responsible: "Proveedor (seguimiento: Garantía de Calidad)", responsibleUserId: QA, targetDate: day(10), status: "PENDING_VERIFICATION", evidence: "Procedimiento recibido del proveedor (ficticio)." }] },
  ] });
  await audit({ key: "proveedor2025", opened: day(-330), type: "EXTERNAL", scenario: "SUPPLIER", entityCode: "PROV-API", audited: ["GC-00"], data: { status: "CLOSED", title: "Auditoría al proveedor de principios activos", auditedEntityName: "Proveedor Ficticio de Principios Activos S.A.", supplierType: "Principio activo", modality: "REMOTE", ...SUPPLIER_PLAN.api, plannedDate: day(-330), performedDate: day(-329), reportDate: day(-320), reportSentAt: day(-319), responseRequired: false, closedAt: day(-300), conclusion: "Proveedor aprobado sin observaciones.", dataQualityStatus: "COMPLETE" } });
  await audit({ key: "cliente", opened: day(-90), type: "EXTERNAL", scenario: "CLIENT", audited: ["PM-10", "GC-00"], data: { status: "CLOSED", title: "Auditoría recibida de cliente", externalReference: "Auditoría de Laboratorios Cliente Ficticio 2026", auditingEntityName: "Laboratorios Cliente Ficticio", modality: "ONSITE", plannedDate: day(-90), performedDate: day(-89), reportDate: day(-80), closedAt: day(-50), conclusion: "Sin observaciones críticas; una recomendación aceptada.", dataQualityStatus: "COMPLETE" }, findings: [
    { reference: "Rk 01", findingType: "RECOMMENDATION", criticality: "NA", description: "Mejorar la señalización de las zonas de cuarentena.", treatmentStatus: "CLOSED", closedAt: day(-50) },
  ] });
  return out;
}

// ───────────────────────────── OOS ─────────────────────────────
async function oos() {
  const out: Record<string, { id: string; code: string | null }> = {};
  const evaluation = { analystTraining: "Conforme", methodCorrect: "Conforme", analystDialogue: "Sin incidencias", rawDataCorrect: "Revisados; adjuntos", calculationsCorrect: "Conformes", samplingCorrect: "Conforme", sampleStorageCorrect: "Conforme", equipmentOperation: "Conforme", equipmentCalibrated: "En periodo de calibración" };
  const record_ = async (o: { key: string; opened: Date; area: "API" | "MD"; draft?: boolean; data: Omit<Prisma.OosRecordUncheckedCreateInput, "qmsRecordId"> }) => {
    const code = o.draft ? null : await nextCode("OOS", `OOS/${o.area}/`, yearOf(o.opened), 3);
    const r = await record("OOS", o.opened, code);
    await prisma.oosRecord.create({ data: { qmsRecordId: r.id, area: o.area, ...dep(o.area === "API" ? "PA-20" : "GC-00"), issueDate: o.opened, oosDate: o.opened, createdByText: ACTOR, internalObservations: MARK, ...o.data } });
    out[o.key] = { id: r.id, code };
  };
  await record_({ key: "borrador", opened: day(-1), area: "MD", draft: true, data: { status: "DRAFT", materialKind: "FINISHED_PRODUCT", materialName: "Paracetamol 1 g comprimidos (ficticio)", lotNumber: "L26-0420", detectionDescription: "Borrador: disolución al 78 % (especificación ≥ 80 %)." } });
  await record_({ key: "faseI", opened: day(-4), area: "API", data: { status: "OPEN", materialKind: "FINISHED_PRODUCT", materialName: "Ibuprofeno API (ficticio)", lotNumber: "PA26-031", process: "Cristalización", detectedBy: "Analista de laboratorio", detectionDescription: "Impureza B al 0,18 % (especificación ≤ 0,15 %).", phaseIEvaluation: { analystTraining: "Conforme", methodCorrect: "Conforme", analystDialogue: "Sin incidencias" }, phaseIInvestigation: "En curso: revisión del cromatograma y de la preparación de la muestra." } });
  await record_({ key: "errorLab", opened: day(-75), area: "MD", data: { status: "CLOSED", closedAt: day(-68), materialKind: "FINISHED_PRODUCT", materialName: "Omeprazol 20 mg cápsulas (ficticio)", lotNumber: "L26-0102", detectedBy: "Analista de laboratorio", detectionDescription: "Valoración al 91 % (especificación 95–105 %).", phaseIEvaluation: { ...evaluation, sampleQuantityCorrect: "No conforme: pesada de muestra errónea" }, phaseIInvestigation: "La pesada registrada no coincide con la del ticket de la balanza.", phaseIConclusion: "Error de laboratorio confirmado. Se invalida el resultado; el reanálisis da 99,2 %.", phaseIDisposition: "LAB_ERROR", phaseIVerdict: "APPROVED", phaseIIssuedBy: "Responsable de laboratorio", phaseIIssuedAt: day(-68), investigationResult: "INVALIDATED", rootCauseCategories: ["PEOPLE"] } });
  await record_({ key: "faseII", opened: day(-14), area: "MD", data: { status: "OPEN", materialKind: "FINISHED_PRODUCT", materialName: "Omeprazol 20 mg cápsulas (ficticio)", lotNumber: "L26-0301", detectedBy: "Analista de laboratorio", detectionDescription: "Valoración al 92 % (especificación 95–105 %).", phaseIEvaluation: evaluation, phaseIInvestigation: "No se identifica error de laboratorio.", phaseIConclusion: "Se pasa a Fase II a gran escala.", phaseIDisposition: "FULL_SCALE", phaseIIssuedBy: "Responsable de laboratorio", phaseIIssuedAt: day(-12), phaseIIIssueDate: day(-12), phaseIIProductionReview: "En curso: revisión del registro de fabricación y de la homogeneidad de la mezcla.", phaseIIAffectedDepartments: "Producción, Garantía de Calidad" } });
  await record_({ key: "confirmado", opened: day(-150), area: "API", data: { status: "CLOSED", closedAt: day(-120), materialKind: "RAW_OR_PACKAGING_MATERIAL", materialName: "Excipiente lactosa (ficticio)", lotNumber: "EX25-778", supplier: "Proveedor Ficticio de Excipientes", supplierLot: "LAC-9921", detectedBy: "Analista de laboratorio", detectionDescription: "Humedad al 6,1 % (especificación ≤ 5,0 %).", phaseIEvaluation: evaluation, phaseIConclusion: "Sin error de laboratorio; Fase II.", phaseIDisposition: "FULL_SCALE", phaseIIssuedBy: "Responsable de laboratorio", phaseIIssuedAt: day(-147), phaseIIIssueDate: day(-147), phaseIIRetesting: "Reanálisis por segundo analista: 6,0 %.", phaseIIResampling: "Nuevo muestreo de tres bultos: 5,9–6,2 %.", phaseIIConclusion: "Resultado confirmado. Material no conforme por almacenamiento inadecuado en origen.", phaseIIVerdict: "REJECTED", phaseIIReturnQuantity: "500 kg", phaseIIIssuedBy: "Responsable de Garantía de Calidad", phaseIIIssuedAt: day(-120), investigationResult: "CONFIRMED", rootCauseCategories: ["MATERIAL", "ENVIRONMENT"] } });
  await record_({ key: "noConcluyente", opened: day(-260), area: "API", data: { status: "CLOSED", closedAt: day(-225), materialKind: "FINISHED_PRODUCT", materialName: "Paracetamol API (ficticio)", lotNumber: "PA25-088", detectionDescription: "Pérdida por desecación al 0,6 % (especificación ≤ 0,5 %).", phaseIEvaluation: evaluation, phaseIConclusion: "Sin error de laboratorio; Fase II.", phaseIDisposition: "FULL_SCALE", phaseIIssuedBy: "Responsable de laboratorio", phaseIIssuedAt: day(-255), phaseIIIssueDate: day(-255), phaseIIRetesting: "Resultados de reanálisis dispersos (0,45–0,58 %).", phaseIIConclusion: "No se identifica causa asignable. Lote aprobado con seguimiento de estabilidad.", phaseIIVerdict: "APPROVED", phaseIIIssuedBy: "Responsable de Garantía de Calidad", phaseIIIssuedAt: day(-225), investigationResult: "INCONCLUSIVE", rootCauseCategories: ["UNDETERMINED"] } });
  return out;
}

// ───────────────────────────── Documentación controlada (PNT) ─────────────────────────────
async function pnts() {
  type Rev = { code: string; status: "IN_FORCE" | "OBSOLETE" | "DRAFT" | "ANNULLED"; from?: number; review?: number; obsolete?: number; reason?: string };
  const pnt = async (baseCode: string, dept: string, title: string, revisions: Rev[], o: { annulled?: string; type?: "PNT" | "TECHNICAL_INSTRUCTION" } = {}) => {
    if (await prisma.controlledDocument.findUnique({ where: { baseCode } })) return; // Ya existe (p. ej., importado del índice).
    const d = departments[dept];
    const doc = await prisma.controlledDocument.create({ data: { baseCode, title, documentType: o.type ?? "PNT", departmentId: d.id, departmentCodeSnapshot: d.code, departmentNameSnapshot: d.name, administrativeStatus: o.annulled ? "ANNULLED" : "ACTIVE", verificationStatus: "VERIFIED", observations: MARK, createdByText: ACTOR, ...(o.annulled ? { annulledAt: day(-30), annulledByText: ACTOR, annulmentReason: o.annulled } : {}) } });
    await prisma.controlledDocumentChange.create({ data: { documentId: doc.id, action: "Alta del maestro", changedByText: ACTOR, reason: "Ejemplo de la demo", source: "SYSTEM" } });
    let previous: string | null = null;
    for (const rev of revisions) {
      const historical = rev.status !== "DRAFT";
      const r: { id: string; effectiveFrom: Date | null; reviewDueAt: Date | null; obsoletedAt: Date | null } = await prisma.controlledDocumentRevision.create({ data: { documentId: doc.id, revisionCode: rev.code, baseCodeSnapshot: baseCode, titleSnapshot: title, departmentCodeSnapshot: d.code, departmentNameSnapshot: d.name, revisionReason: rev.reason, status: rev.status, effectiveFrom: rev.from !== undefined ? day(rev.from) : null, reviewDueAt: rev.review !== undefined ? day(rev.review) : null, obsoletedAt: rev.obsolete !== undefined ? day(rev.obsolete) : null, previousRevisionId: previous, verificationStatus: historical ? "VERIFIED" : "UNVERIFIED", ...(historical ? { verifiedByText: ACTOR, verifiedAt: day(-1), consolidatedAt: day(-1) } : {}), registeredByText: ACTOR } });
      if (historical) await prisma.controlledRevisionLifecycle.create({ data: { revisionId: r.id, documentId: doc.id, legacyOrigin: true, effectiveFrom: r.effectiveFrom, reviewDueAt: r.reviewDueAt, obsoletedAt: r.obsoletedAt } });
      await prisma.controlledDocumentChange.create({ data: { documentId: doc.id, revisionId: r.id, action: historical ? "Registro de revisión histórica" : "Registro de revisión", changedByText: ACTOR, reason: "Ejemplo de la demo", source: "SYSTEM" } });
      previous = r.id;
    }
  };
  await pnt("GC-00/023", "GC-00", "Gestión de desviaciones (ejemplo)", [{ code: "05", status: "OBSOLETE", from: -900, review: -170, obsolete: -170 }, { code: "06", status: "IN_FORCE", from: -170, review: 560, reason: "Incorporación del Anexo V simplificado." }]);
  await pnt("GC-00/030", "GC-00", "Acciones correctivas y preventivas (ejemplo)", [{ code: "05", status: "IN_FORCE", from: -760, review: -30 }]);
  await pnt("GC-00/003", "GC-00", "Control de cambios (ejemplo)", [{ code: "03", status: "IN_FORCE", from: -400, review: 330 }, { code: "04", status: "DRAFT", reason: "Incluir la evaluación de riesgos en la solicitud." }]);
  await pnt("PM-10/010", "PM-10", "Limpieza de la blistadora B-2 (ejemplo)", [{ code: "02", status: "OBSOLETE", from: -700, review: -90, obsolete: -90 }, { code: "03", status: "IN_FORCE", from: -90, review: 640 }]);
  await pnt("LG-30/005", "LG-30", "Recepción de mercancía en cámara fría (ejemplo)", [{ code: "02", status: "IN_FORCE", from: -700, review: 25 }]);
  await pnt("PA-20/003", "PA-20", "Uso de la balanza analítica (ejemplo)", [{ code: "01", status: "IN_FORCE", from: -300, review: 430 }], { type: "TECHNICAL_INSTRUCTION" });
  await pnt("GC-00/015", "GC-00", "Gestión de muestras de retención (ejemplo, anulado)", [{ code: "02", status: "OBSOLETE", from: -800, review: -30, obsolete: -30 }], { annulled: "Contenido integrado en otro procedimiento." });
}

// Datos que exige el Plan de auditoría externa (entidad, fecha, introducción, alcance, duración y programa).
const SUPPLIER_PLAN = {
  estuches: {
    planIntroduction: "Auditoría de cualificación del proveedor de estuches impresos según el programa anual de auditorías externas (ejemplo ficticio).",
    scope: "Control de artes finales, impresión, inspección de calidad y liberación de estuches.",
    activityDuration: "1 día (09:00–17:00)",
    programme: "09:00 Reunión de apertura · 09:30 Visita a impresión y control de calidad · 12:00 Revisión documental · 15:30 Preparación de conclusiones · 16:30 Reunión de cierre.",
  },
  api: {
    planIntroduction: "Auditoría remota de seguimiento del proveedor de principios activos (ejemplo ficticio).",
    scope: "Sistema de calidad, control de cambios, gestión de desviaciones y certificados de análisis.",
    activityDuration: "4 horas en remoto",
    programme: "Revisión documental previa · Sesión remota de entrevistas · Cierre y conclusiones.",
  },
};

// Las demos cargadas antes de añadir esos datos no podían generar el Plan externo: se completan sin pisar nada.
async function supplierAuditPlans() {
  for (const [entityCode, plan] of [["PROV-ESTUCHES", SUPPLIER_PLAN.estuches], ["PROV-API", SUPPLIER_PLAN.api]] as const) {
    await prisma.audit.updateMany({ where: { entityCode, internalObservations: MARK, planIntroduction: null, programme: null }, data: plan });
  }
}

// La aplicación guarda una versión del control de cambios por seguimiento (00, 01…) y el Anexo V
// de cada seguimiento se genera desde ella. Los ejemplos se crean directamente en la base, así que
// las versiones se añaden aquí. También repara las demos cargadas antes de existir este paso.
async function changeFollowupVersions() {
  const changes = await prisma.changeControl.findMany({
    where: { followups: { some: {} }, qmsRecord: { versions: { none: {} } } },
    include: {
      qmsRecord: true,
      tasks: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      followups: { orderBy: [{ sequenceNumber: "asc" }, { followupDate: "asc" }], include: { taskStates: { orderBy: { createdAt: "asc" } } } },
      formVersion: true,
      annexIIITemplateVersion: true,
      annexIVTemplateVersion: true,
      annexVTemplateVersion: true,
    },
  });
  for (const change of changes) {
    const last = change.followups.at(-1)!.sequenceNumber;
    for (const followup of change.followups) {
      const snapshot = serializeChangeControlVersion({ ...change, followups: change.followups.filter((item) => item.sequenceNumber <= followup.sequenceNumber) });
      await prisma.qmsRecordVersion.create({
        data: {
          qmsRecordId: change.qmsRecordId,
          sequenceNumber: followup.sequenceNumber,
          kind: "FOLLOWUP",
          snapshot: snapshotJson(snapshot),
          reason: `Seguimiento ${String(followup.sequenceNumber).padStart(2, "0")} · ejemplo de la demo`,
          sourceEntityId: followup.id,
          createdByText: ACTOR,
          source: "SYSTEM",
          frozenAt: followup.sequenceNumber < last ? followup.followupDate : null,
        },
      });
    }
  }
  if (changes.length) console.log(`Versiones de seguimiento añadidas en ${changes.length} controles de cambios de la demo.`);
}

async function main() {
  if (!localDemoEnvironment() || process.env.ALLOW_DEMO_DATA !== "true") throw new Error("Solo para la demo (APP_ENV=demo, base covex_demo, ALLOW_DEMO_DATA=true).");
  if (await prisma.deviation.findFirst({ where: { internalObservations: MARK }, select: { id: true } })) {
    console.log("Los ejemplos de la demo ya están cargados.");
    await changeFollowupVersions();
    await supplierAuditPlans();
    return;
  }
  departments = Object.fromEntries((await prisma.department.findMany({ select: { id: true, code: true, name: true } })).map((d) => [d.code, d]));
  if (!(await prisma.authUser.findUnique({ where: { id: QA } }))) throw new Error("Faltan los usuarios de la demo: ejecuta pnpm demo:users antes.");

  const dev = await deviations();
  const capa = await capas();
  await changes();
  const rec = await complaintsAndReturns();
  const aud = await audits();
  const o = await oos();
  await pnts();

  // CAPA creadas desde su origen (registradas en el plan de la desviación o la reclamación).
  const devLimpieza = await prisma.deviation.findUniqueOrThrow({ where: { qmsRecordId: dev.limpieza.id } });
  await prisma.deviationCapaPlan.create({ data: { deviationId: devLimpieza.id, actionType: "CORRECTIVE", description: "CAPA de revisión del formato de limpieza.", responsible: "Responsable de departamento", businessCapaCode: capa.limpieza.code, linkedCapaRecordId: capa.limpieza.id, proposalStatus: "REGISTERED" } });
  const devPeso = await prisma.deviation.findUniqueOrThrow({ where: { qmsRecordId: dev.peso.id } });
  await prisma.deviationCapaPlan.create({ data: { deviationId: devPeso.id, actionType: "CORRECTIVE", description: "Cambiar el criterio de sustitución de punzones.", responsible: "Mantenimiento", businessCapaCode: capa.punzones.code, linkedCapaRecordId: capa.punzones.id, proposalStatus: "REGISTERED" } });
  const recProcedente = await prisma.complaint.findUniqueOrThrow({ where: { qmsRecordId: rec.procedente.id } });
  await prisma.complaintCapaPlan.create({ data: { complaintId: recProcedente.id, actionType: "CORRECTIVE", description: "Corregir el ajuste del empujador y reforzar la inspección.", responsible: "Responsable de Garantía de Calidad", businessCapaCode: capa.estuches.code, linkedCapaRecordId: capa.estuches.id, proposalStatus: "REGISTERED" } });
  for (const [qms, originCode] of [[capa.limpieza.id, dev.limpieza.code], [capa.punzones.id, dev.peso.code], [capa.estuches.id, rec.procedente.code], [capa.auditoria.id, aud.interna.code]] as const) {
    await prisma.capa.update({ where: { qmsRecordId: qms }, data: { originCode } });
  }

  relate(dev.limpieza, capa.limpieza);
  relate(dev.peso, capa.punzones);
  relate(rec.procedente, capa.estuches);
  relate(rec.rotos, rec.reclamacion);
  relate(aud.interna, capa.auditoria);
  relate(o.faseII, dev.oos);
  relate(o.confirmado, capa.tendencia);
  for (const [sourceRecordId, targetRecordId] of relations) await createQmsRelation(prisma, { sourceRecordId, targetRecordId, createdByText: ACTOR, notes: "Relación de los ejemplos de la demo." });
  await changeFollowupVersions();

  const counts = await prisma.qmsRecord.groupBy({ by: ["recordType"], _count: true, where: { history: { some: { reason: "Ejemplo de la demo" } } } });
  console.log(`Ejemplos de la demo cargados: ${counts.map((c) => `${c.recordType} ${c._count}`).join(" · ")} · PNT ${await prisma.controlledDocument.count({ where: { observations: MARK } })} · relaciones ${relations.length}.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
