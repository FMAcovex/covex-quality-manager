import { FormWithIndex } from "@/components/form-with-index";
import { PermissionGate } from "@/components/permissions";
import { authorizedPage } from "@/lib/auth/page-guard";
import { currentActor } from "@/lib/auth/presentation";
import { createOosAction } from "@/modules/oos/actions";
import { OosForm } from "@/modules/oos/components/oos-form";
import { getOosDepartments } from "@/modules/oos/queries";

export const dynamic = "force-dynamic";

async function NewOosPageAuthenticatedContent() {
  const departments = await getOosDepartments();
  const qualityControl = departments.find((department) => department.code === "GC-10");
  const defaults = { status: "DRAFT" as const, issueDate: new Date().toISOString().slice(0, 10), createdByText: currentActor(), departmentId: qualityControl?.id };
  return <section className="workspace">
    <div className="page-heading"><div><p className="eyebrow">OOS</p><h1>Nuevo OOS</h1><p>GC-10/014/04 · resultados fuera de especificación.</p></div></div>
    <PermissionGate permission="CREATE"><FormWithIndex id="record-form-body"><OosForm mode="create" action={createOosAction} departments={departments} defaults={defaults} /></FormWithIndex></PermissionGate>
  </section>;
}

export default async function NewOosPage(...args: Parameters<typeof NewOosPageAuthenticatedContent>) {
  return authorizedPage("src/app/oos/new/page.tsx", () => NewOosPageAuthenticatedContent(...args), args);
}
