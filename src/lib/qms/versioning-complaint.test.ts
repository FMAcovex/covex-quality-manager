import { describe,expect,it } from "vitest";
import {
 complaintSnapshotVersionFollowupDate,
 complaintSnapshotToAnnexRecord,
 recordVersionSummary,
} from "@/lib/qms/versioning";

const snapshot={
 recordType:"COMPLAINT",
 businessCode:"R/C/001/2026",
 year:2026,
 complaint:{
  openedAt:"2026-09-01T00:00:00.000Z",
  versionFollowupDate:"2026-10-01T00:00:00.000Z",
  nextFollowupDate:"2026-10-20T00:00:00.000Z",
  status:"OPEN",
  effectivenessStatus:"PENDING",
  capaPlans:[],
  derivedActions:[],
  followups:[],
  annexIIITemplateVersionCode:"03",
 }
} as const;

describe("Reclamaciones · snapshots de versión",()=>{
 it("recupera la fecha propia del seguimiento/versionado",()=>{
  expect(complaintSnapshotVersionFollowupDate(snapshot as never,1)?.toISOString().slice(0,10)).toBe("2026-10-01");
 });
 it("usa apertura como fecha de V00 si no hay fecha explícita",()=>{
  const initial={...snapshot,complaint:{...snapshot.complaint,versionFollowupDate:null}};
  expect(complaintSnapshotVersionFollowupDate(initial as never,0)?.toISOString().slice(0,10)).toBe("2026-09-01");
 });
 it("resume el estado congelado de la versión",()=>{
  expect(recordVersionSummary("COMPLAINT",snapshot as never)).toMatchObject({
   status:"OPEN",effectivenessStatus:"PENDING",nextFollowupDate:"2026-10-20T00:00:00.000Z"
  });
 });
 it("convierte el snapshot en registro para el Anexo III",()=>{
  const record=complaintSnapshotToAnnexRecord(snapshot as never);
  expect(record.qmsRecord.businessCode).toBe("R/C/001/2026");
  expect(record.annexIIITemplateVersion).toEqual({versionCode:"03"});
  expect(record.nextFollowupDate?.toISOString().slice(0,10)).toBe("2026-10-20");
 });
});
