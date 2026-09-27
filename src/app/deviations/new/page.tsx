import Link from "next/link";
import { createDeviationAction } from "@/modules/deviations/actions";
import { DeviationForm } from "@/modules/deviations/components/deviation-form";
import { getDeviationFormLookups } from "@/modules/deviations/queries";

export const dynamic = "force-dynamic";

export default async function NewDeviationPage() {
  const { departments } = await getDeviationFormLookups();

  return (
    <section className="form-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Desviaciones</p>
          <h1>Nueva desviación</h1>
          <p>El expediente puede guardarse abierto y completarse a medida que avance la investigación.</p>
        </div>
        <Link className="button" href="/deviations">← Volver</Link>
      </div>
      <DeviationForm action={createDeviationAction} departments={departments} mode="create" />
    </section>
  );
}
