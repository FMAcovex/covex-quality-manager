const MAX = 60;

/** Id estable para un apartado a partir de su título («E. Investigación» → «apartado-e-investigacion»), sin repetir. */
export function sectionAnchorId(title: string, used: Set<string>): string {
  const slug = title.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const base = (slug ? `apartado-${slug}` : "apartado").slice(0, MAX).replace(/-+$/, "");
  let id = base, n = 2;
  while (used.has(id)) id = `${base.slice(0, MAX - String(n).length - 1)}-${n++}`;
  used.add(id);
  return id;
}
