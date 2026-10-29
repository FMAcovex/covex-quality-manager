import Link from "next/link";
import { FormWithIndex } from "@/components/form-with-index";
import { PermissionGate } from "@/components/permissions";
import { currentActor } from "@/lib/auth/presentation";
import { authorizedPage } from "@/lib/auth/page-guard";
import { appUserOptions } from "@/lib/auth/app-users";
import { createChangeControlAction } from "@/modules/change-control/actions";
import { ChangeControlForm } from "@/modules/change-control/components/change-control-form";
import { getChangeControlLookups } from "@/modules/change-control/queries";
import { changeModelDefaults, listChangeModels } from "@/modules/change-control/models";

export const dynamic = "force-dynamic";

async function NewChangeControlPageAuthenticatedContent({ searchParams }: { searchParams: Promise<{ model?: string }> }) {
  const { model: modelId } = await searchParams;
  const [{ departments }, users, models] = await Promise.all([getChangeControlLookups(), appUserOptions(), listChangeModels({ activeOnly: true })]);
  // D-122: solo modelos activos; un id desconocido o inactivo deja el alta vacía, como siempre.
  const model = models.find((item) => item.id === modelId) ?? null;
  return (
    <section className="workspace">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Controles de Cambios</p>
          <h1>Nuevo Control de Cambio</h1>
          <p>Solicitud y Dictamen conforme a GC-00/003/03.</p>
        </div>
      </div>
      {models.length ? (
        <form method="get" className="change-model-picker" aria-label="Partir de un modelo">
          <label className="field"><span>Partir de un modelo</span>
            <select name="model" defaultValue={model?.id ?? ""}>
              <option value="">Sin modelo</option>
              {models.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <button className="button" type="submit">Aplicar modelo</button>
          {model ? <Link className="button" href="/changes/new">Quitar modelo</Link> : null}
        </form>
      ) : null}
      {model ? <p className="analytics-note" role="status"><strong>Prerrellenado con el modelo «{model.name}».</strong> Revisa y completa todos los campos antes de guardar; nada se guarda hasta que pulses Guardar.{model.purpose ? ` ${model.purpose}` : ""}</p> : null}
      <PermissionGate permission="CREATE"><FormWithIndex id="record-form-body"><ChangeControlForm
        key={model?.id ?? "sin-modelo"}
        mode="create"
        action={createChangeControlAction}
        departments={departments}
        users={users}
        fromModelId={model?.id}
        fromModelVersion={model?.version}
        defaults={{
          ...(model ? changeModelDefaults(model) : {}),
          requestDate: new Date().toISOString().slice(0, 10),
          requesterName: currentActor(),
          finalStatus: "DRAFT",
        }}
      /></FormWithIndex></PermissionGate>
    </section>
  );
}

export default async function NewChangeControlPage(...args: Parameters<typeof NewChangeControlPageAuthenticatedContent>) {
  return authorizedPage("src/app/changes/new/page.tsx", () => NewChangeControlPageAuthenticatedContent(...args), args);
}
