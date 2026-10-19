import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import type { ModuleLifecycle } from "@/modules/contract";
import { qmsModules } from "@/modules/registry";
import { acceptsFollowup, keepsOperationalStatus } from "@/modules/lifecycle";
import { auditAlreadyClosed, auditStatusChangeError } from "@/modules/audits/lifecycle";
import { auditClosureChecklist, type ClosureContext } from "@/modules/audits/closure-policy";
import { capaFollowupStatuses } from "@/modules/capa/followup-transition";
import { legacyCapaStatus } from "@/modules/capa/import/legacy-mapping";
import { followupFinalStatus } from "@/modules/change-control/lifecycle";
import { legacyDeviationStatus } from "@/modules/deviations/import/legacy-mapping";
import { existingStatuses, newRevisionStatus } from "@/modules/controlled-documents/domain";
import { assertTransition, commandSchema, revisionStatusAfter } from "@/modules/controlled-documents/lifecycle/domain";
import { manualStates, validateManualChange, type ManualStatusInput } from "@/modules/controlled-documents/manual-state/domain";
import { canEditRevision } from "@/modules/controlled-documents/revision-editability";

vi.mock("server-only", () => ({}));

type Origin = string | null;
const pair = (from: Origin, to: string) => `${from ?? "alta"} → ${to}`;
const origins = (states: readonly string[]): Origin[] => [null, ...states];

/** Cambios de estado (origen distinto del destino) que una regla admite. */
function pairsWhere(froms: readonly Origin[], tos: readonly string[], allowed: (from: Origin, to: string) => boolean = () => true) {
  const pairs = new Set<string>();
  for (const from of froms) for (const to of tos) if (from !== to && allowed(from, to)) pairs.add(pair(from, to));
  return pairs;
}

/** Cambios de estado que el contrato declara para una operación. */
function declared(lifecycle: ModuleLifecycle, operation: string) {
  const pairs = new Set<string>();
  for (const transition of lifecycle.transitions.filter(t => t.operation === operation)) {
    for (const from of transition.from) for (const to of transition.to) if (from !== to) pairs.add(pair(from, to));
  }
  return pairs;
}

const passes = (check: () => void) => { try { check(); return true; } catch { return false; } };
const closable = (status: string): ClosureContext => ({ scenario: "INTERNAL_COVEX", status, isActive: true, reportIssued: true, primaryDocument: false, capaPlanEstablishedAt: null, reportSentAt: null, supplierResponseReceivedAt: null, responseRequired: false, responseSentAt: null, findings: [], capaPlanVersions: 0, capaPlanOutdated: false, signedPdf: false });
const today = "2026-10-16";
const manualInput = (targetStatus: string) => ({ requestId: "00000000-0000-4000-8000-000000000000", expectedVersion: 0, expectedUpdatedAt: `${today}T00:00:00.000Z`, reason: "Motivo", targetStatus, effectiveFrom: today }) as ManualStatusInput;
const editableRevision = (status: string) => ({ status, consolidatedAt: null, lifecycle: null, decisions: [] });
const pntOperations = commandSchema.shape.operation.options;
const pntResults = [undefined, ...commandSchema.shape.result.unwrap().options];

/** Regla de estado vigente que comprueba cada operación declarada, por `MÓDULO:operación`. */
const checkers: Record<string, (states: readonly string[]) => Set<string>> = {
  ...Object.fromEntries(["DEVIATION", "CAPA", "CHANGE_CONTROL", "COMPLAINT", "RETURN", "OOS"].map(module => [`${module}:save`, (states: readonly string[]) => pairsWhere(origins(states), states, keepsOperationalStatus)])),
  "AUDIT:save": states => pairsWhere(origins(states), states, (from, to) => auditStatusChangeError(from, to) === null),
  "AUDIT:close": states => pairsWhere(states, ["CLOSED"], from => !auditAlreadyClosed(from!) && auditClosureChecklist(closable(from!)).blockers.length === 0),
  "CAPA:followup": states => pairsWhere(states, capaFollowupStatuses, from => acceptsFollowup(from!)),
  "CHANGE_CONTROL:followup": states => pairsWhere(states, [followupFinalStatus(true), followupFinalStatus(false)], from => acceptsFollowup(from!)),
  // La corrección no comprueba el origen: solo hay seguimientos en expedientes que admitieron uno y no vuelven a Borrador.
  "CHANGE_CONTROL:followup-edit": states => pairsWhere(states, [followupFinalStatus(true), followupFinalStatus(false)], from => acceptsFollowup(from!)),
  "DEVIATION:import": () => pairsWhere([null], ["Cerrada", "cerrado", "Abierta", "", null].map(legacyDeviationStatus)),
  "CAPA:import": () => pairsWhere([null], ["Cancelada", "Cerrada", "Abierta", "", null].map(legacyCapaStatus)),
  "PNT:create": () => pairsWhere([null], [newRevisionStatus(false, "IN_FORCE")]),
  "PNT:legacy-register": states => pairsWhere([null, ...states.filter(s => canEditRevision(editableRevision(s)))], existingStatuses.map(status => newRevisionStatus(true, status))),
  "PNT:manual": states => pairsWhere(states, manualStates, (from, to) => passes(() => validateManualChange(from as never, manualInput(to), today))),
  ...Object.fromEntries(pntOperations.map(operation => [`PNT:${operation}`, (states: readonly string[]) => {
    const pairs = new Set<string>();
    for (const from of states) {
      if (![undefined, "PREPARATION", "REVIEW", "APPROVAL"].some(role => passes(() => assertTransition(operation, from as never, role)))) continue;
      for (const result of pntResults) { const to = revisionStatusAfter(operation, from as never, result); if (to !== from) pairs.add(pair(from, to)); }
    }
    return pairs;
  }])),
};

/** Operaciones declaradas sin regla pura que comprobar, con el motivo. */
const unchecked: Record<string, string> = {
  "PNT:import": "El importador fija IMPORTED_PENDING de forma literal; lo cubre el smoke pnt-p1b2 sobre PostgreSQL.",
};

const enumValues = (field: string) => {
  const [modelName, fieldName] = field.split(".");
  const type = Prisma.dmmf.datamodel.models.find(model => model.name === modelName)?.fields.find(f => f.name === fieldName)?.type;
  return Prisma.dmmf.datamodel.enums.find(e => e.name === type)?.values.map(value => value.name);
};

describe("Contrato de módulo — ciclo de vida descriptivo (PR 5)", () => {
  it.each(qmsModules.map(contract => [contract.key, contract.lifecycle] as const))("%s declara exactamente los estados de su campo en el schema", (_key, lifecycle) => {
    expect(enumValues(lifecycle.field)).toEqual([...lifecycle.states]);
    for (const transition of lifecycle.transitions) {
      for (const state of [...transition.from.filter(Boolean), ...transition.to]) expect(lifecycle.states, `${transition.operation}: ${state}`).toContain(state);
    }
  });

  it("toda operación declarada tiene una regla que la comprueba o un motivo para no tenerla", () => {
    const operations = qmsModules.flatMap(contract => contract.lifecycle.transitions.map(t => `${contract.key}:${t.operation}`));
    for (const operation of operations) expect(operation in checkers || operation in unchecked, operation).toBe(true);
    for (const operation of Object.keys(unchecked)) expect(operations).toContain(operation);
  });

  it.each(qmsModules.flatMap(contract => Object.keys(checkers).filter(key => key.startsWith(`${contract.key}:`)).map(key => [key, contract] as const)))(
    "%s: la declaración coincide con la regla vigente para todo origen → destino",
    (key, contract) => {
      const operation = key.slice(contract.key.length + 1);
      expect([...declared(contract.lifecycle, operation)].sort()).toEqual([...checkers[key](contract.lifecycle.states)].sort());
    },
  );

  it("la edición de la ficha admite guardar sin cambiar de estado", () => {
    for (const contract of qmsModules.filter(c => c.lifecycle.transitions.some(t => t.operation === "save"))) {
      for (const state of contract.lifecycle.states) {
        const allowed = contract.key === "AUDIT" ? auditStatusChangeError(state, state) === null : keepsOperationalStatus(state, state);
        expect(allowed, `${contract.key}: ${state}`).toBe(true);
      }
    }
  });

  it("PNT: registrar o contrastar una función externa no cambia el estado", () => {
    const pnt = qmsModules.find(contract => contract.key === "PNT")!;
    for (const operation of ["REGISTER_EXTERNAL", "CONTRAST_EXTERNAL"]) {
      expect(checkers[`PNT:${operation}`](pnt.lifecycle.states).size).toBe(0);
      expect(declared(pnt.lifecycle, operation).size).toBe(0);
    }
  });
});
