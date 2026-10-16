export type GlobalSearchHit = Readonly<{
  id: string;
  code: string;
  summary: string;
  annulled: boolean;
  href: string;
}>;

/** Búsqueda propia de un módulo: devuelve candidatos sin ordenar por relevancia. */
export type ModuleSearchProvider = (query: string, take: number) => Promise<GlobalSearchHit[]>;
