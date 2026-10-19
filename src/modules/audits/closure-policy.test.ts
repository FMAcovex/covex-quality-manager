import { describe, it, expect } from "vitest";
import { auditClosureChecklist, type ClosureContext, type ClosureFinding } from "./closure-policy";
const context = (change: Partial<ClosureContext> = {}): ClosureContext => ({ scenario:'INTERNAL_COVEX',status:'OPEN',isActive:true,reportIssued:true,primaryDocument:false,capaPlanEstablishedAt:null,reportSentAt:null,supplierResponseReceivedAt:null,responseRequired:false,responseSentAt:null,findings:[],capaPlanVersions:0,capaPlanOutdated:false,signedPdf:false,...change });
const finding = (change: Partial<ClosureFinding> = {}): ClosureFinding => ({id:'uuid',reference:'OBS 03',isActive:true,criticality:'MAJOR',treatment:'Tratamiento',treatmentStatus:'CLOSED',evidence:'Registro',evidenceReference:null,verificationComment:null,actions:[],...change});
const action = (status: 'OPEN'|'CLOSED'|'NOT_APPLICABLE', evidence: string | null = 'Registro de ejecución') => ({ isActive:true,status,evidence,evidenceReference:null,verificationComment:null });
// D-110 (R5C2): cierre con acciones cerradas o no aplicables con evidencia y cada hallazgo tratado.
describe('Cierre de auditoría (D-110)',()=>{
 it('permite informe emitido sin hallazgos ni CAPA plan y avisa del PDF sin exigirlo',()=>{const c=auditClosureChecklist(context());expect(c.blockers).toEqual([]);expect(c.warnings).toHaveLength(1);});
 it.each([{isActive:false},{status:'DRAFT'},{reportIssued:false}])('bloquea condición pendiente %j',change=>expect(auditClosureChecklist(context(change)).blockers.length).toBeGreaterThan(0));
 it('con hallazgos activos exige el CAPA plan establecido (versión 00)',()=>{
   expect(auditClosureChecklist(context({findings:[finding()]})).blockers.join(' ')).toMatch(/Establece el CAPA plan/);
   expect(auditClosureChecklist(context({findings:[finding()],capaPlanVersions:1})).blockers).toEqual([]);
 });
 it('basta con acciones cerradas o no aplicables con evidencia: no exige verificación ni CAPA vinculadas cerradas',()=>{
   const c=auditClosureChecklist(context({capaPlanVersions:2,findings:[finding({treatment:null,treatmentStatus:'OPEN',evidence:null,actions:[action('CLOSED'),action('NOT_APPLICABLE','Justificación')]})]}));
   expect(c.blockers).toEqual([]);
 });
 it('bloquea acciones abiertas o terminales sin evidencia, referencia ni justificación',()=>{
   expect(auditClosureChecklist(context({capaPlanVersions:1,findings:[finding({actions:[action('OPEN')]})]})).blockers.join(' ')).toMatch(/OBS 03: acción pendiente/);
   expect(auditClosureChecklist(context({capaPlanVersions:1,findings:[finding({actions:[action('NOT_APPLICABLE',null)]})]})).blockers.join(' ')).toMatch(/OBS 03: acción sin evidencia/);
 });
 it('un hallazgo sin acciones exige tratamiento terminal con evidencia o referencia',()=>{
   for(const f of [finding({treatmentStatus:'OPEN'}),finding({evidence:null}),finding({treatment:null})])expect(auditClosureChecklist(context({capaPlanVersions:1,findings:[f]})).blockers.join(' ')).toMatch(/OBS 03: sin acciones/);
   expect(auditClosureChecklist(context({capaPlanVersions:1,findings:[finding({evidence:null,evidenceReference:'REG-1'})]})).blockers).toEqual([]);
 });
 it('los retirados no bloquean',()=>expect(auditClosureChecklist(context({findings:[finding({isActive:false,treatment:null,treatmentStatus:'OPEN'})]})).blockers).toEqual([]));
 it('avisa, sin bloquear, si la última versión del CAPA plan no refleja el estado actual',()=>{
   const c=auditClosureChecklist(context({capaPlanVersions:1,capaPlanOutdated:true,findings:[finding()]}));
   expect(c.blockers).toEqual([]);expect(c.warnings.join(' ')).toMatch(/seguimiento final/);
 });
 it('proveedor ya no exige el envío del informe; el envío sigue marcando cierre parcial',()=>{
   expect(auditClosureChecklist(context({scenario:'SUPPLIER'})).blockers).toEqual([]);
   expect(auditClosureChecklist(context({scenario:'SUPPLIER',reportSentAt:'2026-10-07'})).partial).toBe(true);
   expect(auditClosureChecklist(context({capaPlanEstablishedAt:'2026-10-07'})).partial).toBe(true);
 });
 it('admite la excepción de proveedor sin críticos y sin respuesta CAPA',()=>expect(auditClosureChecklist(context({scenario:'SUPPLIER',findings:[finding({criticality:'MINOR',treatment:null,treatmentStatus:'OPEN',actions:[action('OPEN')]})]}),true).blockers).toEqual([]));
 it.each([{scenario:'INTERNAL_COVEX' as const},{scenario:'SUPPLIER' as const,supplierResponseReceivedAt:'2026-10-07'},{scenario:'SUPPLIER' as const,findings:[finding({criticality:'CRITICAL'})]}])('rechaza excepción incompatible %j',change=>expect(auditClosureChecklist(context(change),true).blockers.length).toBeGreaterThan(0));
 it.each(['CLIENT','AUTHORITY'] as const)('cliente/autoridad %s: informe recibido y respuesta si se requiere',scenario=>{
   expect(auditClosureChecklist(context({scenario,reportIssued:false})).blockers.join(' ')).toMatch(/recibido/);
   expect(auditClosureChecklist(context({scenario,reportIssued:false,primaryDocument:true,responseRequired:true})).blockers.join(' ')).toMatch(/respuesta/);
   expect(auditClosureChecklist(context({scenario,reportIssued:false,primaryDocument:true,responseRequired:true,responseSentAt:'2026-10-07'})).blockers).toEqual([]);
 });
});
