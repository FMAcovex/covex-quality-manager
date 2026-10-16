import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseDeviationForm } from "../src/modules/deviations/validation";
import { parseCapaForm } from "../src/modules/capa/validation";
import { parseChangeControlForm } from "../src/modules/change-control/validation";
import { parseComplaintForm } from "../src/modules/complaints/validation";
import { parseReturnForm } from "../src/modules/returns/validation";
import { canRelate } from "../src/lib/qms/relation-rules";

function emptyWith(name: string, value: string) {
  const form = new FormData();
  form.set(name, value);
  return form;
}

function assertDraftAndOperationalValidation() {
  const deviationDraft = emptyWith("status", "DRAFT");
  deviationDraft.set("saveIntent", "draft");
  const deviationDraftParsed = parseDeviationForm(deviationDraft);
  assert.deepEqual(deviationDraftParsed.errors, []);
  assert.equal(deviationDraftParsed.values.status, "DRAFT");

  const deviationOpen = emptyWith("status", "DRAFT");
  deviationOpen.set("saveIntent", "open");
  const deviationOpenParsed = parseDeviationForm(deviationOpen);
  assert.equal(deviationOpenParsed.values.status, "OPEN");
  assert.ok(deviationOpenParsed.errors.length > 0);

  const capaDraft = parseCapaForm(emptyWith("status", "DRAFT"));
  assert.deepEqual(capaDraft.errors, []);
  assert.equal(capaDraft.values.status, "DRAFT");
  const capaOpen = parseCapaForm(emptyWith("status", "OPEN"));
  assert.ok(capaOpen.errors.length > 0);

  const changeDraft = parseChangeControlForm(emptyWith("finalStatus", "DRAFT"));
  assert.deepEqual(changeDraft.errors, []);
  assert.equal(changeDraft.values.finalStatus, "DRAFT");
  const changeOpen = parseChangeControlForm(emptyWith("finalStatus", "OPEN"));
  assert.ok(changeOpen.errors.length > 0);

  const complaintDraftForm = emptyWith("status", "DRAFT");
  complaintDraftForm.set("complaintType", "CUSTOMER");
  const complaintDraft = parseComplaintForm(complaintDraftForm);
  assert.deepEqual(complaintDraft.errors, []);
  assert.equal(complaintDraft.values.status, "DRAFT");
  const complaintOpen = parseComplaintForm(emptyWith("status", "OPEN"));
  assert.ok(complaintOpen.errors.length > 0);

  const returnDraftForm = emptyWith("status", "DRAFT");
  returnDraftForm.set("productsJson", "[]");
  const returnDraft = parseReturnForm(returnDraftForm);
  assert.deepEqual(returnDraft.errors, []);
  assert.equal(returnDraft.values.status, "DRAFT");
  const returnOpenForm = emptyWith("status", "OPEN");
  returnOpenForm.set("productsJson", "[]");
  const returnOpen = parseReturnForm(returnOpenForm);
  assert.ok(returnOpen.errors.length > 0);
}

async function assertSourceContracts() {
  const modules = [
    {
      name: "Desviaciones",
      list: "src/app/deviations/page.tsx",
      actions: "src/modules/deviations/actions.ts",
      detail: "src/app/deviations/[id]/page.tsx",
      annexes: ["src/app/api/deviations/[id]/annex-iii/route.ts"],
    },
    {
      name: "CAPA",
      list: "src/app/capa/page.tsx",
      actions: "src/modules/capa/actions.ts",
      detail: "src/app/capa/[id]/page.tsx",
      annexes: ["src/app/api/capa/[id]/annex-iii/route.ts"],
    },
    {
      name: "Control de Cambios",
      list: "src/app/changes/page.tsx",
      actions: "src/modules/change-control/actions.ts",
      detail: "src/app/changes/[id]/page.tsx",
      annexes: [
        "src/app/api/changes/[id]/annex-iii/route.ts",
        "src/app/api/changes/[id]/annex-iv/route.ts",
        "src/app/api/changes/[id]/annex-v/route.ts",
      ],
    },
    {
      name: "Reclamaciones",
      list: "src/app/complaints/page.tsx",
      actions: "src/modules/complaints/actions.ts",
      detail: "src/app/complaints/[id]/page.tsx",
      annexes: [
        "src/app/api/complaints/[id]/annex-iii/route.ts",
        "src/app/api/complaints/[id]/annex-iv/route.ts",
      ],
    },
    {
      name: "Devoluciones",
      list: "src/app/returns/page.tsx",
      actions: "src/modules/returns/actions.ts",
      detail: "src/app/returns/[id]/page.tsx",
      annexes: [
        "src/app/api/returns/[id]/annex-iii/route.ts",
        "src/app/api/returns/[id]/annex-iv/route.ts",
        "src/app/api/returns/[id]/annex-v/route.ts",
      ],
    },
  ];

  for (const moduleConfig of modules) {
    const [listSource, actionsSource, detailSource] = await Promise.all([
      readFile(moduleConfig.list, "utf8"),
      readFile(moduleConfig.actions, "utf8"),
      readFile(moduleConfig.detail, "utf8"),
    ]);

    assert.ok(
      listSource.includes("MultiSelectFilter"),
      `${moduleConfig.name}: el listado debe usar filtros multiselección D5.5.`,
    );
    assert.ok(
      listSource.includes("queryList("),
      `${moduleConfig.name}: el listado debe leer parámetros repetidos.`,
    );
    assert.ok(
      actionsSource.includes("DRAFT"),
      `${moduleConfig.name}: las acciones deben contemplar el estado Borrador.`,
    );
    assert.ok(
      actionsSource.includes("assignOperationalBusinessCode") ||
        moduleConfig.name === "Desviaciones",
      `${moduleConfig.name}: debe conservar la codificación operacional controlada.`,
    );
    assert.ok(
      detailSource.includes("DRAFT") || detailSource.includes("Borrador"),
      `${moduleConfig.name}: el detalle debe distinguir el Borrador.`,
    );

    for (const annex of moduleConfig.annexes) {
      const annexSource = await readFile(annex, "utf8");
      assert.ok(
        annexSource.includes("DRAFT"),
        `${moduleConfig.name}: ${annex} debe bloquear documentos oficiales en Borrador.`,
      );
    }
  }

  // La matriz se deriva de los contratos de módulo (D-083): comprobar las
  // relaciones operativas en lugar del texto de relation-rules.ts.
  for (const [source, target] of [
    ["DEVIATION", "CAPA"],
    ["COMPLAINT", "CAPA"],
    ["COMPLAINT", "RETURN"],
  ] as const) {
    assert.ok(canRelate(source, target, "GENERATES"), `${source} -> ${target} debe seguir permitida.`);
  }

  const filterHelpers = await readFile("src/lib/qms/list-filters.ts", "utf8");
  assert.ok(filterHelpers.includes("queryList"));
  assert.ok(filterHelpers.includes("appendFilterValues"));
}

async function main() {
  assertDraftAndOperationalValidation();
  await assertSourceContracts();
  console.log(
    "D5.6 transversal regression passed: borrador→operativo, contratos de código, relaciones, documentos y filtros en los cinco módulos.",
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
