import { PermissionGate } from "@/components/permissions";
import { authorizedPage } from "@/lib/auth/page-guard";
import { SettingsNav } from "@/components/settings-nav";
import { prisma } from "@/lib/db";
import { scopeLabels } from "@/modules/change-control/domain";
import { listChangeModels, modelTasks } from "@/modules/change-control/models";
import { createChangeModelAction, updateChangeModelAction } from "@/modules/change-control/model-actions";
import { ChangeModelForm, type ChangeModelValues } from "@/modules/change-control/components/change-model-form";

export const dynamic = "force-dynamic";

const empty: ChangeModelValues = { name: "", purpose: "", isActive: true, departmentId: "", scope: [], otherScope: "", changeDescription: "", justification: "", providedDocuments: "", tasks: [] };

async function ChangeModelsPageAuthenticatedContent() {
  const [models, departments] = await Promise.all([
    listChangeModels(),
    prisma.department.findMany({ where: { OR: [{ isActive: true }, { changeControlModels: { some: {} } }] }, select: { id: true, code: true, name: true, isActive: true }, orderBy: { code: "asc" } }),
  ]);
  const activeDepartments = departments.filter((department) => department.isActive);
  // Al editar, el departamento actual se conserva aunque se haya desactivado después.
  const departmentsFor = (departmentId: string | null) => departments.filter((department) => department.isActive || department.id === departmentId)
    .map((department) => department.isActive ? department : { ...department, name: `${department.name} (inactivo)` });
  return <section className="workspace">
    <div className="page-heading"><div><p className="eyebrow">Administración</p><h1>Modelos de Control de cambios</h1><p>Casos tipo para empezar un Control de cambios con los datos habituales de la solicitud y las acciones del plan.</p></div></div>
    <SettingsNav active="/settings/change-models" />
    <div className="analytics-note"><strong>Cómo funcionan:</strong> al dar de alta un cambio se elige un modelo y el formulario sale prerrellenado. Todo se puede cambiar y no se guarda nada hasta pulsar Guardar. Un modelo nunca rellena fechas, código, solicitante, decisiones, evaluación, clasificación, implicaciones ni el resultado del Dictamen. Los cambios de los modelos no modifican los expedientes ya creados.</div>

    <section className="card"><div className="section-title-row"><div><p className="eyebrow">Modelos</p><h2>{models.length ? `${models.length} modelos` : "Todavía no hay modelos"}</h2></div></div>
      {models.map((model) => {
        const values: ChangeModelValues = {
          id: model.id, updatedAt: model.updatedAt.toISOString(), name: model.name, purpose: model.purpose ?? "", isActive: model.isActive,
          departmentId: model.departmentId ?? "", scope: model.scope, otherScope: model.otherScope ?? "", changeDescription: model.changeDescription ?? "",
          justification: model.justification ?? "", providedDocuments: model.providedDocuments ?? "", tasks: modelTasks(model),
        };
        return <details key={model.id} className="change-model-item">
          <summary><strong>{model.name}</strong> <span className={`badge ${model.isActive ? "conforming" : "neutral"}`}>{model.isActive ? "Activo" : "Inactivo"}</span> <small className="muted-note">Versión {model.version}{model.department ? ` · ${model.department.code}` : ""}{model.scope.length ? ` · ${model.scope.map((s) => scopeLabels[s]).join(", ")}` : ""} · {modelTasks(model).length} acciones · modificado por {model.updatedByText}</small></summary>
          {model.purpose && <p className="section-help">{model.purpose}</p>}
          <PermissionGate permission="MANAGE_CONFIGURATION" module="SYSTEM" fallback={<p className="muted-note">Solo lectura.</p>}>
            <ChangeModelForm action={updateChangeModelAction.bind(null, model.id)} values={values} departments={departmentsFor(model.departmentId)} submitLabel="Guardar cambios" />
          </PermissionGate>
        </details>;
      })}
    </section>

    <PermissionGate permission="MANAGE_CONFIGURATION" module="SYSTEM">
      <section className="card"><div className="section-title-row"><div><p className="eyebrow">Nuevo</p><h2>Crear modelo</h2></div></div>
        <ChangeModelForm action={createChangeModelAction} values={empty} departments={activeDepartments} submitLabel="Crear modelo" />
      </section>
    </PermissionGate>
  </section>;
}

export default async function ChangeModelsPage(...args: Parameters<typeof ChangeModelsPageAuthenticatedContent>) {
  return authorizedPage("src/app/settings/change-models/page.tsx", () => ChangeModelsPageAuthenticatedContent(...args), args);
}
