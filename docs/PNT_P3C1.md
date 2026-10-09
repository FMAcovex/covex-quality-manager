# P3C-1 — Maquetación responsive y estructura visual base PNT

Baseline: main `8705687954426f7cb38002d709f5c1ab123c0490` (P2C fusionada). Rama `feature/pnt-p3c1-layout-responsive`.

## Decisiones visuales

- Se conserva la estética corporativa QMS: `page-heading`, `record-header`, `record-tabs`, `card`, `info-grid`, `form-section`, `field`, `button`, `table-card` y `table-scroll`, existentes en Desviaciones/CAPA.
- Alta/edición del maestro y alta/edición de revisión usan bloques apilados: identidad, revisión cuando procede, metadatos y acciones. Grids de dos columnas a 1440/768 px y una a 390 px; título, motivos, referencias y observaciones a ancho completo. Etiquetas siguen asociadas mediante su label y se conserva la validación actual.
- Listado: cabecera y acciones visibles, filtros en tres/dos/una columnas según ancho, tabla con textos envolventes y seis columnas conservadas. En tablet/móvil se mantiene tabla con desplazamiento horizontal dentro de una región accesible por teclado; no se añaden tarjetas duplicadas ni se omiten datos. Paginación separada.
- Ficha: código y título diferenciados, estado administrativo y departamento, pestaña activa visible. Información y revisiones reutilizan grids y tarjetas QMS; las revisiones conservan el orden descendente, todos sus campos, avisos y condiciones de edición.
- CSS ubicado en `src/app/controlled-documents/pnt.css`, limitado mediante clases PNT. No se modifica `globals.css` ni componentes de otros módulos. El contenedor exterior de las pestañas documentales controla el desbordamiento sin cambiar su contenido interno.

## Alcance conservado

Sin modificaciones de servicios, consultas, acciones de servidor, estados, validaciones de negocio, snapshots, autorizaciones, modelos ni migraciones. Los nombres, operaciones, obligatoriedad y ayudas documentales de los formularios se conservan. Historial, documentos, verificación/aprobaciones e importación mantienen sus componentes y lógica.

## Validación

- 88 tests afectados PNT (11 archivos), incluidos acceso e historial documental.
- Smokes PostgreSQL existentes: P1A, P1B-1, P1B-2, P2A, P2B y P2C.
- Smokes Chromium existentes de esos seis bloques. P1B-2 adapta únicamente el selector de revisión: comprueba código y estado exactos en la misma tarjeta, ahora separados visualmente; se mantienen sus aserciones SQL y de snapshots.
- Nuevo `pnpm pnt-p3c1:ui:smoke`, incorporado a la CI PNT existente: alta/edición, campos condicionales de registro histórico, alta/edición de revisión, listado y cinco pestañas a 1440/768/390 px. Comprueba ancho global, hit testing de campos para detectar solapamientos, etiquetas, pestaña activa, foco visible, navegación y scroll de tabla por teclado. La lectura conserva íntegramente estados, UUID, documentos, decisiones y snapshots.
- Capturas opcionales mediante `P3C1_SCREENSHOT_DIR`, solo con fixtures sintéticos fuera del repositorio. Revisión visual local de escritorio/tablet/móvil.
- Reinicio con gateway sintético y smokes P2A/P2B/P2C de acceso/persistencia superados. `pnpm quality` final verde: Prisma, lint, 434 tests/78 archivos y build de producción. Se mantienen dos warnings de Hooks preexistentes de CAPA/Controles de cambios, fuera de alcance. CI y SHA definitivos en la PR.

## Pendientes para P3C-2

Se mantienen expresamente fuera de esta fase los filtros contradictorios, pérdida de contexto al volver al listado, mensajes funcionales incorrectos de revisiones y obligatoriedad condicional no anticipada. También quedan pendientes la identificación/etiquetas del Historial, densidad técnica y formularios internos de Documentos/Verificación, conciliación Excel y acceso desde Inicio/navegación global. Su contenido no se reinterpreta ni corrige mediante este cambio visual.

La región exterior controla el ancho de pestañas no rediseñadas; sus formularios internos pueden necesitar desplazamiento horizontal hasta su fase correspondiente. No se declara conformidad GMP ni validación regulatoria.
