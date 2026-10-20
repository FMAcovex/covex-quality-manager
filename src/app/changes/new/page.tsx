import { FormWithIndex } from "@/components/form-with-index";
import { PermissionGate } from "@/components/permissions";
import { currentActor } from "@/lib/auth/presentation";
import { authorizedPage } from "@/lib/auth/page-guard";
import { appUserOptions } from "@/lib/auth/app-users";
import { createChangeControlAction } from "@/modules/change-control/actions";
import { ChangeControlForm } from "@/modules/change-control/components/change-control-form";
import { getChangeControlLookups } from "@/modules/change-control/queries";

export const dynamic = "force-dynamic";

async function NewChangeControlPageAuthenticatedContent() {
  const [{ departments }, users] = await Promise.all([getChangeControlLookups(), appUserOptions()]);
  return (
    <section className="workspace">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Controles de Cambios</p>
          <h1>Nuevo Control de Cambio</h1>
          <p>Solicitud y Dictamen conforme a GC-00/003/03.</p>
        </div>
      </div>
      <PermissionGate permission="CREATE"><FormWithIndex id="record-form-body"><ChangeControlForm
        mode="create"
        action={createChangeControlAction}
        departments={departments}
        users={users}
        defaults={{
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
