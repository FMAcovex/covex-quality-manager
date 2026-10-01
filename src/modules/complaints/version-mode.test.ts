import { describe,expect,it } from "vitest";
import { complaintSaveMode,complaintVersionKind } from "@/modules/complaints/version-mode";

describe("Reclamaciones · modo de versionado",()=>{
 it("guarda sobre la versión vigente por defecto",()=>{
  expect(complaintSaveMode(null)).toBe("UPDATE_CURRENT");
  expect(complaintSaveMode("current")).toBe("UPDATE_CURRENT");
 });
 it("crea una nueva versión cuando se solicita",()=>{
  expect(complaintSaveMode("new-version")).toBe("CREATE_VERSION");
  expect(complaintVersionKind({saveMode:"CREATE_VERSION",reopening:false})).toBe("FOLLOWUP");
 });
 it("identifica una reapertura versionada",()=>{
  expect(complaintVersionKind({saveMode:"CREATE_VERSION",reopening:true})).toBe("REOPENING");
 });
});
