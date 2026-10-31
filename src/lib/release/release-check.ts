/**
 * D-131: reglas de una versión de la aplicación. Puras, para que las prueben los tests y las use
 * `pnpm release:check` antes de entregar una versión a IT.
 *
 * Número `MAYOR.MENOR.CORRECCIÓN`:
 * - CORRECCIÓN: arreglos sin cambios en la base de datos;
 * - MENOR: novedades, o cualquier cambio en la base de datos (migraciones);
 * - MAYOR: cambios que obligan a reorganizar el trabajo o los datos (por ejemplo, la puesta en marcha 1.0.0).
 */
export type Version = readonly [number, number, number];

export type ReleaseNote = {
  version: string;
  /** Fecha de preparación (AAAA-MM-DD). */
  date: string;
  /** Una o dos frases para los usuarios. */
  summary: string;
  changes: readonly string[];
  fixes: readonly string[];
  /** Lo que tienen que hacer Calidad o IT con esta versión (permisos, plantillas…). Vacío si nada. */
  actions: readonly string[];
  /** La versión cambia la base de datos (migraciones): IT hace copia previa y aplica las migraciones. */
  database: boolean;
};

export function parseVersion(value: string): Version | null {
  const match = /^(0|[1-9]\d{0,3})\.(0|[1-9]\d{0,3})\.(0|[1-9]\d{0,3})$/.exec(value.trim());
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}

export function compareVersions(a: Version, b: Version) {
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}

/** Fecha AAAA-MM-DD que existe (no 2026-13-01 ni 2026-02-30). */
function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Etiqueta de entrega: exactamente `vMAYOR.MENOR.CORRECCIÓN` (ni `v0.2.0-rc1` ni otras que empiecen por «v»). */
export function releaseTagVersion(tag: string): Version | null {
  return tag.startsWith("v") && !/\s/.test(tag) ? parseVersion(tag.slice(1)) : null;
}

/** Entrega anterior: la etiqueta de entrega de versión más alta, sin contar las que están en el propio commit. */
export function previousReleaseTag(tags: readonly string[], tagsAtHead: readonly string[]): string | null {
  const candidates = tags
    .filter((tag) => !tagsAtHead.includes(tag))
    .map((tag) => ({ tag, version: releaseTagVersion(tag) }))
    .filter((item): item is { tag: string; version: Version } => item.version !== null)
    .sort((a, b) => compareVersions(b.version, a.version));
  return candidates[0]?.tag ?? null;
}

/**
 * Cambios en `prisma/migrations` a partir de `git diff --no-renames --name-status`: las migraciones nuevas y cualquier
 * otro cambio (modificada, borrada…), que nunca se admite porque Prisma lo trataría como otra migración o rechazaría el historial.
 */
export function migrationChanges(nameStatus: string) {
  const added: string[] = [];
  const altered: string[] = [];
  for (const line of nameStatus.split("\n").filter(Boolean)) {
    const [status, file] = line.split("\t");
    if (!file?.startsWith("prisma/migrations/")) continue;
    if (status === "A" && /^prisma\/migrations\/[^/]+\/migration\.sql$/.test(file)) added.push(file.split("/")[2]);
    else if (status !== "A") altered.push(`${status} ${file}`);
  }
  return { added: added.sort(), altered };
}

/** Problemas de las notas de versión en conjunto: versiones válidas, sin repetir, de la más reciente a la más antigua. */
export function releaseNotesProblems(notes: readonly ReleaseNote[]): string[] {
  const problems: string[] = [];
  let previous: Version | null = null;
  for (const note of notes) {
    const version = parseVersion(note.version);
    if (!version) { problems.push(`Notas: «${note.version}» no es un número de versión MAYOR.MENOR.CORRECCIÓN.`); continue; }
    if (previous && compareVersions(version, previous) >= 0) problems.push(`Notas: la ${note.version} debe ir después de una versión mayor (de la más reciente a la más antigua, sin repetir).`);
    if (!validDate(note.date)) problems.push(`Notas ${note.version}: la fecha debe ser AAAA-MM-DD.`);
    if (!note.summary.trim()) problems.push(`Notas ${note.version}: falta el resumen.`);
    if (!note.changes.length && !note.fixes.length) problems.push(`Notas ${note.version}: no hay novedades ni correcciones.`);
    previous = version;
  }
  return problems;
}

export type ReleaseCheckInput = {
  /** Versión de package.json. */
  version: string;
  /** Versión de la entrega anterior (su package.json), si se conoce. */
  previousVersion: string | null;
  notes: readonly ReleaseNote[];
  /** Migraciones añadidas desde la entrega anterior; null si no se conoce la anterior. */
  newMigrations: readonly string[] | null;
  /** Migraciones ya entregadas que han cambiado (modificadas, borradas o renombradas). */
  alteredMigrations?: readonly string[];
  /** Primera entrega: no hay entrega anterior con la que comparar. Sin esto, faltar la anterior es un problema. */
  firstRelease?: boolean;
  /** Etiquetas de entrega que ya tiene el commit: deben coincidir con la versión. */
  tagsAtHead?: readonly string[];
};

/** Problemas que impiden entregar la versión. Lista vacía = se puede entregar. */
export function releaseProblems({ version, previousVersion, notes, newMigrations, alteredMigrations = [], firstRelease = false, tagsAtHead = [] }: ReleaseCheckInput): string[] {
  const problems = releaseNotesProblems(notes);
  if (previousVersion === null && !firstRelease) problems.push("No se encuentra la entrega anterior (etiqueta vX.Y.Z): trae las etiquetas (git fetch --tags) o indícala con --from; solo la primera entrega usa --first-release.");
  for (const change of alteredMigrations) problems.push(`Una migración ya entregada ha cambiado (${change}): las migraciones entregadas no se modifican, renombran ni borran; los cambios van en una migración nueva.`);
  for (const tag of tagsAtHead.filter((item) => releaseTagVersion(item) && item !== `v${version}`)) problems.push(`El commit ya tiene la etiqueta ${tag}, que no coincide con la versión ${version} de package.json.`);
  const current = parseVersion(version);
  if (!current) return [...problems, `package.json: «${version}» no es un número de versión MAYOR.MENOR.CORRECCIÓN.`];
  const note = notes.find((item) => item.version === version);
  if (!note) problems.push(`Faltan las notas de la versión ${version} (src/lib/release/release-notes.ts).`);
  else if (notes[0] !== note) problems.push(`Las notas de la versión ${version} deben ser las primeras de la lista.`);
  const previous = previousVersion === null ? null : parseVersion(previousVersion);
  if (previousVersion !== null && !previous) problems.push(`La entrega anterior tiene un número de versión no válido («${previousVersion}»).`);
  if (previous && compareVersions(current, previous) <= 0) problems.push(`La versión ${version} debe ser mayor que la de la entrega anterior (${previousVersion}).`);
  if (note && newMigrations) {
    if (newMigrations.length && !note.database) problems.push(`Hay ${newMigrations.length} migración(es) nueva(s), pero las notas de la ${version} no indican cambios en la base de datos.`);
    if (!newMigrations.length && note.database) problems.push(`Las notas de la ${version} indican cambios en la base de datos, pero no hay migraciones nuevas.`);
  }
  if (previous && newMigrations?.length && current[0] === previous[0] && current[1] === previous[1]) problems.push(`Con cambios en la base de datos la versión sube al menos el número MENOR (${previous[0]}.${previous[1] + 1}.0), no solo la corrección.`);
  return problems;
}
