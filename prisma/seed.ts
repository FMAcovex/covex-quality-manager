import { DocumentType, PrismaClient, QmsRecordType } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  for (const department of [
    { code: "GC-00", name: "Garantía de Calidad" },
    { code: "PM-10", name: "Área de Producción de Medicamentos" },
    { code: "PA-20", name: "Área de Fabricación Química" },
  ]) {
    await prisma.department.upsert({
      where: { code: department.code },
      update: { name: department.name, isActive: true },
      create: department,
    });
  }

  const deviationForm = await prisma.formVersion.upsert({
    where: {
      module_versionCode: {
        module: QmsRecordType.DEVIATION,
        versionCode: "DEV-06",
      },
    },
    update: { isActive: true, status: "ACTIVE" },
    create: {
      module: QmsRecordType.DEVIATION,
      versionCode: "DEV-06",
      effectiveFrom: new Date("2026-01-01"),
      isActive: true,
      status: "ACTIVE",
      notes: "Referencia de desarrollo; confirmar fecha controlada antes de producción.",
    },
  });

  const deviationFieldConfigs = [
    ["businessCode","Código","identification","Identificación",10,"STRUCTURAL","TEXT",true,true,true,true,true,true,false],
    ["department","Departamento","identification","Identificación",20,"STRUCTURAL","REFERENCE",true,true,true,true,true,true,false],
    ["materialProcessAffected","Material / proceso afectado","identification","Identificación",30,"VERSIONED","TEXT",true,true,true,true,true,true,true],
    ["provenance","Procedencia","identification","Identificación",40,"VERSIONED","SELECT",true,true,true,true,true,true,true],
    ["whatHappened","Descripción","event","Evento",50,"VERSIONED","LONG_TEXT",true,true,true,false,true,true,true],
    ["classification","Clasificación","assessment","Evaluación",60,"STRUCTURAL","SELECT",true,true,true,true,true,true,false],
    ["rootCause","Causa raíz","investigation","Investigación",70,"VERSIONED","LONG_TEXT",true,true,true,false,true,true,true],
    ["issueDate","Fecha apertura","identification","Identificación",80,"STRUCTURAL","DATE",true,true,true,true,true,true,false],
    ["closedAt","Fecha cierre","closure","Cierre",90,"STRUCTURAL","DATE",false,true,true,true,true,true,false],
    ["status","Estado","management","Gestión",100,"DERIVED","SELECT",true,true,true,true,true,false,false],
    ["measures","Medidas adoptadas","actions","Acciones",110,"DERIVED","SELECT",false,true,true,true,true,false,false],
    ["capaCode","Código CAPA","relations","Relaciones",120,"DERIVED","REFERENCE",false,true,true,true,true,false,false],
    ["internalObservations","Observaciones","management","Gestión",130,"OPERATIONAL","LONG_TEXT",false,true,true,false,true,false,false],
  ] as const;

  for (const [
    fieldKey,label,sectionKey,sectionLabel,sortOrder,kind,valueType,required,
    listAvailable,listVisibleByDefault,filterable,simpleExport,officialAnnexField,editableDefinition,
  ] of deviationFieldConfigs) {
    await prisma.formFieldConfig.upsert({
      where: { formVersionId_fieldKey: { formVersionId: deviationForm.id, fieldKey } },
      update: {
        label, sectionKey, sectionLabel, sortOrder, kind, valueType, required,
        listAvailable, listVisibleByDefault, filterable, simpleExport,
        officialAnnexField, editableDefinition,
      },
      create: {
        formVersionId: deviationForm.id, fieldKey, label, sectionKey, sectionLabel,
        sortOrder, kind, valueType, required, listAvailable, listVisibleByDefault,
        filterable, simpleExport, officialAnnexField, editableDefinition,
      },
    });
  }

  await prisma.templateVersion.upsert({
    where: {
      module_documentType_versionCode: {
        module: QmsRecordType.DEVIATION,
        documentType: DocumentType.DEVIATION_ANNEX_III,
        versionCode: "06",
      },
    },
    update: { isActive: true },
    create: {
      module: QmsRecordType.DEVIATION,
      documentType: DocumentType.DEVIATION_ANNEX_III,
      versionCode: "06",
      effectiveFrom: new Date("2026-01-01"),
      isActive: true,
    },
  });

  await prisma.templateVersion.upsert({
    where: {
      module_documentType_versionCode: {
        module: QmsRecordType.DEVIATION,
        documentType: DocumentType.DEVIATION_ANNEX_V,
        versionCode: "06",
      },
    },
    update: { isActive: true },
    create: {
      module: QmsRecordType.DEVIATION,
      documentType: DocumentType.DEVIATION_ANNEX_V,
      versionCode: "06",
      effectiveFrom: new Date("2026-01-01"),
      isActive: true,
    },
  });
  const capaForm = await prisma.formVersion.upsert({
    where: {
      module_versionCode: {
        module: QmsRecordType.CAPA,
        versionCode: "CAPA-05",
      },
    },
    update: { isActive: true, status: "ACTIVE" },
    create: {
      module: QmsRecordType.CAPA,
      versionCode: "CAPA-05",
      effectiveFrom: new Date("2026-02-02"),
      isActive: true,
      status: "ACTIVE",
      notes: "GC-00/030/05.",
    },
  });

  const capaFieldConfigs = [
    ["actionType","Tipo CAPA","identification","Identificación",10,"STRUCTURAL","SELECT",true,true,true,true,true,true,false],
    ["businessCode","Código","identification","Identificación",20,"STRUCTURAL","TEXT",true,true,true,true,true,true,false],
    ["department","Departamento","identification","Identificación",30,"STRUCTURAL","REFERENCE",true,true,true,true,true,true,false],
    ["originType","Origen","identification","Identificación",40,"VERSIONED","SELECT",true,true,true,true,true,true,true],
    ["originCode","Código de origen","identification","Identificación",50,"VERSIONED","TEXT",false,true,true,true,true,true,true],
    ["plannedActions","Descripción CAPA","actions","Acción propuesta",60,"VERSIONED","LONG_TEXT",true,true,true,false,true,true,true],
    ["openedAt","Fecha apertura","identification","Identificación",70,"STRUCTURAL","DATE",true,true,true,true,true,true,false],
    ["plannedExecutionDate","Fecha prevista","actions","Acción propuesta",80,"VERSIONED","DATE",false,true,true,true,true,true,true],
    ["status","Estado","management","Gestión",90,"STRUCTURAL","SELECT",true,true,true,true,true,false,false],
    ["operationalClosedAt","Cierre operativo","closure","Cierre",100,"STRUCTURAL","DATE",false,true,true,true,true,true,false],
    ["effectivenessStatus","Eficacia","effectiveness","Eficacia",110,"STRUCTURAL","SELECT",true,true,true,true,true,true,false],
    ["latestFollowup","Último seguimiento","followup","Seguimiento",120,"DERIVED","TEXT",false,true,true,false,true,false,false],
    ["nextFollowupDate","Próximo seguimiento","followup","Seguimiento",130,"VERSIONED","DATE",false,true,true,true,true,true,true],
    ["effectiveClosedAt","Cierre efectivo","effectiveness","Eficacia",140,"STRUCTURAL","DATE",false,true,true,true,true,true,false],
    ["internalObservations","Observaciones","management","Gestión",150,"OPERATIONAL","LONG_TEXT",false,true,true,false,true,false,false],
  ] as const;

  for (const [
    fieldKey,label,sectionKey,sectionLabel,sortOrder,kind,valueType,required,
    listAvailable,listVisibleByDefault,filterable,simpleExport,officialAnnexField,editableDefinition,
  ] of capaFieldConfigs) {
    await prisma.formFieldConfig.upsert({
      where: { formVersionId_fieldKey: { formVersionId: capaForm.id, fieldKey } },
      update: {
        label, sectionKey, sectionLabel, sortOrder, kind, valueType, required,
        listAvailable, listVisibleByDefault, filterable, simpleExport,
        officialAnnexField, editableDefinition,
      },
      create: {
        formVersionId: capaForm.id, fieldKey, label, sectionKey, sectionLabel,
        sortOrder, kind, valueType, required, listAvailable, listVisibleByDefault,
        filterable, simpleExport, officialAnnexField, editableDefinition,
      },
    });
  }

  await prisma.templateVersion.upsert({
    where: {
      module_documentType_versionCode: {
        module: QmsRecordType.CAPA,
        documentType: DocumentType.CAPA_ANNEX_III,
        versionCode: "05",
      },
    },
    update: { isActive: true },
    create: {
      module: QmsRecordType.CAPA,
      documentType: DocumentType.CAPA_ANNEX_III,
      versionCode: "05",
      effectiveFrom: new Date("2026-02-02"),
      isActive: true,
    },
  });

  await prisma.templateVersion.upsert({
    where: {
      module_documentType_versionCode: {
        module: QmsRecordType.CAPA,
        documentType: DocumentType.CAPA_ANNEX_IV,
        versionCode: "05",
      },
    },
    update: { isActive: true },
    create: {
      module: QmsRecordType.CAPA,
      documentType: DocumentType.CAPA_ANNEX_IV,
      versionCode: "05",
      effectiveFrom: new Date("2026-02-02"),
      isActive: true,
    },
  });

  const changeForm = await prisma.formVersion.upsert({
    where:{module_versionCode:{module:QmsRecordType.CHANGE_CONTROL,versionCode:"CC-03"}},
    update:{isActive:true,status:"ACTIVE"},
    create:{
      module:QmsRecordType.CHANGE_CONTROL,versionCode:"CC-03",
      effectiveFrom:new Date("2026-04-06"),isActive:true,status:"ACTIVE",notes:"GC-00/003/03.",
    },
  });

  const changeFieldConfigs = [
    ["businessCode","Codificación","identification","Identificación",10,"STRUCTURAL","TEXT",true,true,true,true,true,true,false],
    ["department","Departamento","identification","Identificación",20,"STRUCTURAL","REFERENCE",true,true,true,true,true,true,false],
    ["description","Descripción","request","Solicitud",30,"VERSIONED","LONG_TEXT",true,true,true,false,true,true,true],
    ["requestedAt","Fecha solicitud","request","Solicitud",40,"STRUCTURAL","DATE",true,true,true,true,true,true,false],
    ["decisionAt","Fecha aprobación","decision","Dictamen",50,"STRUCTURAL","DATE",false,true,true,true,true,true,false],
    ["classification","Clasificación","decision","Dictamen",60,"STRUCTURAL","SELECT",false,true,true,true,true,true,false],
    ["plannedImplementationAt","Fecha prevista","actions","Plan",70,"VERSIONED","DATE",false,true,true,true,true,true,true],
    ["executionStatus","Estado ejecución","followup","Seguimiento",80,"STRUCTURAL","SELECT",true,true,true,true,true,true,false],
    ["executedAt","Fecha ejecución","followup","Seguimiento",90,"STRUCTURAL","DATE",false,true,true,true,true,true,false],
    ["effectivenessStatus","Eficacia","effectiveness","Eficacia",100,"STRUCTURAL","SELECT",true,true,true,true,true,true,false],
    ["latestFollowup","Último seguimiento","followup","Seguimiento",110,"DERIVED","TEXT",false,true,true,false,true,false,false],
    ["nextFollowupDate","Próximo seguimiento","followup","Seguimiento",120,"VERSIONED","DATE",false,true,true,true,true,true,true],
    ["status","Estado final","closure","Cierre",130,"STRUCTURAL","SELECT",true,true,true,true,true,true,false],
    ["effectiveClosedAt","Fecha cierre","closure","Cierre",140,"STRUCTURAL","DATE",false,true,true,true,true,true,false],
    ["internalObservations","Observaciones","management","Gestión",150,"OPERATIONAL","LONG_TEXT",false,true,true,false,true,false,false],
  ] as const;
  for (const [
    fieldKey,label,sectionKey,sectionLabel,sortOrder,kind,valueType,required,
    listAvailable,listVisibleByDefault,filterable,simpleExport,officialAnnexField,editableDefinition,
  ] of changeFieldConfigs) {
    await prisma.formFieldConfig.upsert({
      where:{formVersionId_fieldKey:{formVersionId:changeForm.id,fieldKey}},
      update:{label,sectionKey,sectionLabel,sortOrder,kind,valueType,required,listAvailable,listVisibleByDefault,filterable,simpleExport,officialAnnexField,editableDefinition},
      create:{formVersionId:changeForm.id,fieldKey,label,sectionKey,sectionLabel,sortOrder,kind,valueType,required,listAvailable,listVisibleByDefault,filterable,simpleExport,officialAnnexField,editableDefinition},
    });
  }

  for (const documentType of [DocumentType.CHANGE_ANNEX_III_IV,DocumentType.CHANGE_ANNEX_V,DocumentType.CHANGE_ANNEX_VII]) {
    await prisma.templateVersion.upsert({
      where:{module_documentType_versionCode:{module:QmsRecordType.CHANGE_CONTROL,documentType,versionCode:"03"}},
      update:{isActive:true},
      create:{module:QmsRecordType.CHANGE_CONTROL,documentType,versionCode:"03",effectiveFrom:new Date("2026-04-06"),isActive:true},
    });
  }
}

main().finally(async () => {
  await prisma.$disconnect();
});
