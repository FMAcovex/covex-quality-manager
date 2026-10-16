import { describe, expect, it } from "vitest";
import { QmsRecordType, QmsRelationType } from "@prisma/client";
import { accessModules } from "@/lib/auth/context";
import { allowedRelations, operationalRelationLabel } from "@/lib/qms/relation-rules";
import { qmsRecordTypeLabel } from "@/lib/qms/record-links";
import { qmsRelationHooks } from "@/modules/relation-hooks-registry";
import { qmsModules, qmsModuleByRecordType, registeredRelationRules } from "@/modules/registry";

// Matriz vigente antes del contrato de módulo (D-018, D-047, D-065, D-083).
// Cambiarla exige una decisión expresa y actualizar esta referencia.
const approvedRelationMatrix = [
  { sourceType: "DEVIATION", targetType: "CAPA", relationType: "GENERATES", label: "Desviación → CAPA" },
  { sourceType: "COMPLAINT", targetType: "CAPA", relationType: "GENERATES", label: "Reclamación → CAPA" },
  { sourceType: "COMPLAINT", targetType: "RETURN", relationType: "GENERATES", label: "Reclamación → Devolución" },
  { sourceType: "AUDIT", targetType: "DEVIATION", relationType: "GENERATES", label: "Auditoría → Desviación" },
  { sourceType: "AUDIT", targetType: "CAPA", relationType: "GENERATES", label: "Auditoría → CAPA" },
];

describe("Contrato de módulo QMS — registro (PR 2)", () => {
  it("registra cada tipo de expediente QmsRecord exactamente una vez", () => {
    const recordTypes = qmsModules.map((contract) => contract.recordType);
    expect(new Set(recordTypes).size).toBe(recordTypes.length);
    expect([...recordTypes].sort()).toEqual(Object.values(QmsRecordType).sort());
  });

  it("usa claves de módulo únicas y conocidas por la autorización", () => {
    const keys = qmsModules.map((contract) => contract.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) expect(accessModules).toContain(key);
    expect(qmsModules.every((contract) => contract.contractVersion === 1)).toBe(true);
  });

  it("deriva una matriz de relaciones idéntica a la aprobada, incluido el orden", () => {
    expect(allowedRelations).toEqual(approvedRelationMatrix);
  });

  it("solo declara relaciones hacia módulos registrados y sin duplicados", () => {
    const registered = new Set(qmsModules.map((contract) => contract.recordType));
    const keys = registeredRelationRules.map((rule) => `${rule.source}|${rule.target}|${rule.type}`);
    expect(new Set(keys).size).toBe(keys.length);
    for (const rule of registeredRelationRules) {
      expect(registered.has(rule.target)).toBe(true);
      expect(rule.source).not.toBe(rule.target);
      expect(Object.values(QmsRelationType)).toContain(rule.type);
    }
  });

  it("mantiene Control de Cambios sin relaciones operativas (D-083 MC-2)", () => {
    expect(qmsModuleByRecordType(QmsRecordType.CHANGE_CONTROL)?.relations.outgoing).toEqual([]);
    expect(registeredRelationRules.some((rule) => rule.target === QmsRecordType.CHANGE_CONTROL)).toBe(false);
  });

  it("conserva las etiquetas visibles vigentes de tipos y relaciones", () => {
    for (const contract of qmsModules) {
      expect(contract.labels.singular).toBe(qmsRecordTypeLabel(contract.recordType));
    }
    for (const rule of approvedRelationMatrix) {
      expect(operationalRelationLabel(rule.sourceType as QmsRecordType, rule.targetType as QmsRecordType)).toBe(rule.label);
    }
    expect(operationalRelationLabel(QmsRecordType.CHANGE_CONTROL, QmsRecordType.CAPA)).toBe("Relación QMS");
  });

  it("solo asocia hooks de relación a módulos registrados", () => {
    for (const recordType of Object.keys(qmsRelationHooks)) {
      expect(qmsModuleByRecordType(recordType)).toBeDefined();
    }
    expect(Object.keys(qmsRelationHooks).sort()).toEqual(["AUDIT", "COMPLAINT", "RETURN"]);
  });
});
