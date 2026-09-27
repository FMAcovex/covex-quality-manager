import { createChangeControlAction } from "@/modules/change-control/actions";
import { ChangeControlForm } from "@/modules/change-control/components/change-control-form";
import { getChangeControlLookups } from "@/modules/change-control/queries";

export const dynamic = "force-dynamic";

export default async function NewChangeControlPage() {
  const { departments } = await getChangeControlLookups();
  return (
    <section className="workspace">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Controles de Cambios</p>
          <h1>Nuevo Control de Cambio</h1>
          <p>Solicitud y Dictamen conforme a GC-00/003/03.</p>
        </div>
      </div>
      <ChangeControlForm
        mode="create"
        action={createChangeControlAction}
        departments={departments}
        defaults={{
          requestDate: new Date().toISOString().slice(0, 10),
          requesterName: process.env.DEFAULT_ACTOR_NAME || "Usuario demo",
        }}
      />
    </section>
  );
}
