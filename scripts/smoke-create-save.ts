import assert from "node:assert/strict";
import { PrismaClient, QmsRecordType } from "@prisma/client";
import { createDeviationAction } from "../src/modules/deviations/actions";
import { createCapaAction } from "../src/modules/capa/actions";

const prisma = new PrismaClient();

function isRedirect(error: unknown) {
  return Boolean(
    error &&
      typeof error === "object" &&
      "digest" in error &&
      String((error as { digest?: unknown }).digest ?? "").startsWith("NEXT_REDIRECT"),
  );
}

async function runAction(
  action: (state: { error: string | null }, formData: FormData) => Promise<{ error: string | null }>,
  formData: FormData,
) {
  try {
    const state = await action({ error: null }, formData);
    assert.equal(state.error, null, state.error ?? "La acción debía redirigir tras guardar.");
  } catch (error) {
    if (!isRedirect(error)) throw error;
  }
}

async function main() {
  const department = await prisma.department.findUniqueOrThrow({ where: { code: "GC-00" } });

  const deviationCode = "D/C3A/001/2099";
  const deviationForm = new FormData();
  deviationForm.set("businessCode", deviationCode);
  deviationForm.set("departmentId", department.id);
  deviationForm.set("issueDate", "2099-03-01");
  deviationForm.set("createdByText", "CI C3-A");
  deviationForm.set("whatHappened", "Desviación ficticia creada mediante la server action real.");
  deviationForm.set("status", "OPEN");
  deviationForm.set("dataQualityStatus", "REVIEW_REQUIRED");
  deviationForm.set("immediateActionsJson", "[]");
  deviationForm.set("capaPlansJson", "[]");

  await runAction(createDeviationAction, deviationForm);

  const deviation = await prisma.deviation.findFirstOrThrow({
    where: { qmsRecord: { recordType: QmsRecordType.DEVIATION, businessCode: deviationCode } },
    include: { qmsRecord: { include: { versions: true } } },
  });
  assert.equal(deviation.qmsRecord.versions.length, 1);
  assert.equal(deviation.qmsRecord.versions[0].sequenceNumber, 0);
  assert.equal(deviation.whatHappened, "Desviación ficticia creada mediante la server action real.");

  const duplicateDeviation = await createDeviationAction({ error: null }, deviationForm);
  assert.ok(duplicateDeviation.error);
  assert.ok(duplicateDeviation.fieldIssues?.businessCode?.length);

  const capaCode = "AC/C3A/001/2099";
  const capaForm = new FormData();
  capaForm.set("businessCode", capaCode);
  capaForm.set("actionType", "CORRECTIVE");
  capaForm.set("departmentId", department.id);
  capaForm.set("openedAt", "2099-03-02");
  capaForm.set("createdByText", "CI C3-A");
  capaForm.set("originType", "Desviación");
  capaForm.set("originCode", deviationCode);
  capaForm.set("defectDescription", "Defecto ficticio para probar la creación CAPA.");
  capaForm.set("rootCause", "Causa ficticia sustentada.");
  capaForm.set("status", "OPEN");
  capaForm.set("effectivenessStatus", "PENDING");
  capaForm.set("dataQualityStatus", "REVIEW_REQUIRED");
  capaForm.set(
    "plannedActionsJson",
    JSON.stringify([
      {
        description: "Acción ficticia creada mediante la server action.",
        responsible: "CI",
        plannedExecutionDate: "2099-03-20",
        impact: "",
      },
    ]),
  );

  await runAction(createCapaAction, capaForm);

  const capa = await prisma.capa.findFirstOrThrow({
    where: { qmsRecord: { recordType: QmsRecordType.CAPA, businessCode: capaCode } },
    include: {
      plannedActions: true,
      qmsRecord: {
        include: {
          versions: true,
          targetRelations: true,
        },
      },
    },
  });
  assert.equal(capa.plannedActions.length, 1);
  assert.equal(capa.qmsRecord.versions.length, 1);
  assert.equal(capa.qmsRecord.versions[0].sequenceNumber, 0);
  assert.ok(
    capa.qmsRecord.targetRelations.some(
      (relation) =>
        relation.sourceRecordId === deviation.qmsRecordId &&
        relation.relationType === "GENERATES",
    ),
  );

  const duplicateCapa = await createCapaAction({ error: null }, capaForm);
  assert.ok(duplicateCapa.error);
  assert.ok(duplicateCapa.fieldIssues?.businessCode?.length);

  console.log("Create/save server-action smoke test passed.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
