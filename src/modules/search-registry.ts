import "server-only";
import type { QmsModuleKey } from "@/modules/contract";
import { searchAudits } from "@/modules/audits/search";
import { searchCapa } from "@/modules/capa/search";
import { searchChangeControls } from "@/modules/change-control/search";
import { searchComplaints } from "@/modules/complaints/search";
import { searchControlledDocuments } from "@/modules/controlled-documents/search";
import { searchDeviations } from "@/modules/deviations/search";
import { searchOos } from "@/modules/oos/search";
import { qmsModules } from "@/modules/registry";
import { searchReturns } from "@/modules/returns/search";
import { rankHits } from "@/modules/search/ranking";
import type { GlobalSearchHit, ModuleSearchProvider } from "@/modules/search/types";

/** Búsqueda de servidor de cada módulo; separada del registro declarativo como los hooks de relación. */
export const moduleSearchProviders: Readonly<Record<QmsModuleKey, ModuleSearchProvider>> = {
  DEVIATION: searchDeviations,
  CAPA: searchCapa,
  CHANGE_CONTROL: searchChangeControls,
  COMPLAINT: searchComplaints,
  RETURN: searchReturns,
  AUDIT: searchAudits,
  OOS: searchOos,
  PNT: searchControlledDocuments,
};

export const GLOBAL_SEARCH_PER_MODULE = 5;
const CANDIDATES_PER_MODULE = 20;

export type GlobalSearchGroup = Readonly<{
  key: QmsModuleKey;
  label: string;
  listHref: string;
  hits: GlobalSearchHit[];
  more: boolean;
}>;

/** Busca en todos los módulos del registro, en su orden, y devuelve solo los grupos con resultados. */
export async function globalSearch(query: string): Promise<GlobalSearchGroup[]> {
  const groups = await Promise.all(qmsModules.map(async (contract) => {
    const ranked = rankHits(query, await moduleSearchProviders[contract.key](query, CANDIDATES_PER_MODULE));
    return {
      key: contract.key,
      label: contract.labels.plural,
      listHref: `${contract.href}?q=${encodeURIComponent(query)}`,
      hits: ranked.slice(0, GLOBAL_SEARCH_PER_MODULE),
      more: ranked.length > GLOBAL_SEARCH_PER_MODULE,
    };
  }));
  return groups.filter((group) => group.hits.length > 0);
}
