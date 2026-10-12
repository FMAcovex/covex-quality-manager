import { authorizedPage } from "@/lib/auth/page-guard";
import { DocumentLink } from "@/modules/controlled-documents/components/document-link";
import { IndexPreview } from "@/modules/controlled-documents/components/index-preview";
function ImportIndexPageAuthenticatedContent() { return <section className="workspace"><DocumentLink href="/controlled-documents">Volver al listado</DocumentLink><h1>Importar índice maestro</h1><IndexPreview /></section>; }

export default async function ImportIndexPage(...args: Parameters<typeof ImportIndexPageAuthenticatedContent>) {
  return authorizedPage("src/app/controlled-documents/import-index/page.tsx", () => ImportIndexPageAuthenticatedContent(...args), args);
}
