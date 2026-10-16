import { describe, expect, it } from "vitest";
import { QmsRecordType, QmsRelationType } from "@prisma/client";
import { accessModules } from "@/lib/auth/context";
import { allowedRelations, operationalRelationLabel } from "@/lib/qms/relation-rules";
import { qmsRecordTypeLabel } from "@/lib/qms/record-links";
import { qmsRelationHooks } from "@/modules/relation-hooks-registry";
import { qmsModuleByKey, qmsModuleByRecordType, qmsModuleKeys, qmsModules, qmsRecordModules, qmsRecordTypes, registeredRelationRules } from "@/modules/registry";
import { DASHBOARD_ALL_MODULES, DASHBOARD_MODULES } from "@/modules/dashboard/domain";

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
    expect(new Set(qmsRecordTypes).size).toBe(qmsRecordTypes.length);
    expect([...qmsRecordTypes].sort()).toEqual(Object.values(QmsRecordType).sort());
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
    const registered = new Set(qmsRecordTypes);
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
    const previousTypeLabels = { AUDIT: "Auditoría", DEVIATION: "Desviación", CAPA: "CAPA", CHANGE_CONTROL: "Control de Cambio", COMPLAINT: "Reclamación", RETURN: "Devolución" };
    for (const contract of qmsRecordModules) {
      expect(qmsRecordTypeLabel(contract.recordType)).toBe(previousTypeLabels[contract.recordType]);
    }
    expect(qmsRecordTypeLabel("UNKNOWN")).toBe("UNKNOWN");
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

// Valores literales vigentes antes de la PR 3: el registro debe reproducirlos
// exactamente para que menú, dashboard, audit trail y autorización no cambien.
describe("Contrato de módulo QMS — listas derivadas (PR 3)", () => {
  it("incluye PNT sin expediente QmsRecord ni relaciones (D-083 MC-3)", () => {
    expect(qmsModuleByKey("PNT")).toMatchObject({ recordType: null, href: "/controlled-documents", relations: { outgoing: [] } });
    expect(qmsRecordModules.some((contract) => contract.key === "PNT")).toBe(false);
  });

  it("reproduce los módulos del menú principal en el mismo orden", () => {
    expect(qmsModules.map((contract) => [contract.labels.plural, contract.href])).toEqual([
      ["Desviaciones", "/deviations"],
      ["CAPA", "/capa"],
      ["Controles de cambios", "/changes"],
      ["Reclamaciones", "/complaints"],
      ["Devoluciones", "/returns"],
      ["Auditorías", "/audits"],
      ["Documentación controlada", "/controlled-documents"],
    ]);
  });

  it("reproduce las tarjetas y opciones del dashboard", () => {
    expect(DASHBOARD_MODULES).toEqual([
      { key: "DEVIATION", label: "Desviaciones", href: "/deviations", indicatorHref: "/deviations/indicators" },
      { key: "CAPA", label: "CAPA", href: "/capa", indicatorHref: "/capa/indicators" },
      { key: "CHANGE_CONTROL", label: "Controles de cambios", href: "/changes", indicatorHref: "/changes/indicators" },
      { key: "COMPLAINT", label: "Reclamaciones", href: "/complaints", indicatorHref: "/complaints/indicators" },
      { key: "RETURN", label: "Devoluciones", href: "/returns", indicatorHref: "/returns/indicators" },
      { key: "AUDIT", label: "Auditorías", href: "/audits", indicatorHref: null },
    ]);
    expect(DASHBOARD_ALL_MODULES).toEqual([
      ...DASHBOARD_MODULES,
      { key: "PNT", label: "Documentación controlada", href: "/controlled-documents", indicatorHref: null },
    ]);
  });

  it("reproduce los módulos del audit trail", () => {
    expect(qmsModuleKeys).toEqual(["DEVIATION", "CAPA", "CHANGE_CONTROL", "COMPLAINT", "RETURN", "AUDIT", "PNT"]);
  });

  it("coincide con accessModules, que sigue siendo la fuente del tipo AccessModule", () => {
    expect([...qmsModuleKeys, "SYSTEM"]).toEqual([...accessModules]);
  });

  it("reproduce los tipos de expediente admitidos por las guardas de servidor", () => {
    expect(qmsRecordTypes).toEqual(["DEVIATION", "CAPA", "CHANGE_CONTROL", "COMPLAINT", "RETURN", "AUDIT"]);
  });
});
