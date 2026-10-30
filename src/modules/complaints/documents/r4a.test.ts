import { describe, expect, it, vi } from "vitest";
import { complaintSnapshotToAnnexRecord, recordVersionTemplateId, serializeComplaintVersion } from "@/lib/qms/versioning";
import { getZipEntryText, readZip } from "@/lib/ooxml/zip";
import { generateComplaintAnnexIII, generateComplaintAnnexIV, type ComplaintDocumentRecord } from "@/modules/complaints/documents/docx";
vi.mock("@/modules/complaints/documents/templates",async()=>{
 const {syntheticComplaintDoc}=await import("../../../../scripts/complaints-r4a-doc-fixtures");
 return {loadComplaintPntTemplate:async(_version:string,type:string)=>syntheticComplaintDoc(type==="COMPLAINT_ANNEX_III"?"III":"IV")};
});
function record(){return {...complaintSnapshotToAnnexRecord({recordType:"COMPLAINT",businessCode:"R/C/001/2026",complaint:{relations:[{recordType:"CAPA",businessCode:"AC-HISTÓRICA"}],sourceTypes:[],scopeTypes:[],affectedObjectTypes:[],categoryTypes:[],containmentActions:[],resolutionActions:[],annexIIITemplateVersionId:"template-iii",annexIIITemplateVersionCode:"03",annexIVTemplateVersionCode:"03",versionFollowupDate:"2026-10-07",description:"Descripción histórica V01",partyName:"Cliente ficticio",communicationSummary:"COMUNICACIÓN POSTERIOR A ACCIONES",conclusion:"CONCLUSIÓN PARTE I",closeConclusion:"CIERRE HISTÓRICO",capaPlans:[{actionType:"CORRECTIVE",description:"Primera acción",responsible:"QA",plannedExecutionDate:"2026-10-10"},{actionType:"PREVENTIVE",description:"Segunda acción",responsible:"QA",plannedExecutionDate:"2026-10-11"}],derivedActions:[{actionType:"RETURN",description:"Devolver",responsible:"QA",plannedExecutionDate:"2026-10-12"}]}}),recordVersionLabel:"V01"} as unknown as ComplaintDocumentRecord;}
describe("R4A · documentos por snapshot",()=>{
 it("mantiene fecha, versión, Parte II y campos posteriores al expandir acciones múltiples",async()=>{
  const xml=getZipEntryText(readZip(await generateComplaintAnnexIII(record())),"word/document.xml");
  for(const value of ["V01","7/10/2026","AC-HISTÓRICA","Primera acción","Segunda acción","Devolver","COMUNICACIÓN POSTERIOR A ACCIONES","CONCLUSIÓN PARTE I","CIERRE HISTÓRICO"])expect(xml).toContain(value);
  expect(xml.indexOf("Segunda acción")).toBeLessThan(xml.indexOf("COMUNICACIÓN POSTERIOR A ACCIONES"));
 });
 it("F3: conserva los textos oficiales de la plantilla III v03 (D-098)",async()=>{
  const xml=getZipEntryText(readZip(await generateComplaintAnnexIII(record())),"word/document.xml");
  for(const label of ["Autoridad / entidad sanitaria","Aviso a cliente / proveedor / titular /Autoridad","Cierre en Parte I, sin seguimiento adicional (justificar)","No Conforme","Estado de las acciones:","Vinculadas a seguimiento independiente","Referencias / responsable del seguimiento:"])expect(xml).toContain(label);
  expect(xml).not.toContain("Aviso a partes");
 });
 it("genera IV v03 desde el mismo snapshot y conserva las celdas fijas",async()=>{
  const xml=getZipEntryText(readZip(await generateComplaintAnnexIV(record())),"word/document.xml");
  expect(xml).toContain("Descripción histórica V01");expect(xml).toContain("V01");expect(xml).toContain("CIERRE HISTÓRICO");expect(xml).toContain("TEST 2/0/0");
 });
 it("conserva el código reservado al documentar un expediente anulado",()=>{
  const source={...record(),qmsRecord:{businessCode:null,annulledBusinessCode:"R/C/001/2026",year:2026}} as unknown as Parameters<typeof serializeComplaintVersion>[0];
  expect(serializeComplaintVersion(source).businessCode).toBe("R/C/001/2026");
 });
 it("resuelve el UUID de plantilla III de reclamaciones",()=>{expect(recordVersionTemplateId("COMPLAINT",{complaint:{annexIIITemplateVersionId:"uuid-iii"}})).toBe("uuid-iii");});
 it("D-127: con varias acciones vinculadas (filas copiadas), cada tabla va en la casilla de su apartado",async()=>{
  const table=(title:string)=>({title,columns:["Dato"],rows:[["valor"]]});
  const xml=getZipEntryText(readZip(await generateComplaintAnnexIII({...record(),textTables:{description:[table("Hechos")],communicationSummary:[table("Llamadas")],conclusion:[table("Cierre")]}} as ComplaintDocumentRecord)),"word/document.xml");
  const inSameCell=(text:string,caption:string)=>{const from=xml.indexOf(text),to=xml.indexOf(caption);return from>0&&to>from&&!xml.slice(from,to).includes("</w:tc>");};
  expect(inSameCell("Descripción histórica V01","Tabla 1. Hechos")).toBe(true);
  expect(inSameCell("COMUNICACIÓN POSTERIOR A ACCIONES","Tabla 2. Llamadas")).toBe(true);
  expect(inSameCell("CONCLUSIÓN PARTE I","Tabla 3. Cierre")).toBe(true);
 });
});

