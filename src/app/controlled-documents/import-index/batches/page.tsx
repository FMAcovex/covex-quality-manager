import { authorizedPage } from "@/lib/auth/page-guard";
import { DocumentLink } from "@/modules/controlled-documents/components/document-link";
import { listBatches } from "@/modules/controlled-documents/import/service";
import { displayDate } from "@/modules/controlled-documents/domain";
export const dynamic = "force-dynamic";
async function BatchesPageAuthenticatedContent() {
    const batches = await listBatches();
    return <section className="workspace"><DocumentLink href="/controlled-documents/import-index">Analizar otro índice</DocumentLink><h1>Lotes de importación PNT</h1><p>Staging pendiente: 30 días, hasta 100 lotes y 16 MiB por análisis. Los resultados confirmados conservan su historial operativo.</p><ul>{batches.map(b => <li key={b.id}><DocumentLink href={`/controlled-documents/import-index/${b.id}`}>{b.fileName} — {b.id}</DocumentLink> · {b.state} · {b.actor} · {displayDate(b.createdAt)} · retención pendiente hasta {displayDate(b.expiresAt)}</li>)}</ul>{!batches.length && <p>No hay lotes.</p>}</section>;
}

export default async function BatchesPage(...args: Parameters<typeof BatchesPageAuthenticatedContent>) {
  return authorizedPage("src/app/controlled-documents/import-index/batches/page.tsx", () => BatchesPageAuthenticatedContent(...args));
}
