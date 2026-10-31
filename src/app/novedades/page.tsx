import { authorizedPage } from "@/lib/auth/page-guard";
import { releaseNotes } from "@/lib/release/release-notes";
import { appVersion } from "@/lib/release/version";

const longDate = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

function List({ title, items }: { title: string; items: readonly string[] }) {
  return items.length ? <><h3>{title}</h3><ul>{items.map((item) => <li key={item}>{item}</li>)}</ul></> : null;
}

/** D-131: novedades de cada versión, de la más reciente a la más antigua. */
function NovedadesPageAuthenticatedContent() {
  return (
    <section className="workspace">
      <div className="page-heading">
        <div>
          <p className="eyebrow">COVEX Quality Manager</p>
          <h1>Novedades</h1>
          <p className="muted-note">Versión instalada: <strong>{appVersion}</strong>. Cada versión se prueba antes de instalarla; la aplicación no está validada para uso GMP.</p>
        </div>
      </div>
      {releaseNotes.map((note) => (
        <article key={note.version} className="card">
          <h2>Versión {note.version}{note.version === appVersion ? " (instalada)" : ""}</h2>
          <p className="muted-note">{longDate.format(new Date(`${note.date}T00:00:00Z`))}{note.database ? " · incluye cambios en la base de datos" : ""}</p>
          <p>{note.summary}</p>
          <List title="Novedades" items={note.changes} />
          <List title="Correcciones" items={note.fixes} />
          <List title="Qué deben hacer Calidad o IT" items={note.actions} />
        </article>
      ))}
    </section>
  );
}

export default async function NovedadesPage() {
  return authorizedPage("src/app/novedades/page.tsx", () => NovedadesPageAuthenticatedContent());
}
