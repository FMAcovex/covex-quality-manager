import { RecordTimeline } from "@/components/record-timeline";
import { appUserOptions } from "@/lib/auth/app-users";
import { PermissionGate } from "@/components/permissions";
import { AuditTrailPanel } from "@/components/audit-trail-panel";
import { currentActor } from "@/lib/auth/presentation";
import { authorizedPage } from "@/lib/auth/page-guard";
import Link from "next/link";
import { auditListingReturnTo, auditWithReturnTo } from "@/modules/audits/navigation";
import { notFound } from "next/navigation";
import { getAuditDetail } from "@/modules/audits/queries";
import { auditDate, auditStatusBadgeClass, auditTypeLabels, auditScenarioLabels, auditStatusLabels, auditSituation, auditModalityLabels, auditRoleLabels, auditQualityLabels } from "@/modules/audits/domain";
import { qmsRecordDisplayCode } from "@/lib/qms/record-links";
import { QmsAdministrativeStatus } from "@/components/qms-administrative-status";
import { RecordHeader } from "@/components/record-header";
import { RecordKeyFacts } from "@/components/record-key-facts";
import { EmptyValue } from "@/components/empty-value";
import { getAuditWork } from "@/modules/audits/finding-queries";
import { AuditFindingsPanel, AuditFollowupPanel, AuditRelationsPanel } from "@/modules/audits/work-panels";
import { getAuditReportView } from "@/modules/audits/documents/service";
import { AuditReportPanel, AuditDocumentsPanel, AuditVersionsPanel } from "@/modules/audits/report-panels";
import { ReviewWorkspaceProvider, ReviewDrawer, ReviewMarker, ReviewModeToggle, ReviewThreadList, ReviewStatusSummary } from "@/components/review";
import { getReviewThreadsForDisplay } from "@/lib/qms/review/ui-queries";
import { auditReviewTargets, auditFindingReviewTarget, auditActionReviewTarget, auditFollowupReviewTarget } from "@/lib/qms/review/targets/audits";
import { reviewTargetWithValue } from "@/lib/qms/review/targets/catalog";
import { reviewTabHref, reviewModeHref } from "@/lib/qms/review/ui-model";
import { auditClosureChecklist } from "@/modules/audits/closure-policy";
import { AuditCloseNavigation } from "@/modules/audits/report-form";
import { parseFindingEdit } from "@/modules/audits/finding-edit";
import { AuditCapaPlanCard } from "@/modules/audits/capa-plan-panels";
export const dynamic = "force-dynamic";
// El historial operativo se consulta en Cronología, como en los demás módulos (D-089, R5A).
const auditTabs = [["information","Información"],["findings","Hallazgos"],["followup","Seguimiento"],["relations","Relaciones"],["report","Informe y cierre"],["documents","Documentos"],["versions","Versiones"],["review","Revisión"],["timeline","Cronología"],["audit-trail","Audit Trail"]] as const;
async function AuditPageAuthenticatedContent({ params, searchParams }: { params: Promise<{id:string}>; searchParams: Promise<{tab?:string;edit?:string;retired?:string;review?:string;thread?:string;reviewVersion?:string;returnTo?:string;auditPage?:string}> }) {
  const {id} = await params, query = await searchParams, requestedTab = query.tab === "history" ? "timeline" : query.tab ?? "", tab = auditTabs.some(([key]) => key === requestedTab) ? requestedTab : "information";
  const work = await getAuditWork(id); if (!work) notFound();
  const users = await appUserOptions(work.findings.flatMap((finding) => finding.actions.map((action) => action.responsibleUserId)));
  const audit = await getAuditDetail(id); if (!audit) notFound();
  const view = await getAuditReportView(id); if (!view) notFound();
  const reviewThreads = await getReviewThreadsForDisplay(audit.qmsRecordId), reviewMode = query.review === "1", basePath = `/audits/${id}`;
  const tabHref = (key: string) => auditWithReturnTo(reviewTabHref(basePath,key,reviewMode),query.returnTo);
  const modeHref = auditWithReturnTo(reviewModeHref(basePath,tab ?? "information",reviewMode),query.returnTo);
  const staticTargets = Object.entries(auditReviewTargets).map(([key,t]) => reviewTargetWithValue(t, key === "conclusion" ? audit.conclusion : key === "scope" ? audit.scope : key === "participants" ? audit.participants.filter(p=>p.isActive).map(p=>p.displayName) : key === "planning" ? {planned:auditDate(audit.plannedDate),performed:auditDate(audit.performedDate)} : key === "closure" ? audit.status : {code:audit.qmsRecord.businessCode,title:audit.title,scenario:audit.scenario}));
  const reviewTargets = [...staticTargets,...work.findings.flatMap(f=>[ {...auditFindingReviewTarget(f.id,{reference:f.reference,description:f.description,retired:!f.isActive}),label:f.reference},...f.actions.map(a=>auditActionReviewTarget(a.id,{description:a.description,retired:!a.isActive}))]),...work.followups.map(f=>auditFollowupReviewTarget(f.id,{description:f.description,date:auditDate(f.followupDate)}))];
  const target = (key: string) => staticTargets.find(t=>t.sectionKey===key)!;
  const checklist = auditClosureChecklist(view.closure);
  const qms = audit.qmsRecord, code = qmsRecordDisplayCode(qms, "Sin código"), departments = audit.departments.filter(d => d.isActive), participants = audit.participants.filter(p => p.isActive).sort((a,b) => a.sortOrder-b.sortOrder);
  const fields = [
    ["Planificación",audit.planningStatus==="PLANNED"?"Incluida en plan anual":audit.planningStatus==="OUT_OF_PLAN"?"Fuera de plan":"Pendiente de clasificación"], ["Motivo fuera de plan",audit.outsidePlanReason], ["Tipo", audit.auditType ? auditTypeLabels[audit.auditType] : "—"], ["Escenario", audit.scenario ? auditScenarioLabels[audit.scenario] : "—"], ["Estado", auditStatusLabels[audit.status]], ["Situación", auditSituation({...audit, findings:work.findings, followups:work.followups, reportIssued:view.versions.length>0})],
    ["Objeto", audit.title], ["Alcance", audit.scope], ["Referencias / normas", audit.referenceText], ["Referencia externa", audit.externalReference],
    ["Entidad auditada", audit.auditedEntityName || (audit.scenario !== "SUPPLIER" ? "COVEX" : null)], ["Dirección / lugar", audit.auditedEntityAddress], ["Entidad auditora / organismo", audit.auditingEntityName], ["Contacto externo", audit.auditedContact], ["Código entidad", audit.entityCode],
    ["Departamentos / áreas", departments.map(d => `${d.departmentCodeSnapshot} · ${d.departmentNameSnapshot}`).join("; ")], ["Área de referencia para codificación", audit.codingDepartmentCodeSnapshot],
    ["Fecha prevista", auditDate(audit.plannedDate)], ["Fecha realizada", auditDate(audit.performedDate)], ["Fecha apertura", auditDate(audit.openedAt)], ["Fecha cierre", auditDate(audit.closedAt)], ["Modalidad", audit.modality ? auditModalityLabels[audit.modality] : "—"], ["Control del dato", auditQualityLabels[audit.dataQualityStatus]], ["Observaciones internas", audit.internalObservations],
  ];
  // D-117 (H-05): en Información, los datos de la franja no se repiten en las tarjetas ni en la cabecera.
  const keyFactLabels = ["Estado", "Situación", "Escenario", "Fecha prevista", "Fecha realizada", "Fecha cierre"];
  const onInformation = tab === "information";
  const fieldGroups = [
    { key: "identity", heading: "Información", subtitle: "Identificación y situación", labels: ["Planificación", "Motivo fuera de plan", "Tipo", "Escenario", "Estado", "Situación", "Objeto"] },
    { key: "scope", heading: "Alcance y referencias", subtitle: "Contenido y criterios de auditoría", labels: ["Alcance", "Referencias / normas", "Referencia externa"] },
    { key: "entities", heading: "Entidades y áreas", subtitle: "Organizaciones, contactos y departamentos", labels: ["Entidad auditada", "Dirección / lugar", "Entidad auditora / organismo", "Contacto externo", "Código entidad", "Departamentos / áreas", "Área de referencia para codificación"] },
    { key: "dates", heading: "Fechas y control", subtitle: "Planificación, realización y datos administrativos", labels: ["Fecha prevista", "Fecha realizada", "Fecha apertura", "Fecha cierre", "Modalidad", "Control del dato", "Observaciones internas"] },
  ];
  return <ReviewWorkspaceProvider qmsRecordId={audit.qmsRecordId} module="AUDIT" basePath={basePath} currentVersionLabel={view.versions[0]?`V${String(view.versions[0].sequenceNumber).padStart(2,"0")}`:"Sin versión"} defaultActor={currentActor()} reviewMode={reviewMode} targets={reviewTargets} threads={reviewThreads} initialThreadId={query.thread}><section className={`workspace audit-detail-workspace${reviewMode ? " review-mode-active" : ""}`}><RecordHeader back={{ href: auditListingReturnTo(query.returnTo), label: "Auditorías" }} title={code === "Sin código" ? audit.title || "Auditoría sin código" : code} chips={<>{onInformation ? null : <><span className={`badge ${auditStatusBadgeClass(audit.status)}`}>{auditStatusLabels[audit.status]}</span>{audit.scenario ? <span className="badge neutral">{auditScenarioLabels[audit.scenario]}</span> : null}</>}{view.versions[0] ? <span className="badge neutral">Informe V{String(view.versions[0].sequenceNumber).padStart(2,"0")}</span> : null}</>} subtitle={onInformation ? undefined : <>{auditSituation({...audit, findings:work.findings, followups:work.followups, reportIssued:view.versions.length>0})}{audit.auditType ? ` · ${auditTypeLabels[audit.auditType]}` : ""}</>} annul={<QmsAdministrativeStatus part="action" qmsRecordId={qms.id} isActive={qms.isActive} code={code} annulledAt={qms.annulledAt?.toISOString()} annulledByText={qms.annulledByText} annulledReason={qms.annulledReason} defaultActor={currentActor()} reservesHistoricalCode/>} actions={<><PermissionGate permission="REVIEW"><ReviewModeToggle active={reviewMode} href={modeHref}/></PermissionGate><PermissionGate permission="CLOSE"><AuditCloseNavigation id={id} disabled={checklist.blockers.length>0 || audit.status === "CLOSED"}/></PermissionGate>{qms.isActive ? <PermissionGate permission="EDIT" form><a className="button primary" href={auditWithReturnTo(`/audits/${id}/edit`, query.returnTo)}>Editar / seguimiento</a></PermissionGate> : null}</>}/>
    <QmsAdministrativeStatus part="banner" qmsRecordId={qms.id} isActive={qms.isActive} code={code} annulledAt={qms.annulledAt?.toISOString()} annulledByText={qms.annulledByText} annulledReason={qms.annulledReason} defaultActor={currentActor()} reservesHistoricalCode/>
    <nav className="record-tabs">{auditTabs.map(([key,label]) => <Link className={tab === key ? "active" : ""} key={key} href={tabHref(key)}>{label}</Link>)}</nav>
    {tab === "information" ? <RecordKeyFacts facts={[{ label: "Estado", value: auditStatusLabels[audit.status], badgeClass: auditStatusBadgeClass(audit.status) }, { label: "Situación", value: auditSituation({...audit, findings:work.findings, followups:work.followups, reportIssued:view.versions.length>0}) }, { label: "Fecha prevista", value: auditDate(audit.plannedDate), anchorId: target("planning").anchorId, marker: <ReviewMarker target={target("planning")}/> }, { label: "Fecha realizada", value: auditDate(audit.performedDate) }, { label: "Escenario", value: audit.scenario ? auditScenarioLabels[audit.scenario] : null }, { label: "Cierre", value: auditDate(audit.closedAt) }]}/> : null}
    {tab === "information" ? <div className="audit-info-layout">{fieldGroups.map((group,index) => <section key={group.key} className={`card audit-info-section ${index===0?"audit-info-primary":""} ${index===0?"review-target":""}`} id={index===0?target("identification").anchorId:undefined}>
      <div className="audit-section-heading"><div><h2>{group.heading}</h2><p className="muted-note">{group.subtitle}</p></div>{index===0?<ReviewMarker target={target("identification")}/>:null}</div>
      <dl className="audit-detail-grid audit-info-grid">{fields.filter(([label])=>group.labels.includes(label as string)&&!keyFactLabels.includes(label as string)).map(([label,value]) => <div key={label} className={`audit-info-field ${label==="Objeto"||label==="Alcance"||label==="Observaciones internas"?"audit-info-wide":""} ${label==="Alcance"?"review-target":""}`} id={label==="Alcance"?target("scope").anchorId:undefined}>
        <dt>{label}{label==="Alcance"?<ReviewMarker target={target("scope")}/>:null}</dt><dd>{value||<EmptyValue/>}</dd>
      </div>)}</dl>{index===0?<small className="muted-note audit-qms-id">Identificador QMS: {qms.id}</small>:null}
    </section>)}<section className="card audit-info-section review-target" id={target("participants").anchorId}><div className="audit-section-heading"><div><h2>Equipo y participantes</h2><p className="muted-note">Personas registradas en el expediente y función asignada</p></div><ReviewMarker target={target("participants")}/></div>{participants.length?<ul className="audit-team">{participants.map(p=><li key={p.id}><strong>{p.displayName}</strong><span>{auditRoleLabels[p.role]}{p.position?` · ${p.position}`:""}{p.organization?` · ${p.organization}`:""}</span></li>)}</ul>:<p>Sin participantes registrados.</p>}</section></div> : tab === "findings" ? <AuditFindingsPanel work={work} users={users} edit={parseFindingEdit(query.edit)} returnTo={query.returnTo} showRetired={query.retired === "1" || reviewMode || Boolean(query.thread)}/> : tab === "followup" ? <><AuditCapaPlanCard audit={view.audit} versions={view.capaPlanVersions}/><AuditFollowupPanel work={work}/></> : tab === "relations" ? <AuditRelationsPanel work={work}/> : tab === "report" ? <AuditReportPanel view={view}/> : tab === "documents" ? <AuditDocumentsPanel view={view}/> : tab === "versions" ? <AuditVersionsPanel view={view}/> : tab === "review" ? <section className="card"><h2>Revisión</h2><ReviewStatusSummary/><nav className="heading-actions"><Link href={tabHref("review")}>Todas las versiones</Link>{view.versions.map(v=><Link key={v.id} href={`${tabHref("review")}&reviewVersion=${v.id}`}>V{String(v.sequenceNumber).padStart(2,"0")}</Link>)}</nav><ReviewThreadList recordVersionId={query.reviewVersion}/></section> : tab === "timeline" ? <RecordTimeline qmsRecordId={qms.id} showValues/> : tab === "audit-trail" ? <AuditTrailPanel rootKey={`QMS_RECORD:${qms.id}`} basePath={basePath} page={Number(query.auditPage)||1}/> : null}
  </section><ReviewDrawer/></ReviewWorkspaceProvider>;
}
export default async function AuditPage(...args: Parameters<typeof AuditPageAuthenticatedContent>) {
  return authorizedPage("src/app/audits/[id]/page.tsx", () => AuditPageAuthenticatedContent(...args), args);
}
