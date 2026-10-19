import { randomUUID } from "node:crypto";
import { PermissionGate } from "@/components/permissions";
import { currentActor } from "@/lib/auth/presentation";
import { AuditReportForm } from "./report-form";
import { establishCapaPlanAction } from "./capa-plan-actions";
import { auditDate } from "./domain";
import { capaPlanDefaultDate, capaPlanKindLabels, capaPlanSequenceLabel } from "./capa-plan-domain";
import type { CapaPlanVersionSummary } from "./capa-plan-service";

const versionHref = (auditId: string, sequence: number) => `/api/audits/${auditId}/documents?capaPlanVersion=${sequence}`;
const today = () => new Date().toISOString().slice(0, 10);
function VersionLink({ auditId, version }: { auditId: string; version: CapaPlanVersionSummary }) {
  return <PermissionGate permission="DOWNLOAD"><a className="button small" href={versionHref(auditId, version.sequenceNumber)}>CAPA plan · {capaPlanSequenceLabel(version.sequenceNumber)}</a></PermissionGate>;
}
/** D-110 (R5C1): estado del CAPA plan en Seguimiento y alta de la versión 00. */
export function AuditCapaPlanCard({ auditId, status, active, capaPlanDate, versions }: { auditId: string; status: string; active: boolean; capaPlanDate: Date | null; versions: CapaPlanVersionSummary[] }) {
  const current = versions[0];
  return <section className="card audit-panel-intro"><div className="audit-panel-heading"><div><h2>CAPA plan</h2><p className="muted-note">Versiones propias 00, 01…, independientes del informe. Cada versión congela hallazgos, acciones y vínculos con su A4.03.</p></div></div>
    {current ? <><p>Versión vigente {capaPlanSequenceLabel(current.sequenceNumber)} · {capaPlanKindLabels[current.kind]} · {auditDate(current.generatedAt)} · {current.generatedBy}</p><div className="heading-actions"><VersionLink auditId={auditId} version={current}/></div></>
      : <><p className="muted-note">CAPA plan sin establecer. Al establecerlo se congela como versión 00 lo registrado hasta ahora, aunque esté incompleto.</p>
        {!active ? null : status === "DRAFT" ? <p className="muted-note">Abre la auditoría para establecer el CAPA plan.</p> : status === "OPEN" ? <PermissionGate permission="EDIT"><AuditReportForm action={establishCapaPlanAction.bind(null, auditId)} label="Establecer CAPA plan (versión 00)" fields={[{ name: "capaPlanDate", label: "Fecha del CAPA plan", type: "date", value: capaPlanDefaultDate(capaPlanDate, today()), required: true }, { name: "actor", label: "Responsable", value: currentActor(), required: true }, { name: "requestId", label: "", type: "hidden", value: randomUUID() }]}/></PermissionGate> : null}</>}
  </section>;
}
/** Secuencia «CAPA plan» de la pestaña Versiones. */
export function AuditCapaPlanVersionsSection({ auditId, versions }: { auditId: string; versions: CapaPlanVersionSummary[] }) {
  return <section className="card"><h2>CAPA plan</h2>{versions.length ? <ul className="audit-version-downloads">{versions.map(v => <li key={v.id}><strong>Versión {capaPlanSequenceLabel(v.sequenceNumber)}</strong> · {capaPlanKindLabels[v.kind]} · {auditDate(v.generatedAt)} · {v.generatedBy}{v.observations ? <p className="prose-value">{v.observations}</p> : null}<div className="heading-actions"><VersionLink auditId={auditId} version={v}/></div></li>)}</ul> : <p className="muted-note">CAPA plan sin establecer: se establece en Seguimiento.</p>}</section>;
}
