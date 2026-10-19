import { appUserOptions } from "@/lib/auth/app-users";
import { PermissionGate } from "@/components/permissions";
import { authorizedPage } from "@/lib/auth/page-guard";
import Link from "next/link";
import { createDeviationAction } from "@/modules/deviations/actions";
import { DeviationForm } from "@/modules/deviations/components/deviation-form";
import { getDeviationFormLookups } from "@/modules/deviations/queries";
import { getAuditFindingOrigin } from "@/modules/audits/finding-queries";

export const dynamic = "force-dynamic";

async function NewDeviationPageAuthenticatedContent({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const fromAuditFindingId = typeof params.fromAuditFindingId === "string" ? params.fromAuditFindingId : undefined;
  const [{ departments }, users, auditFinding] = await Promise.all([getDeviationFormLookups(), appUserOptions(), fromAuditFindingId ? getAuditFindingOrigin(fromAuditFindingId) : Promise.resolve(null)]);
  // R5B2: desviación abierta desde un hallazgo de auditoría.
  const defaults = auditFinding ? {
    departmentId: auditFinding.departmentId ?? undefined,
    provenance: "OTHER",
    otherOrigin: `Auditoría ${auditFinding.auditLabel} · ${auditFinding.reference}`,
    whatHappened: auditFinding.description,
  } : undefined;

  return (
    <section className="form-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Desviaciones</p>
          <h1>Nueva desviación</h1>
          <p>Puedes guardar un borrador incompleto y abrir la desviación cuando estén cumplimentados los campos obligatorios.</p>
        </div>
        <Link className="button" href="/deviations">← Volver</Link>
      </div>
      {auditFinding ? <div className="analytics-note"><strong>Origen:</strong> esta desviación se está creando desde el hallazgo {auditFinding.reference} de la auditoría {auditFinding.auditLabel}. Al guardarla, como borrador o abierta, queda vinculada al hallazgo.</div> : null}
      <PermissionGate permission="CREATE"><DeviationForm action={createDeviationAction} departments={departments} users={users} mode="create" defaults={defaults} fromAuditFindingId={auditFinding ? auditFinding.findingId : undefined} /></PermissionGate>
    </section>
  );
}

export default async function NewDeviationPage(...args: Parameters<typeof NewDeviationPageAuthenticatedContent>) {
  return authorizedPage("src/app/deviations/new/page.tsx", () => NewDeviationPageAuthenticatedContent(...args), args);
}
