import { authorizedPage } from "@/lib/auth/page-guard";
import { parseOverviewFilters } from "@/modules/controlled-documents/readings/overview";
import { ReadingsOverview } from "@/modules/controlled-documents/readings/overview-panel";
export const dynamic = "force-dynamic";

/** D-141, entrega 2: lecturas pendientes de todos los PNT y asignación masiva. */
async function ReadingsPageAuthenticatedContent({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <ReadingsOverview filters={parseOverviewFilters(await searchParams)} />;
}

export default async function ReadingsPage(...args: Parameters<typeof ReadingsPageAuthenticatedContent>) {
  return authorizedPage("src/app/controlled-documents/readings/page.tsx", () => ReadingsPageAuthenticatedContent(...args), args);
}
