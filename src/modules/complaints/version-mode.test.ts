import { describe,expect,it } from "vitest";
import { complaintNewVersionErrors,complaintSaveMode,complaintVersionKind } from "@/modules/complaints/version-mode";

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

describe("R4A · metadatos de nueva versión",()=>{
 it("requiere motivo y fecha reales",()=>{expect(complaintNewVersionErrors(""," ")).toHaveLength(2);expect(complaintNewVersionErrors("2026-02-30","Seguimiento")).toHaveLength(1);});
 it("acepta una fecha válida y motivo",()=>{expect(complaintNewVersionErrors("2028-02-29","Seguimiento formal")).toEqual([]);});
});
