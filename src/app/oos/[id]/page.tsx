import Link from "next/link";
import { notFound } from "next/navigation";
import { AuditTrailPanel } from "@/components/audit-trail-panel";
import { PermissionGate } from "@/components/permissions";
import { QmsAdministrativeStatus } from "@/components/qms-administrative-status";
import { RecordTimeline } from "@/components/record-timeline";
import { authorizedPage } from "@/lib/auth/page-guard";
import { currentActor } from "@/lib/auth/presentation";
import { qmsListingReturnTo, qmsWithReturnTo } from "@/lib/qms/list-return-navigation";
import { qmsRecordDisplayCode } from "@/lib/qms/record-links";
import {
  formatOosDate,
  oosAreaLabels,
  oosInvestigationResultLabels,
  oosMaterialKindLabels,
  oosPhase,
  oosPhaseIDispositionLabels,
  oosPhaseIEvaluationGroups,
  oosStatusLabels,
  oosVerdictLabels,
  readOosEvaluation,
} from "@/modules/oos/domain";
import { getOosDetail } from "@/modules/oos/queries";

export const dynamic = "force-dynamic";

const txt = (value: string | null | undefined) => value || "—";

function Item({ label, children, full = false }: { label: string; children: React.ReactNode; full?: boolean }) {
  return <div className={`info-item${full ? " full" : ""}`}><dt>{label}</dt><dd>{children}</dd></div>;
}

function Verdict({ verdict, quantity, destroy, returned, other }: { verdict: keyof typeof oosVerdictLabels | null; quantity: string | null; destroy: string | null; returned: string | null; other: string | null }) {
  return <>
    <Item label="Dictamen">{verdict ? oosVerdictLabels[verdict] : "Pendiente"}</Item>
    <Item label="Cantidad">{txt(quantity)}</Item>
    <Item label="Destruir · cantidad">{txt(destroy)}</Item>
    <Item label="Devolver · cantidad">{txt(returned)}</Item>
    {verdict === "OTHER" ? <Item label="Otros · indicar" full>{txt(other)}</Item> : null}
  </>;
}

async function OosDetailPageAuthenticatedContent({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; returnTo?: string; auditPage?: string }>;
}) {
  const { id } = await params;
  const { tab: rawTab, returnTo, auditPage } = await searchParams;
  const record = await getOosDetail(id);
  if (!record) notFound();

  const phase = oosPhase(record.phaseIDisposition);
  const tabs = [
    ["summary", "Resumen"],
    ["phase-i", "Fase I"],
    ...(phase === "II" ? [["phase-ii", "Fase II"]] : []),
    ["timeline", "Cronología"],
    ["audit-trail", "Audit Trail"],
    ["history", "Historial"],
  ] as const;
  const tab = tabs.some(([key]) => key === rawTab) ? rawTab! : "summary";
  const basePath = `/oos/${id}`;
  const evaluation = readOosEvaluation(record.phaseIEvaluation);
  const statusBadge = record.status === "DRAFT" ? "neutral" : record.status === "OPEN" ? "open" : "closed";

  return <section className="workspace">
    <div className="record-header">
      <div>
        <p className="eyebrow"><Link href={qmsListingReturnTo("/oos", returnTo)}>← OOS</Link></p>
        <div className="record-title-line">
          <h1>{qmsRecordDisplayCode(record.qmsRecord)}</h1>
          <span className={`badge ${statusBadge}`}>{oosStatusLabels[record.status]}</span>
          {record.status !== "DRAFT" ? <span className="badge neutral">Fase {phase}</span> : null}
          {record.investigationResult ? <span className="badge neutral">{oosInvestigationResultLabels[record.investigationResult]}</span> : null}
        </div>
        <p className="muted-note">{record.area ? oosAreaLabels[record.area] : "Área pendiente"} · {txt(record.materialName)} · lote {txt(record.lotNumber)}</p>
      </div>
      <div className="record-actions">
        {record.qmsRecord.isActive ? <PermissionGate permission="EDIT" form><Link className="button primary" href={qmsWithReturnTo(`/oos/${id}/edit?tab=${tab}`, "/oos", returnTo)}>Editar</Link></PermissionGate> : null}
      </div>
    </div>

    {record.status === "DRAFT" ? <div className="analytics-note"><strong>Borrador:</strong> este OOS todavía no tiene código. Completa los datos iniciales y cambia el estado a Abierto para asignarlo.</div> : null}

    <QmsAdministrativeStatus
      qmsRecordId={record.qmsRecord.id}
      isActive={record.qmsRecord.isActive}
      code={qmsRecordDisplayCode(record.qmsRecord)}
      annulledAt={record.qmsRecord.annulledAt?.toISOString() ?? null}
      annulledByText={record.qmsRecord.annulledByText}
      annulledReason={record.qmsRecord.annulledReason}
      defaultActor={currentActor()}
    />

    <nav className="record-tabs">
      {tabs.map(([key, label]) => <Link key={key} className={tab === key ? "active" : ""} href={qmsWithReturnTo(`${basePath}?tab=${key}`, "/oos", returnTo)}>{label}</Link>)}
    </nav>

    {tab === "summary" ? <>
      <div className="card">
        <h2>Datos iniciales</h2>
        <dl className="info-grid">
          <Item label="Área">{record.area ? oosAreaLabels[record.area] : "—"}</Item>
          <Item label="Departamento">{record.departmentCodeSnapshot ?? record.department?.code ?? "—"}</Item>
          <Item label="Fecha de emisión">{formatOosDate(record.issueDate)}</Item>
          <Item label="Cumplimentado por">{txt(record.createdByText)}</Item>
          <Item label="Material afectado">{record.materialKind ? oosMaterialKindLabels[record.materialKind] : "—"}</Item>
          <Item label="Producto / material">{txt(record.materialName)}</Item>
          <Item label="N.º lote">{txt(record.lotNumber)}</Item>
          <Item label="Tamaño lote">{txt(record.batchSize)}</Item>
          <Item label="Cantidad afectada">{txt(record.affectedQuantity)}</Item>
          {record.materialKind === "RAW_OR_PACKAGING_MATERIAL" ? <>
            <Item label="Proveedor">{txt(record.supplier)}</Item>
            <Item label="Lote proveedor">{txt(record.supplierLot)}</Item>
          </> : null}
          <Item label="Proceso">{txt(record.process)}</Item>
          <Item label="Fecha / hora del OOS">{formatOosDate(record.oosDate)}{record.oosTime ? ` · ${record.oosTime}` : ""}</Item>
          <Item label="Detectado por">{txt(record.detectedBy)}</Item>
          <Item label="Turno">{txt(record.shift)}</Item>
        </dl>
      </div>
      <div className="card">
        <h2>Detección del fuera de especificaciones</h2>
        <p className="prose-value">{txt(record.detectionDescription)}</p>
      </div>
      <div className="card">
        <h2>Resultado</h2>
        <dl className="info-grid">
          <Item label="Fase">{record.status === "DRAFT" ? "—" : `Fase ${phase}`}</Item>
          <Item label="Disposición de la Fase I">{record.phaseIDisposition ? oosPhaseIDispositionLabels[record.phaseIDisposition] : "Pendiente"}</Item>
          <Item label="Resultado de la investigación">{record.investigationResult ? oosInvestigationResultLabels[record.investigationResult] : "Pendiente"}</Item>
          <Item label="Fecha de cierre">{formatOosDate(record.closedAt)}</Item>
        </dl>
      </div>
      {record.internalObservations ? <div className="card"><h2>Observaciones internas</h2><p className="prose-value">{record.internalObservations}</p></div> : null}
    </> : null}

    {tab === "phase-i" ? <>
      <div className="card">
        <h2>Evaluación del fuera de especificación</h2>
        <div className="table-scroll"><table className="records-table">
          <thead><tr><th>Parámetro</th><th>Resultado</th></tr></thead>
          <tbody>{oosPhaseIEvaluationGroups.map((group) => [
            <tr key={group.key}><th colSpan={2}>{group.label}</th></tr>,
            ...group.items.map((item) => <tr key={item.key}><td>{item.label}</td><td>{txt(evaluation[item.key])}</td></tr>),
          ])}</tbody>
        </table></div>
      </div>
      <div className="card">
        <h2>Investigación en el laboratorio</h2>
        <dl className="info-grid">
          <Item label="Investigación (causa raíz)" full><span className="prose-value">{txt(record.phaseIInvestigation)}</span></Item>
          <Item label="Conclusiones" full><span className="prose-value">{txt(record.phaseIConclusion)}</span></Item>
          <Item label="Disposición final">{record.phaseIDisposition ? oosPhaseIDispositionLabels[record.phaseIDisposition] : "Pendiente"}</Item>
          <Verdict verdict={record.phaseIVerdict} quantity={record.phaseIVerdictQuantity} destroy={record.phaseIDestroyQuantity} returned={record.phaseIReturnQuantity} other={record.phaseIVerdictOther} />
          <Item label="Emitido por · Control de Calidad">{txt(record.phaseIIssuedBy)} · {formatOosDate(record.phaseIIssuedAt)}</Item>
          <Item label="Aprobado por · Garantía de Calidad">{txt(record.phaseIApprovedBy)} · {formatOosDate(record.phaseIApprovedAt)}</Item>
        </dl>
      </div>
    </> : null}

    {tab === "phase-ii" ? <div className="card">
      <h2>Investigación a gran escala</h2>
      <dl className="info-grid">
        <Item label="Fecha de emisión">{formatOosDate(record.phaseIIIssueDate)}</Item>
        <Item label="Revisión de la producción" full><span className="prose-value">{txt(record.phaseIIProductionReview)}</span></Item>
        <Item label="Repetición de pruebas" full><span className="prose-value">{txt(record.phaseIIRetesting)}</span></Item>
        <Item label="Remuestreo" full><span className="prose-value">{txt(record.phaseIIResampling)}</span></Item>
        <Item label="Conclusión de la investigación" full><span className="prose-value">{txt(record.phaseIIConclusion)}</span></Item>
        <Verdict verdict={record.phaseIIVerdict} quantity={record.phaseIIVerdictQuantity} destroy={record.phaseIIDestroyQuantity} returned={record.phaseIIReturnQuantity} other={record.phaseIIVerdictOther} />
        <Item label="Emitido por · Garantía de Calidad">{txt(record.phaseIIIssuedBy)} · {formatOosDate(record.phaseIIIssuedAt)}</Item>
        <Item label="Departamentos afectados" full><span className="prose-value">{txt(record.phaseIIAffectedDepartments)}</span></Item>
      </dl>
    </div> : null}

    {tab === "timeline" ? <RecordTimeline qmsRecordId={record.qmsRecord.id} /> : null}
    {tab === "audit-trail" ? <AuditTrailPanel rootKey={`QMS_RECORD:${record.qmsRecord.id}`} basePath={basePath} page={Number(auditPage) || 1} /> : null}

    {tab === "history" ? <div className="card">
      <h2>Historial interno de modificaciones</h2>
      <p className="muted-note">Historial operativo del expediente; no constituye audit trail GMP validado.</p>
      {record.qmsRecord.history.length ? <div className="timeline">
        {record.qmsRecord.history.map((item) => <div className="timeline-item history-entry" key={item.id}>
          <header><strong>{formatOosDate(item.changedAt)}</strong><span>{item.changedByText ?? "Sistema"}</span><span className="badge neutral">{item.source}</span></header>
          <p className="history-entry-detail"><strong>{item.fieldPath}</strong>{item.reason ? <span> · Motivo: {item.reason}</span> : null}</p>
        </div>)}
      </div> : <div className="empty-panel">Sin cambios registrados.</div>}
    </div> : null}
  </section>;
}

export default async function OosDetailPage(...args: Parameters<typeof OosDetailPageAuthenticatedContent>) {
  return authorizedPage("src/app/oos/[id]/page.tsx", () => OosDetailPageAuthenticatedContent(...args), args);
}
