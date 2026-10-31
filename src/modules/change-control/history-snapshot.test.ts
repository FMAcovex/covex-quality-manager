import { describe, expect, it } from "vitest";
import type { ChangeControl, ChangeControlTask } from "@prisma/client";
import { scalarSnapshot, storedScalarSnapshot } from "./history-snapshot";
import { parseChangeControlForm } from "./validation";

const date = (value: string) => new Date(`${value}T00:00:00.000Z`);
const userId = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";

// Control de cambios completo (dictamen aprobado con acciones), como lo devuelve la base de datos.
const task = {
  id: "task-1", changeControlId: "cc-1", origin: "DICTAMEN", departmentId: "dep-1", departmentCodeSnapshot: "LG-10",
  departmentNameSnapshot: "Producción", description: "Actualizar el PNT", responsible: "Jefa de producción",
  responsibleUserId: userId, plannedDate: date("2026-11-30"), sortOrder: 0, createdAt: new Date(), updatedAt: new Date(),
} as unknown as ChangeControlTask;
const stored = {
  id: "cc-1", qmsRecordId: "qr-1", departmentId: "dep-1", departmentCodeSnapshot: "LG-10", departmentNameSnapshot: "Producción",
  requestDate: date("2026-10-01"), requesterName: "Solicitante", requesterPosition: "Técnico", scope: ["PROCESS", "EQUIPMENT"],
  otherScope: null, description: "Cambio de equipo", justification: "Obsolescencia", providedDocuments: "• Ficha técnica",
  requestDecision: "ACCEPTED", requestDecisionResponsible: "Dirección técnica", requestDecisionResponsibleUserId: userId,
  requestDecisionRole: "DT", requestDecisionDate: date("2026-10-02"), evaluation: "Evaluación del riesgo", classification: "MAJOR",
  plannedImplementationDate: date("2026-12-15"), committeeRequired: true, committeeDetails: "Comité de cambios",
  clientNotificationRequired: false, clientNotificationDetails: null, authorityRequired: null, authorityDetails: null,
  pqrRequired: "YES", pqrProducts: "Producto A", pqrPeriod: "2026", stabilityRequired: "NO", stabilityAccelerated: true,
  stabilityOngoing: false, additionalAnalysisRequired: "NA", additionalAnalysisDetails: null, additionalValidationRequired: null,
  additionalValidationDetails: null, otherImplicationRequired: false, otherImplicationDetails: null, dictamenResult: "APPROVED",
  dictamenDate: date("2026-10-05"), followupResponsible: "Calidad", followupResponsibleUserId: userId,
  dictamenObservations: "Con condiciones", internalObservations: "Nota interna",
  textTables: { evaluation: [{ rows: [["Bajo"]], columns: ["Riesgo"], title: "Riesgos" }] },
  signedDocumentAvailable: false, dataQualityStatus: "COMPLETE", finalStatus: "OPEN",
  qmsRecord: { businessCode: "CC/LG-10/001/2026" }, tasks: [task],
} as unknown as ChangeControl & { qmsRecord: { businessCode: string }; tasks: ChangeControlTask[] };

/** Lo que envía el formulario de edición al guardar ese expediente sin tocar nada. */
function unchangedForm() {
  const form = new FormData();
  const fields: Record<string, string> = {
    businessCode: "CC/LG-10/001/2026", departmentId: "dep-1", requestDate: "2026-10-01", requesterName: "Solicitante",
    requesterPosition: "Técnico", otherScope: "", description: "Cambio de equipo", justification: "Obsolescencia",
    providedDocuments: "• Ficha técnica", requestDecision: "ACCEPTED", requestDecisionResponsible: "Dirección técnica",
    requestDecisionResponsibleUserId: userId, requestDecisionRole: "DT", requestDecisionDate: "2026-10-02",
    evaluation: "Evaluación del riesgo", classification: "MAJOR", plannedImplementationDate: "2026-12-15",
    committeeRequired: "true", committeeDetails: "Comité de cambios", clientNotificationRequired: "false",
    clientNotificationDetails: "", authorityRequired: "", authorityDetails: "", pqrRequired: "YES", pqrProducts: "Producto A",
    pqrPeriod: "2026", stabilityRequired: "NO", stabilityAccelerated: "on", additionalAnalysisRequired: "NA",
    additionalAnalysisDetails: "", additionalValidationRequired: "", additionalValidationDetails: "",
    otherImplicationRequired: "false", otherImplicationDetails: "", dictamenResult: "APPROVED", dictamenDate: "2026-10-05",
    followupResponsible: "Calidad", followupResponsibleUserId: userId, dictamenObservations: "Con condiciones",
    internalObservations: "Nota interna", "textTables:evaluation": JSON.stringify([{ title: "Riesgos", columns: ["Riesgo"], rows: [["Bajo"]] }]),
    signedDocumentAvailable: "false", dataQualityStatus: "COMPLETE", finalStatus: "OPEN",
    tasksJson: JSON.stringify([{ id: "task-1", departmentId: "dep-1", description: "Actualizar el PNT", responsible: "Jefa de producción", responsibleUserId: userId, plannedDate: "2026-11-30" }]),
  };
  for (const [name, value] of Object.entries(fields)) form.set(name, value);
  form.append("scope", "PROCESS");
  form.append("scope", "EQUIPMENT");
  return form;
}

describe("historial de Controles de cambios: guardar sin cambios no anota nada", () => {
  it("la foto de lo guardado tiene las mismas claves y valores que la del formulario sin cambios", () => {
    const fromForm = scalarSnapshot(parseChangeControlForm(unchangedForm()).values);
    const fromStored = storedScalarSnapshot(stored);
    expect(Object.keys(fromStored).sort()).toEqual(Object.keys(fromForm).sort());
    const differing = Object.keys(fromForm).filter((key) =>
      JSON.stringify(fromForm[key as keyof typeof fromForm] ?? null) !== JSON.stringify(fromStored[key as keyof typeof fromStored] ?? null));
    expect(differing).toEqual([]);
  });

  it("un cambio real sí se detecta, incluidas las acciones del dictamen", () => {
    const form = unchangedForm();
    form.set("dictamenObservations", "Sin condiciones");
    form.set("tasksJson", JSON.stringify([{ departmentId: "dep-1", description: "Actualizar el PNT y formar", responsible: "Jefa de producción", responsibleUserId: userId, plannedDate: "2026-11-30" }]));
    const fromForm = scalarSnapshot(parseChangeControlForm(form).values);
    const fromStored = storedScalarSnapshot(stored);
    const differing = Object.keys(fromForm).filter((key) =>
      JSON.stringify(fromForm[key as keyof typeof fromForm] ?? null) !== JSON.stringify(fromStored[key as keyof typeof fromStored] ?? null));
    expect(differing).toEqual(["dictamenObservations", "tasks"]);
  });
});
