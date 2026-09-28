import {
  CapaActionType,
  ComplaintType,
  DataQualityStatus,
  QmsRecordType,
  ReturnType,
  PrismaClient,
} from "@prisma/client";

const prisma = new PrismaClient();

const DEMO_PREFIX = "DEMO-";

function assertDemoAllowed() {
  if (process.env.ALLOW_DEMO_DATA !== "true") {
    throw new Error(
      "Carga demo bloqueada. Define ALLOW_DEMO_DATA=true únicamente en un entorno de demostración/local.",
    );
  }
  if (process.env.APP_ENV === "production") {
    throw new Error("La carga de datos demo está prohibida cuando APP_ENV=production.");
  }
}

async function upsertRecord(recordType: QmsRecordType, businessCode: string) {
  return prisma.qmsRecord.upsert({
    where: { recordType_businessCode: { recordType, businessCode } },
    update: { isActive: true, year: 2026 },
    create: { recordType, businessCode, year: 2026, isActive: true },
  });
}

async function main() {
  assertDemoAllowed();

  const department = await prisma.department.findUnique({ where: { code: "GC-00" } });
  if (!department) {
    throw new Error("Ejecuta pnpm db:seed antes de cargar los datos de demo.");
  }

  const [devQms, capaQms, changeQms, complaintQms, returnQms] = await Promise.all([
    upsertRecord(QmsRecordType.DEVIATION, "DEMO-DES-001-2026"),
    upsertRecord(QmsRecordType.CAPA, "DEMO-CAPA-001-2026"),
    upsertRecord(QmsRecordType.CHANGE_CONTROL, "DEMO-CC-001-2026"),
    upsertRecord(QmsRecordType.COMPLAINT, "DEMO-REC-001-2026"),
    upsertRecord(QmsRecordType.RETURN, "DEMO-DEVOL-001-2026"),
  ]);

  const deviation = await prisma.deviation.upsert({
    where: { qmsRecordId: devQms.id },
    update: {
      departmentId: department.id,
      departmentCodeSnapshot: department.code,
      departmentNameSnapshot: department.name,
      issueDate: new Date("2026-09-15"),
      materialProcessAffected: "Lote demostración · acondicionamiento secundario",
      provenance: "DOCUMENTATION",
      whatHappened:
        "Caso ficticio: durante una comprobación de entrenamiento se detectó una discrepancia documental en una etiqueta simulada.",
      rootCause:
        "Caso ficticio: instrucción de entrenamiento desactualizada respecto de la versión utilizada en la simulación.",
      classification: "MINOR",
      dataQualityStatus: DataQualityStatus.COMPLETE,
      internalObservations: "DATOS FICTICIOS PARA DEMOSTRACIÓN. No corresponde a un expediente GMP real.",
    },
    create: {
      qmsRecordId: devQms.id,
      departmentId: department.id,
      departmentCodeSnapshot: department.code,
      departmentNameSnapshot: department.name,
      issueDate: new Date("2026-09-15"),
      materialProcessAffected: "Lote demostración · acondicionamiento secundario",
      provenance: "DOCUMENTATION",
      whatHappened:
        "Caso ficticio: durante una comprobación de entrenamiento se detectó una discrepancia documental en una etiqueta simulada.",
      rootCause:
        "Caso ficticio: instrucción de entrenamiento desactualizada respecto de la versión utilizada en la simulación.",
      classification: "MINOR",
      dataQualityStatus: DataQualityStatus.COMPLETE,
      internalObservations: "DATOS FICTICIOS PARA DEMOSTRACIÓN. No corresponde a un expediente GMP real.",
    },
  });

  await prisma.deviationImmediateAction.deleteMany({ where: { deviationId: deviation.id } });
  await prisma.deviationImmediateAction.create({
    data: {
      deviationId: deviation.id,
      description: "Retirar la etiqueta simulada y sustituir la instrucción de entrenamiento.",
      executedBy: "Usuario demo",
      executedAt: new Date("2026-09-15"),
    },
  });
  await prisma.deviationFollowup.deleteMany({ where: { deviationId: deviation.id } });
  await prisma.deviationFollowup.create({
    data: {
      deviationId: deviation.id,
      followupDate: new Date("2026-09-18"),
      completedByText: "Usuario demo",
      followupType: "Seguimiento de demostración",
      comment: "Acción inmediata comprobada; se mantiene seguimiento de la CAPA ficticia asociada.",
      nextFollowupDate: new Date("2026-10-15"),
      evidenceReference: "DEMO-EVID-001",
    },
  });

  const capa = await prisma.capa.upsert({
    where: { qmsRecordId: capaQms.id },
    update: {
      actionType: CapaActionType.CORRECTIVE,
      departmentId: department.id,
      departmentCodeSnapshot: department.code,
      departmentNameSnapshot: department.name,
      openedAt: new Date("2026-09-18"),
      originType: "DEVIATION",
      originCode: "DEMO-DES-001-2026",
      defectDescription: "Actualizar el material de entrenamiento usado en la simulación.",
      rootCause: "Material demo no sincronizado con la revisión de referencia.",
      dataQualityStatus: DataQualityStatus.COMPLETE,
      internalObservations: "DATOS FICTICIOS PARA DEMOSTRACIÓN.",
    },
    create: {
      qmsRecordId: capaQms.id,
      actionType: CapaActionType.CORRECTIVE,
      departmentId: department.id,
      departmentCodeSnapshot: department.code,
      departmentNameSnapshot: department.name,
      openedAt: new Date("2026-09-18"),
      originType: "DEVIATION",
      originCode: "DEMO-DES-001-2026",
      defectDescription: "Actualizar el material de entrenamiento usado en la simulación.",
      rootCause: "Material demo no sincronizado con la revisión de referencia.",
      dataQualityStatus: DataQualityStatus.COMPLETE,
      internalObservations: "DATOS FICTICIOS PARA DEMOSTRACIÓN.",
    },
  });
  await prisma.capaPlannedAction.deleteMany({ where: { capaId: capa.id } });
  await prisma.capaPlannedAction.create({
    data: {
      capaId: capa.id,
      description: "Actualizar y revisar el paquete documental ficticio de entrenamiento.",
      responsible: "Usuario demo",
      plannedExecutionDate: new Date("2026-10-10"),
      sortOrder: 10,
    },
  });
  await prisma.capaFollowup.deleteMany({ where: { capaId: capa.id } });
  await prisma.capaFollowup.create({
    data: {
      capaId: capa.id,
      sequenceNumber: 1,
      followupDate: new Date("2026-09-25"),
      completedByText: "Usuario demo",
      description: "Preparación del material demo en curso.",
      nextFollowupDate: new Date("2026-10-10"),
      evidenceReference: "DEMO-CAPA-EVID-001",
    },
  });

  const change = await prisma.changeControl.upsert({
    where: { qmsRecordId: changeQms.id },
    update: {
      departmentId: department.id,
      departmentCodeSnapshot: department.code,
      departmentNameSnapshot: department.name,
      requestDate: new Date("2026-09-20"),
      requesterName: "Usuario demo",
      description: "Caso ficticio: incorporar un nuevo campo informativo en una pantalla de entrenamiento.",
      justification: "Mejorar la demostración del flujo de Control de Cambios.",
      classification: "MINOR",
      dataQualityStatus: DataQualityStatus.COMPLETE,
      internalObservations: "DATOS FICTICIOS PARA DEMOSTRACIÓN.",
    },
    create: {
      qmsRecordId: changeQms.id,
      departmentId: department.id,
      departmentCodeSnapshot: department.code,
      departmentNameSnapshot: department.name,
      requestDate: new Date("2026-09-20"),
      requesterName: "Usuario demo",
      description: "Caso ficticio: incorporar un nuevo campo informativo en una pantalla de entrenamiento.",
      justification: "Mejorar la demostración del flujo de Control de Cambios.",
      classification: "MINOR",
      dataQualityStatus: DataQualityStatus.COMPLETE,
      internalObservations: "DATOS FICTICIOS PARA DEMOSTRACIÓN.",
    },
  });
  await prisma.changeControlTaskState.deleteMany({
    where: { task: { changeControlId: change.id } },
  });
  await prisma.changeControlFollowup.deleteMany({ where: { changeControlId: change.id } });
  await prisma.changeControlTask.deleteMany({ where: { changeControlId: change.id } });
  await prisma.changeControlTask.create({
    data: {
      changeControlId: change.id,
      departmentId: department.id,
      departmentCodeSnapshot: department.code,
      departmentNameSnapshot: department.name,
      description: "Evaluar el impacto del cambio ficticio sobre el formulario demo.",
      responsible: "Usuario demo",
      plannedDate: new Date("2026-10-20"),
      origin: "DICTAMEN",
      sortOrder: 10,
    },
  });

  const complaint = await prisma.complaint.upsert({
    where: { qmsRecordId: complaintQms.id },
    update: {
      departmentId: department.id,
      departmentCodeSnapshot: department.code,
      departmentNameSnapshot: department.name,
      openedAt: new Date("2026-09-22"),
      complaintType: ComplaintType.CUSTOMER,
      partyName: "Cliente ficticio DEMO",
      reference: "Producto demostración",
      lotReference: "DEMO-LOT-01",
      description: "Caso ficticio: consulta por presentación visual de un envase de muestra.",
      classification: "NO_GMP_IMPACT",
      dataQualityStatus: DataQualityStatus.COMPLETE,
      internalObservations: "DATOS FICTICIOS PARA DEMOSTRACIÓN.",
    },
    create: {
      qmsRecordId: complaintQms.id,
      departmentId: department.id,
      departmentCodeSnapshot: department.code,
      departmentNameSnapshot: department.name,
      openedAt: new Date("2026-09-22"),
      complaintType: ComplaintType.CUSTOMER,
      partyName: "Cliente ficticio DEMO",
      reference: "Producto demostración",
      lotReference: "DEMO-LOT-01",
      description: "Caso ficticio: consulta por presentación visual de un envase de muestra.",
      classification: "NO_GMP_IMPACT",
      dataQualityStatus: DataQualityStatus.COMPLETE,
      internalObservations: "DATOS FICTICIOS PARA DEMOSTRACIÓN.",
    },
  });
  await prisma.complaintFollowup.deleteMany({ where: { complaintId: complaint.id } });
  await prisma.complaintFollowup.create({
    data: {
      complaintId: complaint.id,
      followupDate: new Date("2026-09-24"),
      completedByText: "Usuario demo",
      comment: "Se solicita devolución de la muestra ficticia para completar la demostración.",
      nextFollowupDate: new Date("2026-10-05"),
      evidenceReference: "DEMO-REC-EVID-001",
    },
  });

  const returnRecord = await prisma.returnRecord.upsert({
    where: { qmsRecordId: returnQms.id },
    update: {
      departmentId: department.id,
      departmentCodeSnapshot: department.code,
      departmentNameSnapshot: department.name,
      communicationDate: new Date("2026-09-24"),
      receivedAt: new Date("2026-09-25"),
      returnType: ReturnType.COMPLAINT,
      customerEntity: "Cliente ficticio DEMO",
      relatedDocument: "DEMO-REC-001-2026",
      reasonObservations: "Devolución ficticia vinculada a la reclamación de demostración.",
      dataQualityStatus: DataQualityStatus.COMPLETE,
      internalObservations: "DATOS FICTICIOS PARA DEMOSTRACIÓN.",
    },
    create: {
      qmsRecordId: returnQms.id,
      departmentId: department.id,
      departmentCodeSnapshot: department.code,
      departmentNameSnapshot: department.name,
      communicationDate: new Date("2026-09-24"),
      receivedAt: new Date("2026-09-25"),
      returnType: ReturnType.COMPLAINT,
      customerEntity: "Cliente ficticio DEMO",
      relatedDocument: "DEMO-REC-001-2026",
      reasonObservations: "Devolución ficticia vinculada a la reclamación de demostración.",
      dataQualityStatus: DataQualityStatus.COMPLETE,
      internalObservations: "DATOS FICTICIOS PARA DEMOSTRACIÓN.",
    },
  });
  await prisma.returnProduct.deleteMany({ where: { returnRecordId: returnRecord.id } });
  await prisma.returnProduct.create({
    data: {
      returnRecordId: returnRecord.id,
      departmentId: department.id,
      productType: "MEDICINE",
      productNameCode: "Producto ficticio DEMO",
      format: "Caja demostración",
      lot: "DEMO-LOT-01",
      quantity: "1",
      unit: "unidad",
      sortOrder: 10,
    },
  });
  await prisma.returnFollowup.deleteMany({ where: { returnRecordId: returnRecord.id } });
  await prisma.returnFollowup.create({
    data: {
      returnRecordId: returnRecord.id,
      followupDate: new Date("2026-09-26"),
      completedByText: "Usuario demo",
      comment: "Recepción ficticia registrada; evaluación pendiente para mostrar la bandeja de trabajo.",
      nextFollowupDate: new Date("2026-10-06"),
      evidenceReference: "DEMO-DEVOL-EVID-001",
    },
  });

  await prisma.qmsRelation.upsert({
    where: {
      sourceRecordId_targetRecordId_relationType: {
        sourceRecordId: devQms.id,
        targetRecordId: capaQms.id,
        relationType: "GENERATES",
      },
    },
    update: { isActive: true, notes: "Relación ficticia de demostración." },
    create: {
      sourceRecordId: devQms.id,
      targetRecordId: capaQms.id,
      relationType: "GENERATES",
      createdByText: "Usuario demo",
      notes: "Relación ficticia de demostración.",
    },
  });
  await prisma.qmsRelation.upsert({
    where: {
      sourceRecordId_targetRecordId_relationType: {
        sourceRecordId: complaintQms.id,
        targetRecordId: returnQms.id,
        relationType: "GENERATES",
      },
    },
    update: { isActive: true, notes: "Relación ficticia de demostración." },
    create: {
      sourceRecordId: complaintQms.id,
      targetRecordId: returnQms.id,
      relationType: "GENERATES",
      createdByText: "Usuario demo",
      notes: "Relación ficticia de demostración.",
    },
  });

  const records = await prisma.qmsRecord.findMany({
    where: { businessCode: { startsWith: DEMO_PREFIX } },
    select: { recordType: true, businessCode: true },
    orderBy: { recordType: "asc" },
  });

  console.log(`Dataset demo preparado: ${records.length} expedientes ficticios.`);
  for (const record of records) {
    console.log(`- ${record.recordType}: ${record.businessCode}`);
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
