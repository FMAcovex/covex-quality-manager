import { authorizedPage } from "@/lib/auth/page-guard";
import Link from "next/link";
import { createDeviationAction } from "@/modules/deviations/actions";
import { DeviationForm } from "@/modules/deviations/components/deviation-form";
import { getDeviationFormLookups } from "@/modules/deviations/queries";

export const dynamic = "force-dynamic";

async function NewDeviationPageAuthenticatedContent() {
  const { departments } = await getDeviationFormLookups();

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
      <DeviationForm action={createDeviationAction} departments={departments} mode="create" />
    </section>
  );
}

export default async function NewDeviationPage(...args: Parameters<typeof NewDeviationPageAuthenticatedContent>) {
  return authorizedPage("src/app/deviations/new/page.tsx", () => NewDeviationPageAuthenticatedContent(...args));
}
