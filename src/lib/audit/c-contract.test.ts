import { expect,it } from "vitest";
import contract from "../../../ops/backup/audit-contract-c.json";
import previous from "../../../ops/backup/audit-contract-b2-critical.json";
import { auditCContract } from "../../../scripts/audit-c-build";

it("reconciles C immutable receipts, functions and INTEGER signature while retaining B2 protection",()=>{
  expect(auditCContract()).toEqual(contract);
  for(const table of previous.tables)expect(contract.tables).toContain(table);
  for(const [name,value] of Object.entries(previous.functions))expect(contract.functions[name as keyof typeof contract.functions]).toEqual(value);
  expect(contract.functions.covex_c_record_export.arguments).toMatch(/integer$/);
  for(const table of ["AuditTrailReview","AuditTrailReviewOperation","AuditTrailReviewEvent","AuditTrailExport","AuditTrailExportEvent"]){
    expect(contract.triggers.filter(trigger=>trigger.table===table).map(trigger=>trigger.type).sort()).toEqual([27,34]);
  }
});
