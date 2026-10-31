# Estado vigente — corte 2026-10-14

**Actualización 2026-10-16:** 4B3 (B2 + C) está integrada en main mediante #143 (`a1d61d8`); la mención «No hay PR de la rama» del párrafo siguiente queda superada. Diseño del contrato de módulo QMS aprobado (D-083) en [MODULE_CONTRACT.md](MODULE_CONTRACT.md), solo como documentación: sin cambios de código, schema, relaciones ni comportamiento. Implementación pendiente por PR 2–5 con aprobación de alcance propia.

**Contrato de módulo — PR 2 (2026-10-16):** registro `src/modules/registry.ts` con contratos declarativos de los seis módulos `QmsRecord`. La matriz de relaciones y sus etiquetas se derivan de los contratos, y las reglas propias de Auditorías, Reclamaciones y Devoluciones pasan a hooks de módulo sin cambiar lógica ni orden de bloqueos. Matriz idéntica comprobada por test de equivalencia. El inventario de escritores del audit trail solo cambia en números de línea. Sin cambios de schema, datos, permisos, interfaz ni comportamiento.

**Contrato de módulo — PR 2-bis (2026-10-16):** MC-2 y MC-4 etapa 1 (D-083). Se retira el formulario de alta de relaciones de Control de Cambios, que siempre terminaba en «Relación no permitida», junto con su acción de servidor `addChangeControlRelationAction` y sus entradas en el inventario de operaciones y en el mapa de operaciones del audit trail. La operación CC06 se conserva para anulación y reactivación. La pestaña Relaciones mantiene la consulta y una nota aclaratoria. Se elimina `src/lib/qms/relations.ts`, código sin uso que contenía los tipos de relación retirados. Los tipos permanecen en el enum Prisma hasta la etapa 2. El inventario de escritores solo cambia en números de línea y huella del fichero. Sin cambios de schema ni datos.

**Contrato de módulo — PR 3 (2026-10-16):** PNT entra en el registro sin `QmsRecord`. Menú principal, tarjetas y opciones del dashboard, lista de módulos del audit trail, etiquetas de tipo y listas de `action-guard` se derivan del registro. Los tests de equivalencia fijan cada lista contra su valor literal anterior, y `accessModules` sigue literal como fuente del tipo, comprobado contra el registro. Sin cambios visibles, de permisos, schema ni datos. El inventario de escritores solo cambia en la huella de `trail.ts`.

**Contrato de módulo — PR 4 (2026-10-16):** cada contrato declara los permisos que admite y `SYSTEM` los suyos. Un test estático exige que todo permiso comprobado en el código (inventario, PermissionGate, `assertPermission`, operaciones PNT) esté declarado por su módulo y que los permisos específicos no salgan de él. El mapa de rutas de `page-guard` se deriva del registro. Sin cambios en roles, permisos efectivos, interfaz, schema ni datos.

**Audit trail — nombres de módulo (2026-10-16):** el filtro de módulo de la bandeja `/audit-trail` muestra los mismos nombres que el menú y el dashboard, tomados del registro: «Controles de cambios» y «Documentación controlada» en lugar de «Controles de Cambios» y «PNT». Es solo un cambio de texto visible; los valores del filtro, los permisos y los datos no cambian.

**Buscador global (2026-10-16):** un icono de lupa en la barra superior (o `Ctrl+K`/`⌘K`) abre `/search`. La página busca por código, código anulado y campo principal (título, descripción, cliente o lote) en los siete módulos, muestra hasta 5 resultados por módulo ordenados por relevancia del código y enlaza al listado del módulo con la misma búsqueda. Solo lectura, sin ruta de API nueva y protegida por `authorizedPage` (lectura global). Cada módulo aporta su `search.ts`, registrado en `search-registry.ts`. Sin cambios de schema, permisos ni datos.

**Cabecera — menú completo (2026-10-16):** por debajo de 2.200 px de ancho el menú principal pasa a una segunda fila a todo el ancho, la misma maquetación que ya existía por debajo de 1200 px, y los enlaces usan el espaciado de 12 px de esa vista. Antes, entre 1200 y 2200 px, el menú se desbordaba y había que desplazarlo para ver Documentación controlada, Audit Trail y Configuración. Medido en la app real: cabe completo de 1280 a 2560 px. Por debajo de 1200 px se mantiene el desplazamiento horizontal ya existente. Solo CSS; sin cambios de estilo, colores ni componentes (D-070).

**Cronología del expediente (2026-10-16):** nueva pestaña «Cronología» en Desviaciones, CAPA, Controles de cambios, Reclamaciones, Devoluciones y Auditorías. Es una vista combinada de solo lectura que ordena de más reciente a más antigua: historial de modificaciones, versiones y seguimientos, documentos generados, documentos firmados recibidos y relaciones. Muestra hasta 200 entradas por fuente y reutiliza el marcado de «Historial». Se rotula como historial operativo que no constituye audit trail GMP validado; el audit trail sigue en su pestaña. PNT conserva su historial propio. Sin cambios de schema, escrituras ni permisos.

**Vistas guardadas (2026-10-16, D-084):** los listados de los siete módulos permiten guardar los filtros actuales con un nombre, reabrirlos desde un desplegable y eliminarlos. Se guardan en base de datos por usuario (tabla `SavedListView`, máximo 30 por listado), sin paginación ni datos de expedientes, y cada usuario solo ve las suyas. En Documentación controlada los controles están junto a «Limpiar filtros», fuera de los filtros avanzados plegados. Excluidas del audit trail como preferencia personal: sin trigger ni operación en la matriz, que sigue con 63 operaciones. Migración aditiva `20261016000100_saved_list_views`; el inventario de escritores añade los dos escritores de la nueva tabla. Sin cambios de permisos, reglas GMP ni datos existentes.

**Contrato de módulo — MC-4 etapa 2 (2026-10-16, D-083):** el enum `QmsRelationType` queda solo con `GENERATES`. La migración `20261016000200_retire_unused_relation_types` comprueba antes que ninguna relación, activa o inactiva, use `RELATED_TO`, `IMPLEMENTED_BY` o `ASSOCIATED_WITH` y, si alguna lo hace, aborta sin cambiar nada. Las fixtures sintéticas 3B1 y la prueba de captura B2 pasan a `GENERATES`. Sin cambios de interfaz, reglas, permisos ni datos; las 63 operaciones del audit trail no cambian.

**Contrato de módulo — PR 5 (2026-10-16):** cada contrato declara su ciclo de vida **descriptivo**: campo de estado, estados y transiciones vigentes por operación. Las comprobaciones de estado de las acciones de los siete módulos pasan a funciones puras con el mismo resultado, y un test compara la declaración con ellas en todas las combinaciones origen → destino. No cambia ninguna transición ni regla; los hallazgos del mapeo (altas directas en Cerrada, reaperturas sin versión, CAPA cancelada reabrible, edición de anulados) quedan documentados en [MODULE_CONTRACT.md](MODULE_CONTRACT.md) §4.3 para decisión. Incluye una corrección de seguridad: cerrar una reclamación por petición directa con `saveStatus` exige ahora el permiso de cierre, como el resto de módulos.

**Decisiones de ciclo de vida (2026-10-16, D-085):** se mantienen el alta directa en Cerrada, la reapertura sin nueva versión, la reapertura de CAPA cancelada sin motivo separado y la editabilidad de anulados. Se corrige el registro histórico de PNT: registrar como vigente una revisión posterior pasa a Obsoleta la vigente anterior desde la nueva fecha de vigencia, igual que la activación y el cambio manual. Antes la base de datos lo rechazaba por existir otra vigente. Se rechaza sustituir una vigente con número de revisión posterior o con una vigencia anterior. Cubierto por `pnt-p1a:smoke`.

**Editor de roles (2026-10-16, D-086):** en Configuración → Usuarios, cada política de rol se edita con una tabla por módulo que solo ofrece los permisos que admite su contrato, con su ámbito. El servidor rechaza combinaciones no admitidas y, como antes, la gestión de usuarios y roles queda reservada. Los permisos no admitidos que tenga un rol se enumeran y se retiran al guardar. Sin cambios de schema ni de roles guardados.

**Demo local (2026-10-16, D-087):** `docker compose -f compose.demo.yaml up --build` arranca en el propio ordenador la aplicación con datos ficticios y una página de acceso con cuatro perfiles de demostración. Solo con `APP_ENV=demo`, base `covex_demo` y origen localhost; el arranque de producción lo rechaza. Sin Entra, sin audit trail GMP activo y sin datos reales. Guía en [DEMO_LOCAL.md](DEMO_LOCAL.md). Probado de punta a punta con Docker: acceso por perfil, panel, listados, alta de un borrador, permisos de consulta y administración de usuarios.

**Módulo OOS — diseño (2026-10-16, D-088):** diseño documental de un módulo de resultados fuera de especificación según el PNT GC-10/014/04, en [OOS_DESIGN.md](OOS_DESIGN.md): codificación por área API/MD, Fase I y Fase II, resultado Invalidado/Confirmado/No concluyente, relaciones con CAPA y Desviación, anexos III y IV del PNT e importación del listado histórico. Sin código, schema ni datos; implementación en PR OOS-1 a OOS-3 con aprobación propia.

**Módulo OOS — OOS-1 (2026-10-17, D-088):** nuevo módulo de resultados fuera de especificación (PNT GC-10/014/04) en el menú, el panel, el buscador, el audit trail y el editor de roles. Migración aditiva `20261017000100_oos_records` (tabla `OosRecord`, valor `OOS` en `QmsRecordType` y `AccessModule`). Código `OOS/API|MD/ZZZ/AAAA` con series independientes por área y año, asignado al abrir. Ficha con datos iniciales, los 21 parámetros de la Fase I (microbiología incluida), Fase II solo con disposición «a gran escala», resultado Invalidado/Confirmado/No concluyente y cierre validado en servidor por fase. Listado con filtros por área, estado, fase y resultado, vistas guardadas y anulación transversal. Sin relaciones, anexos ni captura del audit trail en las operaciones de OOS (OOS-2 y OOS-3); no se importan OOS antiguos. Pruebas: unitarias, `oos:smoke` (PostgreSQL) y `oos:ui:smoke` (Chromium 1440/768/390).

**Módulo OOS — OOS-2 (2026-10-17, D-088):** relaciones canónicas OOS → CAPA y OOS → Desviación declaradas en el contrato, gestionadas desde la pestaña «Relaciones» del OOS (vincular por expediente o código y desvincular con historial) y visibles en solo lectura como «OOS de origen» en la ficha de la CAPA y de la Desviación; columna «CAPA / Desviación» y búsqueda por código relacionado en el listado. Revisión (Review) en la ficha del OOS con 13 puntos revisables (datos iniciales, detección, resultado, evaluación, investigación, conclusión y dictamen de la Fase I, revisión de la producción, repetición, remuestreo, conclusión y dictamen de la Fase II y relaciones), sin versiones funcionales. La captura del audit trail B2 en las operaciones de OOS **no** se incluye: exige ampliar la matriz aprobada de 63 operaciones, la política de captura publicada y las funciones SQL contratadas, y se propone como PR propia con aprobación de alcance ([OOS_DESIGN.md](OOS_DESIGN.md) §11). Pruebas: unitarias, `oos:smoke` y `oos:ui:smoke` ampliados.

**Módulo OOS — OOS-2b (2026-10-17, D-088):** captura del audit trail B2 en las operaciones de OOS, con códigos OO01–OO05 (alta, Fase I, Fase II, resultado y cierre, relaciones y anulación). La matriz `PHASE_4B3_A.md` §3.9 y el catálogo pasan a 68 operaciones y 23 grupos de escritura.

La migración aditiva `20261017000200_b2_oos_capture`:

- añade los triggers de exigencia, captura y testigo en `OosRecord` y su política de 52 campos (8 críticos propuestos);
- reemplaza `covex_b2_begin`, `covex_b2_before`, `covex_b2_observe_maturity`, `covex_b2_critical_mutation` y `covex_b2_authorize_root`, extendidas solo con OO, OOS y `OosRecord`.

Contrato `audit-contract-oos.json`, reconocido por `protection.ts` y `backup.py`.

Prueba original en `scripts/audit-fixtures/oos-capture.test.ts`, que se ejecuta dentro de `phase4b3-b2:capture:smoke`:

- rechazo de lectores;
- motivo obligatorio al corregir un valor crítico y al cerrar;
- relaciones con ambas raíces;
- idempotencia;
- anulación y reactivación.

La aceptación formal de QA/DT sigue pendiente.

**Módulo OOS — OOS-3 (2026-10-17, D-088):** Anexos III (Fase I), IV (Fase II) y VI (listado anual) del PNT GC-10/014/04 corregido.

- **Instalación:** `pnpm templates:oos:install -- <PNT.docx>` verifica el SHA-256 del PNT, deriva los tres anexos y los registra como plantillas v04. El binario no se versiona en Git.
- **Descargas:** el Anexo III desde la ficha del OOS abierto o cerrado; el Anexo IV solo con disposición «a gran escala»; el Anexo VI desde «Exportar» en el listado, por año.
- **Cumplimentación:** las celdas de la plantilla se rellenan conservando su formato. En el Anexo VI, cada fila lleva el color de estado de §5.2.
- **Audit trail:** las descargas de los Anexos III y IV son documentos de trabajo con recibo.
  - Migraciones aditivas `20261017000300_oos_document_types` (tipos de documento) y `20261017000400_b2_oos_documents` (código OO06 en `covex_b2_begin`).
  - Contrato `audit-contract-oos-documents.json`.
  - La matriz y el catálogo pasan a 69 operaciones.
- **Permisos:** el módulo admite además «Exportar» y «Generar documentos».
- **Pruebas:** unitarias del relleno y de la derivación, prueba de captura OO06, `oos:ui:smoke` con descarga de los tres anexos, y verificación local con el PNT real convertido a PDF.

Adjuntar el anexo firmado a mano queda pendiente.

**Módulo OOS — OOS-4 (2026-10-17, D-088):** PDF firmado a mano de los Anexos III y IV en la nueva pestaña «Documentos» de la ficha.

- **Custodia:** original recibido inmutable, con SHA-256 verificado al descargar y sustitución con motivo, asociado a un snapshot técnico del OOS (versión 0).
- **Migraciones:** `20261017000500_oos_signed_document_kinds` y `20261017000600_b2_oos_signed_documents`.
- **Contrato y permiso:** contrato `audit-contract-oos-signed.json`; permiso «Adjuntar documentos».
- **Demo local:** `ops/demo/start.sh` instala el PNT GC-10/014/04 desde `plantillas/*.docx` (comprobado por SHA-256).
- **Pruebas:** captura OO06 de carga, sustitución y custodia; `oos:ui:smoke` con carga y descarga del PDF firmado.

**Módulo OOS — anexos sin encabezado (2026-10-17, D-088):** los Anexos III, IV y VI se derivan como los anexos en uso de «FUERA DE ESPECIFICACIONES»: empiezan en el formulario, sin encabezado, pie ni títulos del PNT, y «Página n de X» se completa con el total de páginas. Al reinstalar el PNT (o al arrancar la demo) la derivación de OOS-3 se sustituye con `TEMPLATE_REDERIVED`. Nuevos SHA-256 en [OOS_DESIGN.md](OOS_DESIGN.md) §8.

**Módulo OOS — acceso a la Fase II (2026-10-17, D-088):** la pestaña «Fase I» de un OOS abierto sin disposición final muestra un aviso con el botón «Pasar a Fase II», que abre la edición en «Disposición final». Elegir «Investigación a gran escala» y guardar sigue siendo explícito. `oos:ui:smoke` entra en la Fase II por el botón.

**Pestaña Historial retirada (2026-10-17, D-089):** Desviaciones, CAPA, Controles de cambios, Reclamaciones, Devoluciones y OOS consultan las modificaciones en «Cronología». Documentación controlada conserva su Historial porque muestra valores anterior y nuevo. Auditorías lo integra en Cronología desde R5A (D-110), donde cada cambio conserva sus «Valores registrados». Los seguimientos legacy de Reclamaciones pasan a «Versiones». Sin cambios de datos, consultas, registro ni Audit Trail.

**Listados con menos ruido visual (2026-10-17):** piloto en Desviaciones aceptado y extendido a CAPA, Controles de cambios, Reclamaciones, Devoluciones, Auditorías y OOS: buscador y botón «Filtros» en una fila, panel de filtros plegado, filtros aplicados como etiquetas, contadores en línea y «Recordatorios por correo» solo al seleccionar. Documentación controlada conserva sus filtros avanzados plegados y pasa a contadores en línea. Sin quitar filtros ni opciones; a 1440 px la tabla empieza a unos 350–415 px en lugar de 750–790 px ([UI_SPEC.md](UI_SPEC.md)).

**Inicio con menos ruido visual (2026-10-17):** franja «Requiere atención» arriba (vencidos, próximos 30 días, eficacia pendiente y borradores), módulos en una tabla con totales, filtros plegados y textos de negocio; se retiran las tarjetas de totales y los accesos duplicados. Mismos datos y consultas. A 1440 px la página pasa de 1.850 a 1.355 px de alto y a 390 px de 4.227 a 2.209 px. Smokes `dashboard-d1b`, `dashboard-d1c` y `phase3b2` adaptados a la nueva estructura conservando sus comprobaciones. Aceptado por el responsable del proyecto ([UI_SPEC.md](UI_SPEC.md)).

**Inicio sin gráfico de evolución (2026-10-17):** se retira la tarjeta «Evolución de 5 años» del panel; cada fila de la tabla de módulos enlaza a su pestaña Indicadores (Desviaciones, CAPA, Controles de cambios, Reclamaciones y Devoluciones) y la bandeja de plazos pasa a ancho completo. La consulta de tendencia se conserva en servidor por la referencia congelada de `phase3b2`.

**Indicadores de Desviaciones · antigüedad de pendientes — piloto (2026-10-17):** nuevo bloque «Pendientes hoy» en la pestaña Indicadores con las desviaciones abiertas por tramos de antigüedad (0–30, 31–60, 61–90, >90 días) con críticas y mayores, mediana de antigüedad, marcadas fuera de plazo, con seguimiento vencido y las cinco más antiguas. Tramos descriptivos, no plazos del PNT. Definición en [DEVIATION_KPI_DEFINITIONS.md](DEVIATION_KPI_DEFINITIONS.md). Aceptado y extendido a los demás módulos (entrada siguiente).

**Indicadores de Desviaciones · tendencias — piloto (2026-10-17):** el gráfico «Aperturas por mes» pasa a los últimos 36 meses con media móvil de 12 meses; nueva tarjeta «Acumulado del año» frente al mismo periodo del año anterior; las distribuciones por área, origen y clasificación pasan a un Pareto con porcentaje acumulado y corte del 80 %. Definición en [DEVIATION_KPI_DEFINITIONS.md](DEVIATION_KPI_DEFINITIONS.md). Aceptado y extendido a los demás módulos (entrada siguiente).

**Indicadores de CAPA, Controles de cambios, Reclamaciones y Devoluciones · pendientes y tendencias (2026-10-17):** el piloto aceptado de Desviaciones se extiende a los otros cuatro módulos con piezas compartidas (`src/lib/qms/analytics/trends.ts`, `src/components/analytics/trend-charts.tsx`): antigüedad de lo abierto hoy, 36 meses con media móvil de 12, acumulado del año frente al mismo periodo del anterior y Pareto. Las tarjetas de distribución pasan al Pareto. Indicadores propios de cada módulo:
- CAPA: fecha prevista superada y bloque de eficacia pendiente de verificar.
- Controles de cambios: prevista superada sin ejecutar y Pareto por alcance.
- Reclamaciones: mediana recepción→respuesta y Pareto por categoría y origen.
- Devoluciones: mediana comunicación→decisión y decisión pendiente.

Sin objetivos, gráfico de control ni tasa de reclamaciones por volumen distribuido: Calidad valora los indicadores a final de año fuera de la aplicación (D-090). Definiciones en [MODULE_KPI_DEFINITIONS.md](MODULE_KPI_DEFINITIONS.md) y [CAPA_KPI_DEFINITIONS.md](CAPA_KPI_DEFINITIONS.md).

**Búsqueda por lote y verificación de eficacia de CAPA (2026-10-17):**
- La búsqueda global y la de cada listado encuentran el lote en Desviaciones (lote de producto, de material y de proveedor), OOS (lote y lote de proveedor), Reclamaciones y Devoluciones. El resultado muestra el lote que coincide.
- CAPA: al cerrar operativamente con la eficacia pendiente, el seguimiento exige la fecha prevista de verificación de eficacia, que es el próximo seguimiento (D-091).
- Indicadores de CAPA cuenta las verificaciones vencidas y las que no tienen fecha.

**Categoría de causa raíz (6M) (2026-10-17, D-092):**
- Apartado opcional junto a la causa raíz en Desviaciones, CAPA, Reclamaciones y OOS. Se puede marcar más de una categoría.
- No se imprime en los anexos.
- Pareto «Causa raíz (6M)» en los Indicadores de Desviaciones, CAPA y Reclamaciones.
- Contrato B2 `audit-contract-root-cause.json`.

**Importador del índice de PNT: inclusión en bloque (2026-10-17, D-093):**
- El lote permite incluir de una vez las PNT vigentes sin incidencias y las anuladas según el índice.
- Con el índice general de 2025 entran 677 vigentes y 122 anuladas. Las 22 filas restantes y las que no son PNT se revisan a mano.
- Probado de punta a punta en local con el Excel real; el fichero no se versiona.

**Otros lotes afectados (2026-10-17, D-094):**
- Desviaciones, Reclamaciones y OOS admiten varios lotes o productos además del principal.
- En los anexos impresos salen en la misma casilla, uno por línea.
- La búsqueda los encuentra.
- Contrato B2 `audit-contract-additional-lots.json`.

**Ayuda de recurrencia en Desviaciones (2026-10-17, D-095):**
- Desviaciones de los 12 meses anteriores con el mismo lote, producto o material, o la misma área y procedencia, junto a la valoración de recurrencia.
- Solo informa; no guarda datos ni decide.

**Evidencias adjuntas por expediente (2026-10-18, D-096):**
- Pestaña «Evidencias» en Desviaciones, CAPA, Controles de cambios, Reclamaciones, Devoluciones y OOS.
- PDF, DOCX, XLSX, PNG o JPG de hasta 15 MB, con descripción y huella SHA-256. Solo se añaden; no se sustituyen ni borran.
- No se imprimen en los anexos. Sin análisis antivirus (pendiente).

**Alta de departamentos desde el índice de PNT (2026-10-18, D-097):**
- La previsualización del índice lista los departamentos de cada hoja con su nombre de cabecera y da de alta de una vez los que faltan.
- Los anulados en el índice no se dan de alta. Con el índice general de 2025 se dan de alta 26, y la inclusión en bloque cubre 676 vigentes y 91 anuladas; las 32 filas de los departamentos anulados quedan fuera.

**Figuras en los apartados de Desviaciones (2026-10-30, D-125):**
- **Qué cambia:**
  - en la edición, cada apartado (C, D, E, F-G, I y K-L) admite figuras: se pega (Ctrl+V), se arrastra o se elige una imagen, se describe y se guarda con «Adjuntar figura», aparte del botón Guardar;
  - cada figura es una evidencia inalterable con su apartado, numerada en todo el expediente;
  - la ficha muestra las miniaturas en su apartado;
  - el Anexo III añade una hoja «Figuras» tras la última página, sin tocar la plantilla.
- **Privacidad:** el navegador quita los metadatos de la imagen y respeta su orientación.
- **Sin cambios de base de datos:** el apartado va en los metadatos de la evidencia.
- **Comprobado** con:
  - pruebas unitarias (apartados, numeración, tamaño de PNG y JPEG, hoja de figuras y rechazo de no imágenes);
  - el smoke `deviation-figures:ui:smoke`: pegar, elegir archivo, adjuntar, que no guarda el formulario, numeración, ficha y Evidencias;
  - un Anexo III generado con la plantilla v06 real (solo en local).

**Viñetas en los textos largos (2026-10-30, D-126):**
- **Qué cambia:**
  - en los formularios de Desviaciones, Controles de cambios, CAPA, OOS, Reclamaciones y Devoluciones, los textos largos tienen el botón «• Viñetas»: pone o quita la viñeta en las líneas seleccionadas;
  - el servidor quita las viñetas vacías: no se guardan ni cuentan como relleno de un campo obligatorio;
  - Intro continúa la lista y, en una viñeta vacía, la termina;
  - la ficha muestra las viñetas como lista;
  - en los anexos Word cada viñeta es un párrafo con sangría francesa.
- **Sin cambios de base de datos:** se guarda como texto con «• » al principio de la línea; los textos antiguos no cambian.
- **Comprobado** con:
  - pruebas unitarias (poner y quitar viñetas, Intro, viñetas vacías, bloques y componente de la ficha, párrafos Word, campo obligatorio);
  - el smoke `text-bullets:ui:smoke`: botón, Intro, deshacer, guardado, fichas de la desviación y del control de cambios, y el botón en CAPA, OOS, Reclamaciones y Devoluciones;
  - un Anexo III generado con la plantilla v06 real (solo en local).
- **Siguiente:** tablas editables (opción B, dentro de la casilla del anexo) en los seis módulos.

**Tablas en los textos largos de Desviaciones (2026-10-30, D-127, primera parte):**
- **Qué cambia:**
  - bajo cada texto largo de una desviación, «+ Añadir tabla»: título, cabecera y filas; se puede pegar desde Excel;
  - se guardan con el botón Guardar, validadas en el servidor, en `Deviation.textTables` (migración `20261030000100_deviation_text_tables`, contrato B2 `B2_DEVIATION_TEXT_TABLES`);
  - la ficha las muestra numeradas («Tabla N») en su apartado;
  - el Anexo III las escribe como tablas de Word dentro de la casilla del apartado.
- **Comprobado** con:
  - pruebas unitarias (lectura y límites, pegado de Excel, numeración, tabla de Word en la casilla, ubicación en el Anexo III, versión, contrato B2);
  - el smoke `text-tables:ui:smoke`: añadir, pegar desde Excel, error de título sin perder la tabla, guardado, ficha y sin cambios espurios;
  - un Anexo III generado con la plantilla v06 real (solo en local).
- **Siguiente:** Controles de cambios y CAPA; después OOS, Reclamaciones y Devoluciones.

**Tablas en los textos largos de CAPA y Controles de cambios (2026-10-31, D-127, segunda parte):**
- **Qué cambia:**
  - los textos largos del formulario de CAPA (defecto, causa raíz, seguimiento de acciones, estado, eficacia, conclusión, observaciones) y de Controles de cambios (descripción, justificación, documentos, evaluación, observaciones del dictamen, observaciones internas) admiten tablas;
  - se guardan en `Capa.textTables` y `ChangeControl.textTables` (migración `20261031000100_capa_change_text_tables`, contrato B2 `B2_CAPA_CHANGE_TEXT_TABLES`);
  - la ficha las muestra numeradas; el Anexo III de CAPA y los Anexos III (solicitud) y IV (dictamen) de Controles de cambios las escriben dentro de la casilla de su apartado, teniendo en cuenta las filas copiadas de acciones y seguimientos;
  - las utilidades comunes (tablas iniciales tras un error, resumen de errores con el apartado y ubicación en el anexo) quedan en `src/lib/forms/text-tables.ts` y las usan los tres módulos.
- **Después:** OOS, Reclamaciones y Devoluciones (tercera parte) y filas de seguimiento de la acción de CAPA (cuarta parte).
- **Comprobado** con pruebas unitarias (validación, versiones, contrato B2, anexos con filas copiadas) y el smoke `text-tables:ui:smoke` ampliado a CAPA y Controles de cambios.

**Tablas en las filas de «Seguimiento de la acción» de CAPA (2026-10-31, D-127, cuarta parte):**
- **Qué cambia:**
  - cada fila del apartado 4 de CAPA (fecha y descripción) tiene «+ Añadir tabla» bajo su descripción;
  - se guardan en la columna existente `Capa.textTables` con la clave `actionFollowups.N` (sin migración ni contrato B2 nuevos) y entran en las versiones y el historial como el resto de tablas de CAPA;
  - se numeran después de la causa raíz; la ficha las muestra bajo la descripción de la fila y el Anexo III, en la casilla de descripción de su fila copiada;
  - el editor de tablas tiene una variante sin estado propio (`TextTablesFields`) para tablas dentro de listas, y la comprobación de una lista de tablas (`validateTableList`) es común.
- **Comprobado** con pruebas unitarias (comprobación de listas, orden y casillas del anexo, claves de filas huérfanas, tope de tamaño de las filas, validación del formulario, Anexo III con filas copiadas) y `text-tables:ui:smoke` ampliado.
- **Observación:** el formulario de «Seguimiento 01, 02…» con versión (`CapaFollowupForm`) no está enlazado desde ninguna página; los seguimientos con versión se crean desde el formulario principal. No se le han añadido tablas.

**Tablas en los textos largos de OOS, Reclamaciones y Devoluciones (2026-10-31, D-127, tercera parte):**
- **Qué cambia:**
  - los textos largos de OOS (detección, investigación y conclusiones de la Fase I, apartados de la Fase II, departamentos afectados, observaciones internas), de Reclamaciones (18 textos del Anexo III y observaciones internas) y de Devoluciones (motivo, documentación, justificación del plazo, destino final, decisión, certificado de destrucción, declaración del cliente, observaciones internas) admiten tablas;
  - se guardan en `OosRecord.textTables`, `Complaint.textTables` y `ReturnRecord.textTables` (migración `20261031000200_oos_complaint_return_text_tables`, contrato B2 `B2_QMS_TEXT_TABLES`) y entran en las versiones de Reclamaciones y Devoluciones;
  - la ficha las muestra numeradas bajo el texto de su apartado;
  - los anexos las escriben dentro de la casilla de su apartado: OOS Anexos III y IV, Reclamaciones Anexo III (v03 y anteriores, con las filas copiadas de acciones o CAPA), Devoluciones Anexos III y V;
  - en Reclamaciones, las tablas de un detalle de actuación (inmediata, retirada, abono, reposición, otros) solo salen si la actuación está marcada, como su texto; en las plantillas anteriores a la v03, que no imprimen esos detalles, no salen.
- **Comprobado** con pruebas unitarias (validación de los tres módulos, versiones, contrato B2, anexos) y el smoke `text-tables:ui:smoke` ampliado a OOS, Reclamaciones y Devoluciones; las casillas de Devoluciones, también con sus plantillas reales (solo en local).
- **Después:** tablas en las filas de seguimiento de la acción de CAPA (cuarta parte).

**FTA y herramientas en el Anexo III de Desviaciones (2026-10-30, D-124):**
- **Qué cambia:**
  - cuarta herramienta, FTA (árbol de fallos), en esquema con sangrías (hasta 4 niveles) y relación O/Y; solo una causa final y confirmada pasa a «Causa raíz» y marca «FTA»;
  - el Anexo III imprime en la casilla de causa raíz, debajo de la causa raíz, todas las herramientas usadas con el estado y la evidencia de cada causa;
  - la ficha muestra también el FTA.
- **Sin cambios de base de datos:** el FTA va en `Deviation.investigationTools`.
- **Comprobado** con:
  - pruebas unitarias (FTA, texto del anexo y casilla de la plantilla);
  - `deviation-tools:ui:smoke` ampliado con el FTA;
  - un Anexo III generado con la plantilla v06 real (solo en local; la plantilla no se versiona).

**Herramientas de investigación en Desviaciones (2026-10-29, D-123):**
- **Qué cambia:**
  - en «E. Investigación», el desplegable «Herramientas de análisis» con 5 porqués, Ishikawa (6M) y brainstorming; se elige la herramienta y solo se muestra esa (y las que ya tienen contenido);
  - cada causa es hipótesis, descartada o confirmada;
  - «Usar como causa raíz» copia una causa confirmada a «Causa raíz» y marca su categoría y metodología;
  - la ficha las muestra en «Investigación»;
  - el Anexo III no cambia.
- **Base de datos:** migración `20261029000200_deviation_investigation_tools` con la columna JSON `Deviation.investigationTools`, capturada por B2 (contrato `B2_DEVIATION_INVESTIGATION_TOOLS`).
- **Demo:** dos desviaciones de ejemplo con Ishikawa y 5 porqués.
- **Comprobado** con:
  - pruebas unitarias (lectura, validación, «Usar como causa raíz», formulario y versión);
  - el contrato de captura;
  - el smoke `deviation-tools:ui:smoke`, que cubre solo lo confirmado, la categoría propuesta, el guardado, la ficha y que no hay cambios espurios.

**Modelos de Control de cambios (2026-10-29, D-122):**
- **Qué cambia:**
  - Configuración → «Modelos de cambio» para crear y editar casos tipo;
  - en «Nuevo Control de Cambio», «Partir de un modelo» prerrellena departamento, alcance, textos guía y acciones habituales del plan;
  - nada se guarda hasta pulsar Guardar, y el historial de alta indica el modelo.
- **Base de datos:** migración `20261029000100_change_control_models` con la tabla `ChangeControlModel`, capturada por B2 como configuración (contrato `B2_CHANGE_CONTROL_MODELS`).
- **Demo:** dos modelos de ejemplo.
- **Comprobado** con pruebas unitarias (formulario, límites y qué se prerrellena), contrato de captura y el smoke `change-models:ui:smoke`.

**Vista previa de PDF e imágenes (2026-10-29, D-121):**
- **Qué cambia:** botón «Ver» junto a la descarga de evidencias, PDF firmados, archivos históricos de Devoluciones y documentos recibidos de Auditorías. Abre PDF, PNG o JPG en una pestaña nueva; Word y Excel se siguen descargando.
- **Seguridad:** misma ruta, permisos y comprobación de huella que la descarga; solo se sirve «en línea» si el tipo guardado es PDF o imagen.
- **Comprobado** con pruebas unitarias (tipos admitidos y cabecera) y `evidence:ui:smoke` ampliado (enlace «Ver» y respuesta en línea con la misma huella).

**Calendario de vencimientos (2026-10-29, D-120):**
- **Qué cambia:** nueva página «Calendario» (mes o semana) con los plazos de todos los módulos, enlazada desde el inicio. Usa las mismas reglas que los plazos del panel y «Mis tareas», con filtros de área, departamento y «Solo mis tareas». En móvil se ve como lista por días.
- **Sin cambios de datos:** no hay migración; las reglas de «Mis tareas» se reutilizan sin filtro de usuario para «Todos los plazos».
- **Comprobado** con pruebas unitarias del periodo (semanas de lunes a domingo, cambios de mes, URL), el smoke `calendar-d120:smoke` (fuentes, filtros, vencidas, «Solo mis tareas» y mismas claves que el panel) y la regresión de «Mis tareas» y del panel.

**PNT: responsables por función y de la revisión periódica (2026-10-27, D-118):**
- **Qué cambia:** cada revisión de PNT en borrador, en revisión o pendiente de aprobación tiene responsables de Elaborar, Revisar y Aprobar, con usuario opcional y fecha prevista. El maestro tiene responsable de la revisión periódica. Se asignan con «Asignar responsables» en la pestaña Revisiones y se muestran en la ficha.
- **Mis tareas:** «Elaborar/Revisar/Aprobar la revisión XX» solo mientras la revisión está en la fase de esa función. «Revisión periódica» cuando la vigente vence en 30 días o ya venció y no hay una nueva revisión en curso.
- **Listado de PNT:** filtro «Asignación → Asignadas a mí» en los filtros avanzados, con la misma regla.
- **Base de datos:** migración `20261027000100_pnt_assignments` (11 columnas nuevas, opcionales) con captura B2 y contrato `audit-contract-pnt-assignments.json`.
- **Demo:** GC-00/003 rev. 04 con las tres funciones; GC-00/030 (vencido) y LG-30/005 (vence en 25 días) con responsable de revisión periódica. `pnpm demo:examples` lo completa también en demos ya cargadas.
- **Comprobado** con pruebas unitarias (regla, formulario y contrato), el smoke `assigned-d102:smoke` ampliado a PNT (funciones por fase, revisión periódica, anulados, historial, concurrencia y listado) y la regresión.
- **No cambia:** el registro de funciones del documento aprobado, los estados de la revisión ni la firma.
- **Pruebas añadidas tras la revisión independiente (2026-10-28, D-119):** la revisión periódica usa la fecha del ciclo de vida cuando existe (también si está vacía), un usuario inactivo no se puede asignar como nuevo responsable y la asignación respeta el departamento del PNT (`assigned-d102:smoke` y `phase4b1:smoke`). Cada prueba se comprobó rompiendo a propósito la regla que vigila.

**Mejoras de interfaz, entregas 1 a 4 (2026-10-21, D-117):**
- **Origen:** auditoría UI/UX de la Fase 1 sobre la interfaz real; se mantiene el diseño actual.
- **Entrega 1, acabado:** sin estilos por defecto del navegador, sin jerga interna, contraste de al menos 5:1, anillo de foco común, alineaciones corregidas y acceso sin menú.
- **Entrega 2, acciones y errores:**
  - ventanas modales accesibles (foco, Tab, Esc);
  - «Anular» discreto y confirmación en rojo;
  - resumen en español de campos pendientes con enlaces;
  - «Editar / seguimiento»;
  - hora local en el audit trail;
  - contadores sin anulados;
  - «Calidad del dato» y «Proceso de las acciones».
- **Entrega 3, coherencia:**
  - Inter incluida en la aplicación;
  - cada dato una sola vez en la pestaña de resumen de las fichas, con las anclas de revisión conservadas;
  - tamaños comunes de tabla, pastilla y campo;
  - código y paginación iguales en todos los listados;
  - variables de diseño;
  - botones sin partir en móvil.
- **Auditoría repetida:** 24 hallazgos resueltos, 4 en parte y 6 nuevos menores.
- **Entrega 4, acabado:**
  - resumen de pendientes por apartado;
  - tableta sin botones partidos;
  - barra de módulos con indicio solo si no cabe;
  - barra de acciones compacta en móvil;
  - vencido en rojo también en el inicio;
  - audit trail de la ficha con paginación común;
  - campos de 40 px.
- **Correcciones de validación y fechas:**
  - CAPA rechaza acciones propuestas sin descripción en vez de descartarlas;
  - Devoluciones no conserva en silencio una fecha de seguimiento borrada;
  - Reclamaciones, Devoluciones y OOS marcan desde el servidor el campo de cada error;
  - el audit trail general filtra por días de Madrid y exporta también la hora de Madrid.
- **Logotipo de COVEX** en la cabecera, en lugar de la «C» provisional.
- **Detalles vistos al preparar la demostración:**
  - el expediente de origen elegido en «Nueva CAPA» se ve en una línea, con «Quitar» al lado, sin cortar las palabras;
  - las tablas de acciones (por ejemplo, «CAPA propuestas») parten el texto en varias líneas en vez de montarlo sobre la columna siguiente;
  - la pestaña Documentos de Desviaciones y CAPA ya no dice «Plantilla oficial pendiente de cargar» cuando el expediente no tiene versión asignada pero la plantilla por defecto está instalada; muestra esa versión («por defecto») y permite descargarla, que es la misma con la que se genera el Anexo III;
  - las fechas de los formularios usan el campo de fecha del navegador, que sigue el idioma del equipo: en un equipo en español se ven como dd/mm/aaaa. No cambia.
  - demo: los controles de cambios de ejemplo tienen ya la versión de cada seguimiento, así que «Descargar Anexo V · 00/01» funciona (antes daba «La versión solicitada no existe»). `seed-examples` también lo repara en una demo ya cargada al volver a arrancarla.
  - demo: las dos auditorías a proveedor de ejemplo tienen los datos que exige el Plan externo (introducción, alcance, duración y programa), así que «Plan externo · estado actual» se descarga; `seed-examples` los completa también en una demo ya cargada;
  - una desviación en borrador ya no ofrece «Generar Anexo III cumplimentado» en la pestaña Documentos (el servidor lo rechazaba); muestra «Disponible al abrir la desviación.», como CAPA;
  - comprobación completa de descargas en la demo (perfil Garantía de Calidad): 580 páginas y 158 descargas distintas (anexos, listados, plantillas y documentos generados de los ocho módulos), todas con respuesta 200 y archivo Word o Excel válido.

**Turno en Desviaciones y PR antiguas (2026-10-20, D-115, D-116):**
- **Turno:** las desviaciones tienen el campo «Turno» (texto libre, opcional) junto a «Detectado por». Sale en la casilla «turno» del Anexo III y queda en las versiones y en la captura del audit trail.
- **Anexos que se firman a mano:** los nombres de aprobación de los Anexos III de Desviaciones y CAPA siguen rellenándose a mano. El Anexo V de Devoluciones lo cumplimenta el cliente.
- **PR antiguas:** las 8 revisadas y cerradas sin fusionar (#11, #16, #17, #19, #20, #21, #76 y #112). Solo quedaba sin trasladar la importación histórica de Controles de cambios, anotada en DATA1.
- **CI1:** aplazado (D-115).

**BE1-C: JIT desactivado y dos consultas reescritas (2026-10-20, D-114):**
- **Qué cambia:** la aplicación conecta con JIT de PostgreSQL desactivado, salvo que la URL ya traiga `options`. El filtro «con PDF firmado» de Auditorías y la lectura de fechas PNT del panel de inicio se reescriben con los mismos resultados.
- **Sin índices nuevos**, migraciones ni cambios de pantallas: la medición no los justificó.
- **Medición** con 20.000 expedientes ficticios: «con PDF firmado» de 110 a 31 ms y panel de 211 a 170 ms, en [PHASE_BE1C.md](PHASE_BE1C.md). Con datos reales se repetirá tras DATA1.
- **Comprobado** con el smoke `be1c:smoke` (equivalencia con las consultas anteriores y con la referencia del panel, y JIT desactivado) y la regresión.
- **BE1 completa** (A, B y C).

**BE1-B: registro de errores con referencia visible (2026-10-20, D-113):**
- **Para IT:** cada fallo del servidor deja una línea JSON en la salida estándar con la referencia que ve el usuario, sin mensajes ni datos de expedientes. Cómo buscarla, en [PHASE_4B2.md](PHASE_4B2.md) §14.
- **Referencias visibles:**
  - errores no controlados: la «Referencia técnica» de la página de error;
  - fallos inesperados al guardar: «Referencia para IT: E-…».
- **Auditorías, programa anual:** la emisión devuelve el Word emitido con los bytes que acaba de guardar, sin releerlos, tras un fallo intermitente de su smoke en la secuencia local.
- **Fallos que antes se perdían:** se registran 7 que antes se ocultaban (sesión, descarga PNT, plantillas, importación). Una prueba detecta los casos habituales de `catch` de servidor sin registro ni justificación.
- **Comprobado** con:
  - pruebas unitarias del formato y de la ausencia de datos;
  - el smoke `be1b:smoke`: un error no controlado real, cuya referencia de la pantalla está en el registro del servidor (y falla sin `onRequestError`);
  - la regresión.

**BE1-A: ficheros fuera de las lecturas por defecto (2026-10-20, D-112):**
- **Qué cambia:** la aplicación ya no lee de PostgreSQL los bytes de plantillas, Word generados, PDF firmados, originales, documentos PNT, programas anuales, planes CAPA de auditorías ni exportaciones del historial salvo para descargarlos, generar documentos o verificarlos. Las fichas de Desviaciones, CAPA y Cambios y sus formularios eran los que los cargaban sin necesidad.
- **Sin cambios visibles:** mismas pantallas, permisos, checksums y custodia. Sin migraciones.
- **Medición** antes/después de los 8 listados, 7 fichas, 3 formularios y el panel con 1.000, 5.000 y 20.000 expedientes en [PHASE_BE1A.md](PHASE_BE1A.md).
- **Comprobado** con:
  - el nuevo smoke `be1a:smoke` (0 bytes en listados, fichas y formularios; 25 descargas íntegras; plantilla para generar Word; documento guardado);
  - el inventario de lectores de bytes (`src/lib/db-binary-omit.test.ts`);
  - la regresión PostgreSQL, PNT, Reclamaciones/Devoluciones/OOS y navegador.

**Inicio V4: «Mis tareas» primero (2026-10-20, D-111):**
- **Bloque «Mis tareas»:** es lo primero del panel, siempre visible. Muestra las tareas del usuario, con las vencidas primero, y avisa si no tiene ninguna.
- **Lista inferior:** sigue igual, con su modo «Asignadas a mí» para ver todas.
- **Comprobado** con:
  - la nueva prueba de navegador `ux-v4:ui:smoke`;
  - las pruebas del panel (D1B, D1C);
  - la prueba de asignadas (D-102).
- Con V4 quedan implantadas las cuatro entregas de D-111.

**Expedientes V3: pestaña única «Desviación» (2026-10-20, D-111):**
- Descripción, Investigación, Acciones y Conclusión pasan a una sola pestaña «Desviación», con la misma información en cuatro apartados bien marcados y un índice lateral.
- Los enlaces antiguos, los del panel y los comentarios de revisión ya guardados siguen funcionando.
- **Comprobado** con:
  - la nueva prueba de navegador `ux-v3:ui:smoke`;
  - el resto del grupo `browser-qms`;
  - las pruebas de revisión r2b1, r2b2, r2b3 y r2c;
  - la prueba de asignadas (D-102).

**Expedientes V2: índice lateral en formularios (2026-10-20, D-111):**
- En el alta y la edición de los 8 módulos, una columna a la izquierda lista los apartados del formulario. Al pulsar uno, la página baja hasta él, y el índice marca el apartado visible. Aparece a partir de 1200 px.
- No cambia el formulario: mismos campos, orden, validaciones y guardado explícito.
- **Comprobado** con la nueva prueba de navegador `ux-v2:ui:smoke`:
  - salto a «E. Investigación»;
  - índice en los 8 formularios;
  - sin entradas duplicadas tras un error de guardado;
  - oculto en móvil.

  Además, con los grupos de navegador `browser-qms`, `browser-audits`, `records-r4c` y `pnt`.

**Expedientes V1: cabecera común y datos clave (2026-10-19, D-111):**
- **Cabecera:** igual en 7 módulos, con las acciones en el mismo orden; «Anular» queda separado y la acción principal es la última.
- **Datos clave:** primera tarjeta del resumen en los 8 módulos, con el estado en color, las fechas en negrita y el plazo vencido o próximo coloreado.
- **Auditorías:** campos de Información con el estilo de los demás módulos.
- **Borradores sin código:** se titulan con su descripción.
- **Móvil:** pestañas en una fila desplazable.
- **Comprobado** con la nueva prueba de navegador `ux-v1:ui:smoke` (grupo `browser-qms`), los grupos `browser-qms` y `browser-audits`, la prueba de OOS y capturas antes y después a 1440 y 390 px.

**Auditorías: ajustes del CAPA plan tras R5 (2026-10-19, D-110):**
- **Seguimiento:**
  - solo se comprueban las filas que cambian;
  - la fecha objetivo se valida en el servidor;
  - si otra persona cambió una fila, el error ofrece «Recargar con los datos actuales».
- **Fechas propuestas:** las de hoy en Madrid, no en UTC.
- **Demo:** `pnpm demo:capa-plans` establece la 00 de las auditorías abiertas de ejemplo y un seguimiento 01 en la interna, cuando la plantilla A4.03 está instalada. La demo Docker y la de Codespaces lo ejecutan al arrancar, después de instalar las plantillas.
- **Comprobado** con las pruebas r3c de base de datos y de navegador, y con una base de demo nueva (sin plantillas: aviso y nada más; con plantillas: 00 y 01; repetido: nada).

**Auditorías R5D: cliente e inspección (2026-10-19, D-110):**
- **Informe:** en cliente e inspección no se emite informe COVEX; «Informe y cierre» muestra el informe recibido, la respuesta y observaciones internas, y Versiones no ofrece «Emitir». Las versiones antiguas quedan en solo lectura. En el listado y la cabecera ya no aparecen como «informe pendiente».
- **Hallazgos:** solo los tipos del escenario (observación de cliente o de autoridad y recomendación; en el resto, hallazgo y recomendación), validados también en el servidor. Los hallazgos existentes conservan su tipo.
- **Comprobado** con:
  - las 5 pruebas de navegador de Auditorías (r3c recorre una auditoría de cliente);
  - las pruebas de base de datos de Auditorías (r3b, tipos por escenario; r3c, bucle cliente/autoridad);
  - la prueba de captura del audit trail.
- Con R5D queda completa la revisión R5 de Auditorías (`docs/AUDITS_R5.md`).

**Auditorías R5C2: seguimiento del CAPA plan y cierre nuevo (2026-10-19, D-110):**
- **Seguimiento:** «Registrar seguimiento del CAPA plan» actualiza las acciones y los hallazgos sin acciones y emite la versión 01, 02… con su A4.03.
- **Seguimientos anteriores:** quedan en solo lectura.
- **Cierre:** sigue la regla de D-110 y avisa si el CAPA plan no está al día.
- **Cierre parcial:** coherente en la cabecera, el listado y el programa anual.
- **Informe:** sus versiones ya no tienen A4.03 propio.
- **Comprobado** con:
  - las 5 pruebas de navegador de Auditorías;
  - las pruebas de base de datos de Auditorías;
  - la prueba de captura del audit trail.
- **Demo:** las versiones se siembran después de instalar las plantillas (ver «Auditorías: ajustes del CAPA plan»).

**Auditorías R5C1: versiones del CAPA plan (2026-10-19, D-110):**
- **Versión 00:** «Establecer CAPA plan (versión 00)» en Seguimiento congela hallazgos, acciones y vínculos con su A4.03, aunque estén incompletos y sin informe emitido.
- **Inmutabilidad:** cada versión es inmutable (tabla `AuditCapaPlanVersion`, migración `20261019000100_audit_capa_plan_versions`).
- **Versiones:** la pestaña Versiones muestra las secuencias «Informe» y «CAPA plan»; Documentos incluye sus descargas.
- **Captura B2:** operación AU06 y contrato `audit-contract-capa-plan.json`, reconocido por `protection.ts` y `backup.py`.
- **Comprobado** con:
  - las 5 pruebas de navegador de Auditorías sobre una base nueva;
  - las pruebas de base de datos de Auditorías;
  - la prueba de captura del audit trail.

**Auditorías R5B2: abrir CAPA o Desviación desde un hallazgo (2026-10-19, D-110):**
- «Abrir CAPA» y «Abrir desviación» en la ficha del hallazgo llevan al alta rellenada. Lo guardado, como borrador o abierto, queda vinculado al hallazgo y aparece en su ficha («Borrador sin código» mientras no tenga código).
- Comprobado con:
  - la prueba de navegador r3b, que abre una CAPA y una desviación desde un hallazgo, las guarda como borrador y comprueba la atribución;
  - el resto del grupo de Auditorías;
  - las pruebas de CAPA y Desviaciones (capa, r3-capa, hito8, phase3b1 UI);
  - la prueba de captura del audit trail.

**Auditorías R5B1: ficha de hallazgos (2026-10-19, D-110):**
- **Ficha por hallazgo:** botones «Editar», «Justificar y cerrar», «+ Añadir acción» y «Vincular Desviación / CAPA existente». Cada uno abre su formulario en el sitio, uno cada vez, sin desplegables anidados. Las acciones del CAPA Plan aparecen en filas.
- **Vínculos:** se pueden vincular borradores de Desviación y CAPA, que se buscan por su descripción, también con la auditoría en borrador.
- **Permisos:** cerrar un hallazgo exige el permiso CLOSE también en el servidor.
- **Comprobado** con las 5 pruebas de navegador de Auditorías sobre una base nueva, las pruebas de base de datos r3b y r3c, y un recorrido visual en la demo.
- **Pendiente:** R5C y R5D.

**Auditorías R5A: aspecto, documentos y programas anuales (2026-10-19, D-110):**
- **Expediente:** cabecera, pestañas y estado en color como en Desviaciones; el historial está en Cronología, con las etiquetas de hallazgos, acciones y seguimientos y los valores anterior y nuevo de cada cambio.
- **Listado:** estado en color, aviso de control de dato y enlaces como en los demás listados.
- **Documentos:** documentos de trabajo, documentos por versión, recibidos y conservados en una sola pestaña.
- **CAPA plan:** el del estado actual se descarga también en borrador y desde Hallazgos. Sin plantilla, sale la página «Plantilla oficial no disponible»; cualquier otro error, una página legible en lugar de JSON.
- **Planes y programas anuales:** el alta del plan, las auditorías previstas, la retirada, los aprobadores y la emisión conservan lo escrito ante un error.
- **Comprobado** con las 5 pruebas de navegador de Auditorías sobre una base de pruebas nueva, entre ellas una que fuerza errores y comprueba que no se pierde lo escrito, y con un recorrido en la demo, con y sin plantillas instaladas.
- **Pendiente:** R5B–R5D (`docs/AUDITS_R5.md`).

**Ejemplos de la demo en todos los módulos (2026-10-19, D-109):**
- La demo (Codespaces y Docker) carga 6–7 expedientes ficticios por módulo, en distintos estados y relacionados entre sí, con plazos vencidos y próximos calculados respecto al día de la carga.
- Comprobado en una base `covex_demo` nueva: se abren sin errores las fichas de los listados (49 expedientes, incluidos los 6 ejemplos iniciales) y de los 7 PNT, y el panel muestra plazos vencidos, próximos, «Asignadas a mí» y la eficacia pendiente. Una segunda ejecución no cambia nada.

**Demo en GitHub Codespaces (2026-10-19, D-108):**
- `pnpm demo:codespace` prepara en el Codespace una base de demo aparte (`covex_demo`) con datos y usuarios ficticios, compila y arranca la aplicación con la página de perfiles. Sin Docker Desktop ni permisos de IT; la base habitual del Codespace no se toca.
- Comprobado imitando el reenvío de puertos de Codespaces (HTTPS con la dirección del Codespace hacia `localhost:3000`): perfiles, panel, buscador, alta y subida de plantillas desde el navegador.

**Plantillas instaladas solas al arrancar (2026-10-18, D-107):**
- La aplicación instala al arrancar las plantillas que haya en la carpeta del servidor (`TEMPLATE_INSTALL_DIR`; con Docker, `/app/templates`, que viene de `COVEX_ASSETS_DIR`). Mismas reglas que la terminal y el botón; repetir no cambia nada y no bloquea el arranque.
- Comprobado con la compilación de producción y los archivos reales: en una base nueva, el primer arranque instala 23 plantillas (PMAI incluido) y el segundo no escribe nada.

**Programa anual interno desde su .docx (2026-10-18, D-106):**
- El PMAI V04 se instala desde el `.docx` guardado en Word, también con «Instalar plantillas». Ninguna plantilla necesita ya LibreOffice.
- Mismas casillas y mismo programa generado que con la conversión del `.doc`. Donde se instaló convertido, el `.docx` lo sustituye y queda en el historial.

**Instalar plantillas desde Configuración (2026-10-18, D-105):**
- Botón «Instalar plantillas» en Configuración → Versiones: se suben los ZIP de plantillas y el PNT de OOS, y se instalan con las mismas reglas que `pnpm templates:install` (huella SHA-256, sin sustituir versiones instaladas, historial). Muestra el resultado por plantilla.
- Comprobado con los paquetes reales: se instalan todas las plantillas reconocidas y repetir no cambia nada. El programa anual interno (PMAI V04, `.doc`) necesitaba la terminal con LibreOffice hasta tener su `.docx` (resuelto en D-106).

**Velocidad al cambiar de apartado (2026-10-18, D-104):**
- Al cambiar de apartado ya no aparece la pantalla «Cargando información…» (solo en la primera carga), sino una barra fina de progreso arriba; el clic en el menú pasa de ~850 ms a ~170–290 ms.
- `pnpm preview` arranca en modo producción para probar (Codespaces). `pnpm dev` es varias veces más lento y compila cada apartado la primera vez.

**Ajustes tras las pruebas (2026-10-18, D-103):**
- Los datos que se escriben en los anexos Word salen en Arial 11; las etiquetas de la plantilla no cambian. Comprobado con las plantillas reales en los 22 anexos Word.
- Sin las plantillas de OOS, Configuración las lista como pendientes y el expediente muestra los botones de anexo desactivados con el motivo.
- Buscador global como campo discreto en la barra superior (Intro busca, Ctrl+K enfoca).

**«Asignadas a mí» (2026-10-18, D-102):**
- El panel muestra cuántas acciones pendientes tiene asignadas el usuario y, con «Plazos y asignadas → Asignadas a mí», la lista con fecha prevista y estado.
- Los listados de Desviaciones, CAPA, Controles de cambios, Reclamaciones y Auditorías tienen el filtro «Asignación → Asignadas a mí». Misma definición de pendiente en ambos sitios.

**Responsable como usuario de la aplicación (2026-10-18, D-101):**
- Junto a cada responsable de acciones y tareas (Desviaciones, CAPA, Controles de cambios, Reclamaciones y Auditorías) hay un selector opcional de usuario activo. El texto libre se conserva y es lo que se imprime.
- La ficha muestra el usuario vinculado bajo el responsable. Base para el filtro «Asignadas a mí».

**Comprobación de una versión nueva de plantilla (2026-10-18, D-100):**
- En Configuración → Versiones, cada versión que se puede activar muestra si es compatible con la versión activa del mismo anexo o la lista de diferencias (campo que falta, cambia o se añade).
- Una versión no compatible no se puede activar hasta adaptar la aplicación; los cambios de código, revisión o fecha no cuentan.
- Probado con las plantillas reales: Desviaciones III con solo la revisión cambiada es compatible y se activa; sin «Cantidad» y con «Disposición final» renombrada, se bloquea con 3 diferencias.

**Instalador único de plantillas (2026-10-18, D-099):**
- `pnpm templates:install -- <carpetas, ZIP o archivos>` sustituye a los nueve instaladores anteriores y reconoce cada archivo por su SHA-256 según un catálogo único.
- Nunca sustituye una versión instalada por otro archivo. Devoluciones IV y V solo recortados del PNT.
- Los generadores leen las plantillas solo de la base de datos.
- Probado con los paquetes reales: instala las 24 plantillas con las mismas huellas que la verificación del 18/10/2026; una segunda ejecución no cambia nada.

**Verificación de anexos con las plantillas oficiales (2026-10-18, D-098):**
- 24 anexos comprobados casilla a casilla con las plantillas oficiales. Resultado y método en [ANNEX_VERIFICATION_2026-10-18.md](ANNEX_VERIFICATION_2026-10-18.md).
- Corregidos 11 fallos:
  - Desviaciones III: descarga por versión y «(detallar cuales):».
  - Reclamaciones III (textos oficiales) y V (otros lotes).
  - Devoluciones V (firmante) y VI (trazabilidad).
  - Control de cambios III, IV y V (etiquetas, historial, «NO APLICA» y bloque de aprobación).
- La disposición final de Desviaciones pasa a ser una lista con las opciones del anexo; el texto anterior se conserva como «Otro».
- Pruebas con plantillas sintéticas que comprueban que el texto de la plantilla no se altera.

**4B3-C consolidado para verificación integral:** pestañas de Audit Trail en siete módulos, bandeja transversal, permisos independientes, revisión append-only, corte exacto con microsegundos, exportación conservada/idempotente y contrato de protección/backup C. Se conservan B2 `49bfe417`, checkpoint parcial `a474575` y corrección `f590b275`. Las pruebas focalizadas C pasan; la entrega comunica quality y los cinco grupos/gate sobre su SHA final. No hay PR de la rama ni ejecución remota de Actions implícita. Alcance, pruebas, operación y dependencias QA/IT en [PHASE_4B3_C.md](PHASE_4B3_C.md). Sin activación corporativa, despliegue ni validación GMP. Este párrafo sustituye el estado de C en curso de los cortes anteriores, conservados como historia.

**Checkpoint técnico B2 completado:** `49bfe41718fb6bbc0870ecb5a086e166f82106bc`. La matriz ejecutable reconcilia las 63 operaciones: 57 escrituras de negocio demostradas aisladamente, cinco streams/exclusiones justificados y probados, y TR09 transferida a C. OLD/NEW tipado, identidad autenticada, objetivos, atomicidad, idempotencia, criticidad técnica, documentos/originales, recuperación y negativas de bypass pasan sobre bases sintéticas. `pnpm quality` valida Prisma, 727 pruebas y build. Sin activación corporativa, aceptación GMP ni datos reales. C continúa desde este SHA en la misma rama y PR final; detalle en [PHASE_4B3_B2.md](PHASE_4B3_B2.md).

**Avance de importación/canal técnico:** PNT original (lote, conciliación, propuesta/confirmación/reimportación) integra captura, actor autenticado, recibos referenciados, rollback de segunda fila y concurrencia SERIALIZABLE. Caducidad de staging usa RPC limitado y eventos técnicos protegidos, sin falsos eventos de negocio. Recuperación ampliada y 13 smokes originales pasan; teardown de fixtures se limita a bases propias sin requisito ni journal. Fronteras de servidor conservan modo legado y rechazan metadata perdida tras migrar. La cobertura pendiente se centra ahora en otros ciclos de negocio/matriz63, checkpoint interno B2 y C; los cortes anteriores quedan como evidencia histórica, no como estado vigente.

**Baseline y cautelas de desarrollo:** [V1_BASELINE_AND_BACKLOG.md](V1_BASELINE_AND_BACKLOG.md). Los avances posteriores se recogen en este corte y en el registro fechado a continuación; las entradas antiguas conservan el estado de PR en su fecha, no su estado actual.

- **main:** `70d6a1348a93a9dd51d9beb75a32e2014f375ed3`, tras B1 / PR #142; 4B3-A / #141, 4B2 / #140, 4B1 / #139, 3B3 / #138 y anteriores conservados. Referencia B1: 701 pruebas y CI #645 integral verde.
- **4B1 integrada:** identidad OIDC, sesiones opacas revocables, usuarios/roles/ámbitos, guardas de servidor y autoría autenticada. Lectura global para usuarios activos/admitidos; actuaciones expresas y políticas sujetas a QA/DT. Informe, inventario, matriz y configuración posterior en [PHASE_4B1.md](PHASE_4B1.md). No despliegue corporativo ni identidades reales.
- **4B2 integrada (#140):** alternativas Docker Engine/Linux nativo, secretos/TLS/proxy, supervisión, manifiesto de release, backup PostgreSQL16 cifrado/autenticado y restauración a destinos nuevos con cotejo completo y revocación de sesiones recuperadas. Pruebas ficticias aisladas conservadas en CI/gate. Manual y dependencias IT/QA en [PHASE_4B2.md](PHASE_4B2.md); sin instalación corporativa ni cambios Prisma/migraciones. Integración técnica no implica aceptación productiva.
- **Revisión operativa de #140 integrada:** backup y retención exigen destino previamente preparado y montaje/identidad aprobados, sin crear una carpeta local de sustitución. Comprobaciones antes de generación/publicación y después del rename; monitor detecta almacenamiento perdido aun con copia reciente. Pruebas negativas de ausencia/desmontaje/sustitución y positivas de almacenamiento ficticio; se conserva recuperación desde custodia independiente sin origen/almacenamiento original. Inscripción de identidad corporativa y aceptación IT pendientes.
- **4B3-A integrada documentalmente (#141):** evaluación del historial real, matriz de riesgos, inventario de escrituras y diseño/pruebas en [PHASE_4B3_A.md](PHASE_4B3_A.md). Alcance GMP/criticidad y D01–D12 pendientes de QA/DT/IT; integrar el diseño no implica aprobar sus políticas.
- **4B3-B1 integrada (#142):** motor aditivo, captura SQL y journal protegido con propietario/migrador/aplicación separados en PostgreSQL16; exclusivamente piloto sintético. Rollback, identidad, concurrencia y recuperación verificadas; 701 tests/CI #645 sobre44cc8e1. Arquitectura, límites DBA y dependencias en [PHASE_4B3_B1.md](PHASE_4B3_B1.md); no política GMP global ni validación.
- **4B3-B2 completado técnicamente; C en curso:** misma rama desde70d6a13, sin PR intermedia. Checkpoint B2 `49bfe41718fb6bbc0870ecb5a086e166f82106bc`: 63/63 operaciones reconciliadas con evidencia o exclusión probada, captura SQL obligatoria y protegida, servicios/rutas reales de los siete módulos, custodia D05, criticidad técnica, recuperación y compatibilidad 4B1/4B2 verificadas. C desarrolla lectura por expediente, bandeja QA, revisión append-only y exportación controlada desde ese SHA, sin nueva aprobación intermedia (D-082). Captura corporativa no activada; sin despliegue ni validación GMP. Estado y límites en [PHASE_4B3_B2.md](PHASE_4B3_B2.md).
- **Revisión UX de #139 integrada con 4B1:** acciones y formularios de los siete módulos muestran las capacidades efectivas del usuario y el ámbito real del expediente. Se conserva la consulta global; alta, edición y seguimiento deniegan la entrada directa sin permiso. Revisión, cierre/anulación, relaciones, documentos, exportación, importación y administración tienen controles de presentación separados. El ejecutor visible procede de la sesión, conservando responsables, firmantes externos y autoría histórica. Las guardas de servidor, el modelo de autenticación, la matriz y las migraciones permanecen intactos. Regresión Chromium `phase4b1:ui:smoke` conservada en la CI completa.
- **7 módulos integrados como desarrollo:** Desviaciones, CAPA, Controles de Cambios, Reclamaciones, Devoluciones, Auditorías y PNT. Cierre técnico y funcional no implica validación GMP.
- **Auditorías:** la PR #123 añadió emisión Word PMAI V04 y PMAE V05 Anexo I, previsualización, versiones 00/01+, snapshot/bytes históricos. Se utilizaron plantillas oficiales para pruebas, pero **no está confirmada** la instalación en el entorno final ni aceptación visual/editable en Microsoft Word.
- **PNT:** pruebas con índice de 817 códigos únicos; importador/maestro/documentos integrados, sin prueba de que los 817 PNT reales estén importados, conciliados y verificados.
- **Fase 3:** cierre técnico integrado en el alcance autorizado. Dashboard D1C y mejoras 3B1/3B2 preservados. **Pendientes V1:** aceptación UX/documentos y corporativa de identidad/permisos/IT, datos/plantillas, alertas autorizadas y validación. 4B2 prepara infraestructura; instalación corporativa y 4B3 quedan pendientes.
- **Compatibilidad:** seguimiento requerido del parche de Next/React incorporado en #123, conforme a [CI_583_R4B_DIAGNOSIS.md](CI_583_R4B_DIAGNOSIS.md).
- **PR antiguas abiertas identificadas:** #11, #16, #17, #19, #20, #21, #76 y #112. Cierre separado, sin merge y solo tras verificar sustituciones.
- **Arquitectura futura:** modularidad, flujos versionados, inicio de sesión, firmas electrónicas y audit trail según riesgos son objetivos, no funcionalidades actualmente validadas o implantadas.

El baseline de consolidación fue documental. 3B3 conservó lógica y estado GMP; 4B1 incorpora únicamente la capa autorizada de identidad y permisos, sin alterar estados, reglas GMP ni históricos. Las entradas cronológicas siguientes conservan el estado en su fecha.

---

## Registro cronológico anterior (conservar para trazabilidad)

## Fase 3B3 — CI y regresión integral final (2026-10-12)

Base main `09ac7ce` tras #137; rama `feature/phase3b3-ci-final-regression`, única PR #138 abierta sin merge/squash. **Cierre técnico de Fase 3 comprobado**, pendiente de revisión e integración de esta PR: quality (536 tests/91 archivos), cinco grupos PostgreSQL/Chromium aislados —incluidos PNT con reinicio/autorización simulada y R4C— y `QMS final gate` verdes en run 38242113349 / `68ad7db`. El commit documental final también exige verificar nuevamente la CI completa; SHA y evidencia final en Checks/PR y artefacto del gate.

Regresión integral medida 7:31 frente a 14:04 de 3B2, ahora con mayor cobertura; inventario, matriz, comparación equivalente, contratos negativos del gate, benchmarks 3B1/3B2 reutilizados por identidad de código y configuración del check obligatorio en [PHASE_3B3.md](PHASE_3B3.md). Solo CI/instrumentación/documentación, sin cambios funcionales, datos reales, modelos/migraciones, GMP, plantillas ni D1C. No se modifican protecciones del repositorio ni se inicia IT, seguridad o implantación; no validación GMP ni autorización productiva.

## Fase 3B2 — Dashboard, PNT y metadatos documentales (2026-10-12)

Desde 3B1/main `6745212`, rama `feature/phase3b2-dashboard-pnt-documents`, una única PR para revisión sin squash ni merge. Alertas acotadas/últimos seguimientos/tendencia agregada, filtros y recuentos PNT en PostgreSQL con claves compactas/orden español conservado y metadatos sin binarios en Reclamaciones/Devoluciones. Comparaciones completas con main, cohortes sintéticas hasta 20.000, 2.000 maestros PNT, descargas/hashes históricos, calidad y regresiones QMS/documentales. Alcance, resultados y límites deliberados de orden/paginación en [PHASE_3B2.md](PHASE_3B2.md). Sin datos reales, cambios de modelos/migraciones, reglas GMP ni diseño D1C; CI y evidencias finales en la PR. No se inicia 3B3.

## Fase 3B1 — Filtros y paginación SQL (2026-10-12)

Desde D1C/main `aebf0c3`, rama `feature/phase3b1-list-fixes-pagination`, una única PR sin merge. Filtro CAPA previo a paginación, fechas estrictas/ámbitos de próxima revisión de Auditorías y recuentos Review con el cliente transaccional (pool=1). Desviaciones/CAPA/Cambios con páginas SQL de 25, total completo, orden estable/proyecciones de listado y retorno con filtros/página; exportaciones independientes y reglas/datos/GMP conservados. Regresiones PostgreSQL con 1.080 expedientes, Playwright 1440/768/390 y comparación equivalente main/3B1; alcance, resultados, suites adicionales PNT/R4C y operación segura en [PHASE_3B1.md](PHASE_3B1.md). CI final y artefactos en la PR/entrega. Sin Prisma/migraciones, formularios, dashboard ni reorganización general de CI.

## D1C — Rediseño visual del Dashboard (2026-10-11)

Desde D1B/main `5a53949` (#133), rama `feature/dashboard-d1c-visual-redesign`. Cabecera/filtros compactos, jerarquía de los cinco KPI, siete tarjetas de módulos, tareas responsive y tendencia discreta. Consultas, cálculos, navegación global, Prisma, migraciones y seed conservados. Pruebas D1B y nueva regresión Chromium D1C con capturas 1440/768/390; CI completa y artifacts en la PR única, sin merge. Alcance y reproducción en [DASHBOARD_D1C.md](DASHBOARD_D1C.md).


## P3C-1 — Maquetación responsive base PNT (2026-10-09)

Desde main `8705687954426f7cb38002d709f5c1ab123c0490`, rama `feature/pnt-p3c1-layout-responsive`. Presentación QMS de listado, formularios, ficha, pestañas y revisiones; dos/una columnas, tabla con scroll interno, foco visible y acciones separadas. Sin cambios funcionales, permisos, Prisma ni migraciones. Nuevo smoke de geometría/teclado a 1440/768/390 añadido a la CI existente, sin retirar regresiones. Decisiones y pendientes excluidos en `PNT_P3C1.md`; resultados/head finales en la única PR abierta para revisión, sin merge ni squash.

## P2C — Regresión conjunta final PNT (2026-10-09)

Ajuste final PR #110: la activación compara identidad completa del maestro con la revisión objetivo (código, título, código/nombre departamental congelados). Rechaza divergencias sin reescribir snapshots ni bloquear cambios legítimos del maestro para futuras revisiones. Smokes comprueban rechazo/rollback, recuperación mediante nueva revisión y evolución A/00 → B/01 conservando históricos. P1A/P2B/P2C PostgreSQL/Chromium y P2C autenticado verdes; 88 tests focalizados y quality final verde (434 tests/78 archivos). Misma rama/PR; sin nuevas funciones ni migraciones. Resultados actualizados en PNT_P2C.md y PR.

Sobre main `41f082908e87967fb9d355ca54237910dfd23d9e` (P2B fusionada), rama `feature/pnt-p2c-final-regression`. Regresión P1A/P1B-1/P1B-2/P2A/P2B y recorridos integrados sintéticos índice/manual hasta vigencia. Corregidos dos defectos comprobados: comparación de fecha original en lugar de vigencia operativa anterior e identidad maestro/revisión divergente (código permanente tras P2B y coincidencia al activar). Sin nuevas funciones, migraciones ni cambios QMS. Regresión técnica local superada: matriz 15/15, seis smokes PostgreSQL, seis Chromium y tres comprobaciones tras reinicio autenticado; quality verde (429 tests/78 archivos). Matriz, pruebas, CI y límites en [PNT_P2C.md](PNT_P2C.md); CI/head definitivos en la única PR abierta, sin merge ni squash. Validación funcional pendiente del usuario y cualificación/validación GMP pendiente; no se declara uso GMP validado.

## P2A — Documentos y evidencias por revisión de PNT

Corrección final de acceso: Historial excluye en servidor los eventos documentales cuando falta permiso read P2A, manteniendo P1A/P1B. Pruebas de presentación autorizada/no autorizada y de exclusión en consulta añadidas, sin cambios de almacenamiento/estados. Validación del ajuste: 57 tests afectados/7 archivos y navegador autorizado/no autorizado correctos; `pnpm quality` verde (403 tests/74 archivos).

Implementado en `feature/pnt-p2a-documents` desde main `236262e9ac861125dbc426744d4dc697f1e1b823`. Custodia PostgreSQL persistente, múltiples documentos/referencia por UUID de revisión, metadatos/hash, descarga y sustitución inmutable con historial. Importados mantienen estados/snapshots/procedencia. Acceso documental configurado en servidor; no aprobación/publicación/firma. Pruebas focalizadas P2A/P1A/P1B y quality; resultados finales en PR abierta. Arquitectura, configuración, límites y P2B en [PNT_P2A.md](PNT_P2A.md).

Validación local final: 53 tests afectados, cuatro smokes PostgreSQL/navegador P1A/P1B-1/P1B-2/P2A y reinicio autenticado correctos; `pnpm quality` verde (399 tests/73 archivos). Pendiente revisión de PR y configuración/cualificación operativa de acceso, almacenamiento y backups.

Fecha: 2026-10-08.

## R4A — Reclamaciones: cierre funcional

Implementación en `feature/complaints-r4a-functional`, desde main `4e09c3f`. Detalle y clasificación previa A/B/C/D en [COMPLAINTS_R4A.md](COMPLAINTS_R4A.md).

Versionado/seguimiento único QmsRecordVersion con fecha/motivo y bloqueo transaccional, UUID de propuestas y relaciones preservados en snapshots, Partes I/II y condiciones del PNT v03, III/IV históricos y V existente, listado SQL paginado y filtros nuevos. ComplaintFollowup y anexos v02 quedan conservados como legacy, sin migración ni backfill masivo. PDF y Review transversales se reutilizan.

Validación local: `pnpm quality` en Node 22 (334 tests/67 archivos, Prisma validate/generate, lint y build), pipeline PostgreSQL completo (36 smokes y seed demo), smoke R4A cliente/proveedor y UI 1440/768/390 con anexos oficiales. Regresión Review R2C y Auditorías R3A×3/R3B/R3C en navegador. La CI de la PR ejecuta quality y todos los smokes, incluido R4A.

La revisión UX/UI global queda aplazada hasta completar todos los módulos. El usuario ha contrastado RECLAMACIONES.docx; las aprobaciones se retiran de la UX conservando valores legacy en BD/snapshots, sin migración. El PNT y los tres anexos v03 reales se han revisado y sus hashes están documentados.

## R2A — Revisión visual en Reclamaciones

Estado: **IMPLEMENTADO EN RAMA; PENDIENTE DE VALIDACIÓN DEL PR**.

- catálogo estable de objetivos `FIELD`, `SECTION` e `ITEM` para Reclamaciones;
- modo revisión persistente por URL;
- marcadores y contador activo;
- drawer, formularios, hilos y resumen reutilizables;
- pestaña Revisión con navegación «Ir al campo»;
- asociación de nuevas observaciones a la versión funcional vigente y conservación de snapshots históricos;
- sin integración visual en Desviaciones, CAPA, Devoluciones ni Control de Cambios.

## Hitos completados
- Hito 0 — Especificación y arquitectura.
- Hito 1 — Núcleo técnico y base de datos.
- Hito 2 — Desviaciones completas.
- Hito 3 — Documentos y exportaciones.
- Hito 4 — Importación histórica 2025–2026.
- Hito 5 — Indicadores de Desviaciones.
- Hito 6 — CAPA.

## Hito 6 — CAPA
Estado: **COMPLETADO Y VALIDADO**.

### Fuente funcional
- GC-00/030/05, vigencia 02/02/2026.
- Anexo III oficial: Informe y seguimiento de Acción, revisión 05.
- Anexo IV oficial: Listado de seguimiento de CAPAs, revisión 05.
- Listado operativo actual: `02. LISTADO DE CAPAS (2025_).xlsx`.

### Módulo operativo
- listado principal y filtros;
- buscador;
- alta y edición;
- expediente a pantalla completa;
- correctivas/preventivas;
- origen y codificación de origen;
- causa raíz;
- acciones propuestas 1:N;
- seguimientos ilimitados 1:N;
- versión inicial 00 y seguimientos 01+;
- próxima fecha de seguimiento;
- referencia explícita de evidencia;
- estados Abierta/Cerrada/Cancelada;
- cierre operativo separado del cierre efectivo;
- eficacia Conforme/No conforme/Pendiente;
- N/A preservado solo como valor histórico;
- criterio, valoración y evidencia de eficacia;
- historial interno de modificaciones;
- relaciones QMS N:N;
- creación directa de CAPA desde una propuesta CAPA de Desviaciones.

### Reglas de cierre
- una CAPA abierta que continúa abierta requiere motivo y próxima fecha en el seguimiento;
- una CAPA cerrada requiere fecha de cierre operativo y conclusión;
- para cerrar operativamente debe existir referencia explícita de evidencia en un seguimiento;
- una CAPA cancelada requiere motivo;
- el cierre efectivo exige estado Cerrada, eficacia Conforme y valoración documentada;
- implantación y eficacia se mantienen separadas.

### Documentos y exportaciones
- generación del Anexo III DOCX desde la plantilla oficial v05;
- generación del Anexo IV XLSX por año desde la plantilla oficial v05;
- ampliación dinámica del Anexo IV sin truncar al superar las filas visibles de la plantilla;
- listado simple XLSX con las columnas operativas del listado 2026;
- listado simple filtrado;
- control SHA-256 de las plantillas;
- las plantillas se instalan localmente y no se versionan como binarios en Git.

SHA-256:
- Anexo III: `73c3d57ca5ae6f4e9644a4f1cbe416992de6b367973ba98cd67f7f0bd1fea540`.
- Anexo IV: `47f3d757c2c00cbcbdba9e4f7daf2cb4d804ce522a5e1145ab5260efd8147ac3`.

### Históricos CAPA 2025–2026
Fuente revisada:
- archivo: `02. LISTADO DE CAPAS (2025_).xlsx`;
- SHA-256: `a88f5024001b0a7d793b3f1f79c7aeb00b5e278d934297ed731e60e34c93ebfb`;
- 75 CAPA en 2025;
- 54 CAPA en 2026;
- total: 129;
- 108 cerradas;
- 21 abiertas;
- eficacia: 90 Conforme, 38 Pendiente, 1 N/A histórico;
- 51 registros 2026 con información de seguimientos;
- 54 registros 2026 con próxima fecha de seguimiento informada;
- 3 registros 2026 no presentes en Base_KPI, por lo que Base_KPI no se usa como fuente principal de migración.

Incoherencia bloqueante detectada:
- `AC/GC-11/001/2026` aparece dos veces y representa dos acciones diferentes. Ambas filas se rechazan en dry-run por duplicidad hasta revisión manual.

El importador:
- usa las hojas anuales como fuente principal;
- utiliza Base_KPI solo para enriquecer origen/eficacia cuando existe correspondencia;
- no inventa causa raíz ausente del listado;
- preserva el texto histórico y snapshot de cada fila;
- detecta duplicados;
- es dry-run por defecto;
- requiere confirmación explícita para aplicar;
- es idempotente.

### Indicadores CAPA
Desde PostgreSQL:
- total;
- abiertas actualmente;
- correctivas/preventivas;
- ejecución en plazo;
- mediana apertura → ejecución;
- pendientes de eficacia;
- eficacia conforme/no conforme;
- mediana ejecución → eficacia;
- distribución por departamento;
- distribución por origen;
- tendencia de 5 años.

Para CAPA con varias acciones, el plazo global de ejecución se compara contra la última fecha prevista de las acciones.

### Validación
- PostgreSQL 16 real;
- esquema y seed;
- smoke QMS;
- smoke de importación de Desviaciones;
- smoke de indicadores de Desviaciones;
- smoke de importación CAPA e idempotencia;
- smoke del ciclo de vida CAPA;
- validaciones unitarias de apertura/cierre/cancelación/eficacia;
- pruebas de expansión del Anexo IV;
- Prisma validate/generate;
- lint;
- tests;
- build Next.js.

## Punto de control
Desviaciones, CAPA y Controles de Cambios comparten ya la plataforma común de expedientes, relaciones, documentos, versionado e indicadores.


## Hito 6.1 — Versionado transversal
Estado: **IMPLEMENTADO Y VALIDADO EN CI**.

Implementación:
- nueva entidad común `QmsRecordVersion`;
- separación entre historial de cambios y versión funcional;
- Desviaciones V00 + V01/V02… por reapertura;
- preservación de fechas de cierre históricas;
- CAPA V00 + una versión por seguimiento;
- próxima fecha, estado, ejecución, eficacia y cierres incluidos en snapshot;
- pestaña Versiones en Desviaciones y CAPA;
- descarga de Anexo III para cualquier snapshot persistido;
- `GeneratedDocument` vinculado a la versión origen;
- backfill idempotente para expedientes existentes sin inventar versiones históricas inexistentes;
- smoke test PostgreSQL específico incluido en CI.

### Regla para históricos 2025–2026
Los expedientes existentes se convierten en un baseline `HISTORICAL_STATE`. Si una CAPA ya dispone de una secuencia de seguimiento conocida, el baseline adopta esa secuencia. No se crean artificialmente V00/V01 intermedias cuando el sistema anterior no conservaba el snapshot necesario para reconstruirlas.

## Continuidad tras Hito 6.1
El mecanismo `QmsRecordVersion` se reutiliza en Controles de Cambios para los seguimientos 00/01/02….


## Hito 7 — Controles de Cambios
Estado: **COMPLETADO Y VALIDADO EN CI**.

Fuente funcional:
- GC-00/003/03, revisión 03 de 06/04/2026.
- Anexo III: Solicitud de cambios.
- Anexo IV: Dictamen de cambios.
- Anexo V: Informe de Seguimiento y Control de un Cambio.
- Anexo VII: Listado de Controles de Cambio.

Implementación:
- módulo activado en navegación;
- listado principal con filtros horizontales, buscador y columnas operativas ampliadas;
- expediente a pantalla completa;
- Solicitud y Dictamen en el mismo expediente;
- plan de ejecución dinámico por departamento;
- bloqueo del baseline del Dictamen tras aprobación;
- seguimientos 00/01/02…;
- snapshot del estado de cada tarea por seguimiento;
- nuevas tareas de seguimiento con origen estructurado y etiqueta NUEVA Sxx;
- persistencia de esas tareas en seguimientos posteriores;
- ejecución, eficacia y cierre efectivo separados;
- cierre sin ejecución soportado con motivo documentado y eficacia No aplica;
- relaciones QMS e historial;
- versionado funcional reutilizando QmsRecordVersion;
- generación Anexo III, IV y V;
- descarga de Anexo V de cualquier versión histórica persistida;
- Anexo VII anual oficial;
- listado simple filtrado;
- pestaña de indicadores;
- configuración de formulario/plantillas v03;
- instalador de plantillas con validación SHA-256;
- smoke test PostgreSQL específico incluido en CI.

Plantillas auditadas:
- Anexo III SHA-256: a436d4aa732209e1aeb9620d5442a154a68899f875d1aa5d0dc437edd751a49f
- Anexo IV SHA-256: 742b1de11e0e0dece4e9c65c97613c112325189e183b9cb02c56ca82cd06cc60
- Anexo V SHA-256: 3012e81b0172c77c59c9c97514d788e10eb332a73e4490b9c0a1c87afa6ad1e4
- Anexo VII fuente SHA-256: b65671cdd652f104f4038c65e07c025b5c7374dee4b683d74fbeef55f12bc8eb

Validación:
- PostgreSQL 16 real;
- esquema y seed;
- smoke QMS existente;
- smoke específico del ciclo de vida de Controles de Cambios;
- versionado de seguimientos;
- Prisma validate/generate;
- lint;
- tests;
- build Next.js de producción.

El hito queda listo para integración en `main`.


## Hito 8 — Reclamaciones y Devoluciones
Estado: **COMPLETADO Y VALIDADO EN CI**.

### Reclamaciones
Fuente:
- GC-00/027/02, vigencia 26/05/2026.
- Anexo III: Informe de la Reclamación.
- Anexo IV: Informe de Respuesta a Reclamación.
- Anexo V: Listado de Reclamaciones.

Implementación:
- listado, filtros y búsqueda;
- alta/edición;
- expediente a pantalla completa;
- reclamación de cliente / a proveedor;
- investigación, impacto y causa raíz;
- Crítica/Mayor/Menor/Sin impacto GMP;
- resolución estructurada;
- CAPA propuestas 1:N y creación de CAPA real;
- comunicación y respuesta;
- eficacia y cierre;
- seguimientos;
- relaciones QMS;
- historial y snapshot V00;
- Anexos III/IV/V;
- listado simple;
- indicadores y tendencia 5 años.

### Devoluciones
Fuente:
- GC-00/028/03, vigencia 26/05/2026.
- Anexo III: Formulario de Devolución.
- Anexo IV: Hoja de Devolución de Producto.
- Anexo V: Declaración del Cliente sobre Conservación.
- Anexo VI: Listado de Devoluciones.

Implementación:
- listado, filtros y búsqueda;
- alta/edición;
- expediente a pantalla completa;
- productos 1:N;
- criterios SI/NO/N.A. para reintegración;
- evaluación específica de termolábiles;
- decisión GC/DT;
- destino final, destrucción y trazabilidad;
- seguimientos;
- relaciones QMS;
- historial y snapshot V00;
- Anexos III/IV/V/VI;
- listado simple;
- indicadores y tendencia 5 años.

Plantillas:
- Reclamaciones SHA-256: f717ae907da9ed8b575f740fbf8b1536d4157174de5b7b4d240220910b570df4
- Devoluciones SHA-256: 191c0e838f06d465bd820450b9130e1209c14fc9cb97559e8ec567819ba07f9a

Validación:
- PostgreSQL 16 real;
- esquema y seed;
- smoke QMS existente;
- smoke específico Reclamaciones + Devoluciones;
- relaciones Reclamación → Devolución y Reclamación → CAPA;
- Prisma validate/generate;
- lint;
- tests;
- build Next.js de producción.

El hito queda listo para integración en `main`.


## Hito 9 — Administración y evolución
Estado: **COMPLETADO Y VALIDADO EN CI**.

Implementación:
- centro de Administración con navegación propia;
- departamentos con vigencia y activación/desactivación;
- catálogos auxiliares y valores 1:N;
- política no destructiva;
- historial `ConfigurationChange`;
- versiones de formulario DRAFT/ACTIVE/RETIRED;
- clonación de versiones conservando configuración de campos;
- edición de metadatos de campos solo en borradores;
- bloqueo de versiones activas;
- activación con retirada automática de la versión anterior;
- registro de versiones de plantilla;
- carga DOCX/XLSX desde Administración;
- almacenamiento de plantilla en PostgreSQL;
- cálculo/verificación SHA-256;
- fallback a plantillas históricas instaladas;
- parámetros tipados;
- reglas de vencimiento configurables;
- bandeja central de próximos y vencidos;
- envío automático desactivado;
- smoke test específico de administración añadido a CI.

Validación:
- PostgreSQL 16 real;
- esquema y seed;
- smoke tests QMS existentes;
- smoke específico de Administración;
- catálogos, parámetros y reglas de vencimiento;
- clonación de formularios y conservación de configuración;
- almacenamiento binario de plantillas y checksum;
- Prisma validate/generate;
- lint;
- tests;
- build Next.js de producción.

El Hito 9 queda listo para integración en `main`.


## Hito 10 — Endurecimiento y demo
Estado: **COMPLETADO Y VALIDADO EN CI**.

Implementación:
- cabeceras HTTP de seguridad comunes para toda la aplicación;
- bloqueo de indexación por robots y cabecera `X-Robots-Tag`;
- health check real contra PostgreSQL con respuesta 503 degradada sin detalle técnico;
- páginas globales de error, recurso no encontrado y estado de carga;
- exportación lógica completa de todos los modelos Prisma;
- serialización explícita de fechas, bytes y bigint;
- checksum SHA-256 del backup;
- verificador de formato, modelos y recuentos;
- carpeta de backups excluida de Git;
- dataset ficticio idempotente con cinco expedientes `DEMO-`;
- relaciones ficticias Desviación → CAPA y Reclamación → Devolución;
- guardas que impiden ejecutar la carga demo sin `ALLOW_DEMO_DATA=true` o con `APP_ENV=production`;
- smoke test específico del Hito 10 integrado en CI.

Límites mantenidos:
- no se incorpora autenticación Entra ID;
- no se crean roles corporativos;
- no se activa envío automático de alertas;
- el backup lógico no se presenta como política corporativa de backup/DR;
- la V1 sigue identificada como herramienta piloto no validada GMP.

Validación final:
- PostgreSQL 16 real;
- seed base + dataset demo;
- smoke tests acumulados de Hitos 1–10;
- pruebas unitarias de cabeceras y serialización de backup;
- Prisma validate/generate;
- lint;
- tests;
- build Next.js de producción.


## Hito 10.2 — Anexos oficiales y adecuación de registros
Estado: **IMPLEMENTADO; PENDIENTE DE VALIDACIÓN FINAL EN CI**.

Objetivo:
- adaptar los generadores a los anexos aportados el 28/09/2026;
- comprobar que los registros estructurados contienen todos los datos necesarios para cumplimentar Word y listados;
- mantener históricos por versión de formulario/plantilla.

Cambios:
- Desviaciones Anexo V adaptado a la plantilla oficial A:F aportada, incluyendo fecha + departamento en una única celda y color ABIERTA/CERRADA según leyenda;
- CAPA Anexo IV mantiene campos combinados y colorea filas según la leyenda oficial;
- Reclamaciones incorpora REC-03 como versión candidata de prueba, manteniendo REC-02 para histórico;
- nuevo registro estructurado de Reclamaciones v03 alineado con Partes I y II del Anexo III;
- Reclamaciones v03 no genera respuesta formal al cliente desde la aplicación;
- Reclamaciones Anexo V anual se genera en XLSX oficial;
- Devoluciones incorpora fechas independientes de recepción/verificación por producto;
- Devoluciones incorpora firmante, puesto, fecha y observaciones de declaración del cliente;
- Anexos IV y V de Devoluciones se gestionan como plantillas independientes extraídas del PNT;
- Devoluciones Anexo VI anual se genera en XLSX oficial;
- matriz de anexos y SHA-256 documentada en `docs/ANNEX_MAPPING.md`.

Nota GMP:
GC-00/027/03 se configura únicamente como versión candidata para esta fase de prueba porque el usuario ha indicado que todavía no está formalmente en vigor. Su activación productiva deberá coincidir con la entrada en vigor documental correspondiente.


## Hito 10.8C3-B1 — Modelo y reglas transversales de relaciones QMS
Estado: **IMPLEMENTADO Y VALIDADO EN CI**.

Infraestructura común:
- matriz direccional única para Desviación → CAPA, Reclamación → CAPA y Reclamación → Devolución;
- validación de ambos extremos como IDs reales de `QmsRecord`;
- creación idempotente mediante la unicidad `(sourceRecordId, targetRecordId, relationType)`;
- reactivación de una relación desactivada sin crear otra fila;
- consultas comunes de relaciones salientes y entrantes para derivar la vista inversa;
- errores funcionales para combinaciones inválidas, autorrelaciones e IDs inexistentes;
- escritura centralizada desde Desviaciones, CAPA, Reclamaciones, Devoluciones y carga DEMO;
- Control de Cambios excluido de las nuevas relaciones operativas.

No se modifica el versionado funcional, anexos, plantillas ni generadores documentales.

Validación:
- PostgreSQL 16, esquema, seed y dataset DEMO;
- auditoría histórica: 0 relaciones incompatibles detectadas en el dataset de CI;
- smoke transversal de relaciones y smoke tests acumulados;
- Prisma validate/generate;
- 75 tests unitarios;
- lint sin avisos;
- build Next.js de producción.

## Hito 10.8C3-B2.1 — Flujo canónico Desviación → CAPA
Estado: **COMPLETADO, VALIDADO Y FUSIONADO EN MAIN (PR #39)**.

Cambios limitados a backend:
- una propuesta `DeviationCapaPlan` en estado `PROPOSED` puede generar una única CAPA real;
- la propuesta se marca `REGISTERED` y conserva `linkedCapaRecordId` únicamente para identificar qué propuesta originó qué CAPA;
- la relación de negocio se crea una sola vez mediante `QmsRelation` Desviación → CAPA;
- cuando existe `fromDeviationPlanId`, se omite la creación genérica adicional basada en `originCode`;
- `originType` y `originCode` de la CAPA se canonicalizan desde la Desviación de la propuesta;
- dos propuestas distintas de la misma Desviación pueden generar dos CAPA distintas;
- propuestas ya registradas o canceladas no pueden generar una CAPA adicional;
- actualización de propuesta y creación de relación permanecen dentro de la misma transacción de alta de CAPA.

B2.1 no incluye rediseño visual ni prueba transversal manual.

## Hito 10.8C3-B2.2 — UX y navegación Desviación ↔ CAPA
Estado: **COMPLETADO, VALIDADO Y FUSIONADO EN MAIN (PR #40)**.

Cambios de interfaz:
- el resumen de Desviación muestra cada propuesta CAPA una sola vez;
- una propuesta `PROPOSED` ofrece `Crear CAPA`;
- una propuesta `REGISTERED` muestra su código y ofrece `Abrir CAPA`;
- una propuesta `CANCELLED` no ofrece crear CAPA;
- se elimina del resumen el bloque redundante adicional de CAPA vinculadas;
- la pestaña `Relaciones` conserva la vista derivada desde `QmsRelation`;
- en CAPA, el código de origen enlaza al expediente cuando existe un único origen QMS;
- las tarjetas de origen identifican explícitamente `Desviación de origen` o `Reclamación de origen`.

Se añaden pruebas unitarias para la lógica de navegación de propuestas.

## Hito 10.8C3-B2.3 — Prueba transversal Desviación → dos CAPA
Estado: **COMPLETADO Y VALIDADO EN CI — PR #41**.

Se añade un smoke transversal con PostgreSQL real que comprueba:
- una Desviación con dos propuestas CAPA independientes;
- ambas propuestas comienzan en `PROPOSED`;
- cada propuesta genera una CAPA distinta;
- ambas propuestas terminan en `REGISTERED` y conservan su `linkedCapaRecordId`;
- existen exactamente dos `QmsRelation` `Desviación → CAPA`;
- repetir la creación lógica de la misma relación no duplica filas;
- no existen relaciones inversas artificiales `CAPA → Desviación`;
- cada CAPA recupera la misma Desviación como origen mediante la vista inversa;
- la lógica de navegación de cada propuesta registrada devuelve `Abrir CAPA`;
- los enlaces QMS de ida y vuelta se resuelven con el identificador del expediente correcto.

El smoke queda registrado como `pnpm b2-3:smoke` y se ejecuta en el workflow CI antes del smoke general de Hito 10.

## Hito 10.8C3-B3.1 — Flujo canónico Reclamación → CAPA
Estado: **COMPLETADO, VALIDADO Y FUSIONADO EN MAIN (PR #42)**.

Cambios limitados a backend:
- una propuesta `ComplaintCapaPlan` en estado `PROPOSED` puede generar una única CAPA real;
- la propuesta se marca `REGISTERED` y conserva `linkedCapaRecordId` solo para identificar qué propuesta originó qué CAPA;
- la relación de negocio se crea una sola vez mediante `QmsRelation` Reclamación → CAPA;
- cuando existe `fromComplaintPlanId`, no se crea además otra relación mediante `originCode`;
- `originType` y `originCode` se canonicalizan desde la Reclamación real asociada a la propuesta;
- propuestas registradas o canceladas no pueden generar una CAPA adicional;
- el cambio de propuesta a `REGISTERED` se protege con actualización condicionada dentro de la misma transacción;
- la creación directa desde `fromComplaintId` usa también una única relación explícita y no duplica el intento mediante `originCode`;
- las CAPA creadas manualmente sin origen explícito conservan el fallback existente por `originCode`.

Se añaden pruebas unitarias del flujo canónico, reutilización bloqueada, cambio concurrente y creación directa.

## Hito 10.8C3-B3.2 — UX y navegación Reclamación ↔ CAPA
Estado: **COMPLETADO, VALIDADO Y FUSIONADO EN MAIN (PR #43)**.

Cambios de interfaz:
- Reclamaciones y Desviaciones reutilizan una única lógica compartida de estados/navegación de propuestas CAPA;
- una propuesta `PROPOSED` muestra `Pendiente` y ofrece `Crear CAPA`;
- una propuesta `REGISTERED` muestra `Registrada`, su código y `Abrir CAPA`;
- una propuesta `CANCELLED` muestra `Cancelada` y no ofrece crear otra CAPA;
- el resumen de Reclamación usa tarjetas vinculadas coherentes con Desviaciones;
- la navegación abre el expediente CAPA a través del resolver QMS;
- la pestaña `Relaciones` sigue mostrando todas las relaciones reales Reclamación → CAPA/Devolución;
- la vista CAPA → Reclamación de origen ya queda cubierta por la UX común introducida en B2.2.

La lógica compartida conserva pruebas unitarias para los tres estados.

## Hito 10.8C3-B3.3 — Prueba transversal Reclamación → dos CAPA
Estado: **COMPLETADO Y VALIDADO EN CI — PR #44**.

Se añade un smoke transversal con PostgreSQL real que comprueba:
- una Reclamación con dos propuestas CAPA independientes;
- ambas propuestas comienzan en `PROPOSED`;
- cada propuesta genera una CAPA distinta;
- ambas propuestas terminan en `REGISTERED` con su `linkedCapaRecordId` y código CAPA;
- existen exactamente dos `QmsRelation` `Reclamación → CAPA`;
- reintentar la misma relación no crea filas duplicadas;
- no existen relaciones inversas artificiales `CAPA → Reclamación`;
- cada CAPA recupera la misma Reclamación como origen mediante la vista inversa;
- la lógica compartida de navegación devuelve `Abrir CAPA` para ambas propuestas registradas;
- los enlaces QMS de ida/vuelta resuelven el expediente correcto.

El smoke queda registrado como `pnpm b3-3:smoke` y se ejecuta permanentemente en CI.

## Hito 10.8C3-B4.1 — Flujo canónico Reclamación → Devolución
Estado: **COMPLETADO, VALIDADO Y FUSIONADO EN MAIN (PR #45)**.

Cambios limitados a backend:
- cuando una devolución se crea con `fromComplaintId`, la Reclamación se resuelve dentro de la misma transacción;
- si la Reclamación ya no existe, el alta falla con un mensaje funcional y no se crea una devolución huérfana;
- `returnType` se canonicaliza a `COMPLAINT`;
- `relatedDocument` se canonicaliza al código de negocio de la Reclamación real;
- la relación de negocio se crea una sola vez como `QmsRelation` Reclamación → Devolución;
- una misma Reclamación puede originar varias Devoluciones distintas;
- reintentar la misma relación exacta sigue siendo idempotente por la capa común de relaciones;
- las Devoluciones creadas manualmente sin `fromComplaintId` mantienen su comportamiento actual.

Se añaden pruebas unitarias para resolución de origen, origen inexistente, varias devoluciones por reclamación e idempotencia.

## Hito 10.8C3-B4.2 — UX y navegación Reclamación ↔ Devolución
Estado: **COMPLETADO, VALIDADO Y FUSIONADO EN MAIN (PR #46)**.

Cambios de interfaz:
- al crear una Devolución desde una Reclamación, el campo Tipo se muestra fijado a `Reclamación`;
- el Documento relacionado se muestra fijado al código de la Reclamación de origen;
- ambos valores se envían mediante campos ocultos y coinciden con la canonicalización del servidor;
- el Resumen de Devolución muestra el Documento relacionado como enlace cuando existe un único origen QMS;
- el Resumen incorpora una tarjeta `Reclamación de origen` navegable;
- la pestaña `Relaciones` conserva la vista inversa derivada de la única `QmsRelation` Reclamación → Devolución;
- la Reclamación continúa mostrando sus Devoluciones derivadas sin duplicar relaciones.

## Hito 10.8C3-B4.3 — Prueba transversal Reclamación → dos Devoluciones
Estado: **COMPLETADO, VALIDADO Y FUSIONADO EN MAIN (PR #47)**.

Se añade un smoke transversal con PostgreSQL real que comprueba:
- una Reclamación que origina dos Devoluciones distintas;
- ambas Devoluciones conservan `returnType = COMPLAINT`;
- ambas conservan como `relatedDocument` el código real de la Reclamación;
- cada Devolución incluye producto ficticio propio para simular el flujo real;
- existen exactamente dos `QmsRelation` Reclamación → Devolución;
- reintentar la misma relación no crea filas duplicadas;
- no existen relaciones inversas artificiales Devolución → Reclamación;
- cada Devolución recupera la Reclamación como origen mediante la vista inversa;
- la Reclamación recupera las dos Devoluciones como expedientes derivados;
- los enlaces QMS ida/vuelta resuelven el expediente correcto.

El smoke queda registrado como `pnpm b4-3:smoke` y se ejecuta permanentemente en CI.

## Hito 10.8C3-C1 — Flujo canónico de seguimiento y versión CAPA
Estado: **COMPLETADO, VALIDADO Y FUSIONADO EN MAIN (PR #48)**.

Diagnóstico:
- `QmsRecordVersion` ya soportaba correctamente V00 y V01/V02… por seguimiento;
- el Anexo III histórico ya puede generarse desde cualquier snapshot persistido;
- el formulario de seguimiento solo registraba texto, evidencia y próxima fecha;
- para cambiar estado, cierre operativo o eficacia era necesario editar la CAPA por separado, lo que podía actualizar la versión vigente antes de crear el siguiente seguimiento.

Cambios:
- el seguimiento CAPA incorpora el estado que debe quedar vigente después del seguimiento;
- puede registrar en la misma operación estado Abierta/Cerrada/Cancelada, cierre operativo y conclusión;
- puede actualizar eficacia, criterio, valoración, evidencia y cierre efectivo;
- las reglas de cierre ya documentadas se validan antes de persistir;
- una CAPA que permanece abierta sigue requiriendo motivo y próxima fecha;
- el cierre operativo requiere fecha, conclusión y evidencia de ejecución en el seguimiento actual o en uno anterior;
- una cancelación requiere motivo;
- el cierre efectivo requiere estado Cerrada, eficacia Conforme y valoración documentada;
- seguimiento, actualización del expediente, historial y creación de V01/V02 se ejecutan en una única transacción;
- no se añaden campos nuevos a Prisma: el estado histórico de cada seguimiento se conserva en el snapshot funcional `QmsRecordVersion`.

Se añaden pruebas unitarias de las transiciones.

## Hito 10.8C3-C2 — UX e histórico de seguimientos CAPA
Estado: **COMPLETADO, VALIDADO Y FUSIONADO EN MAIN (PR #49)**.

Cambios de interfaz:
- el formulario identifica explícitamente qué seguimiento y versión V01/V02… se va a crear;
- la captura se organiza en tres bloques: seguimiento/evidencia, estado/cierre operativo y verificación de eficacia;
- estado y eficacia parten de los valores vigentes del expediente;
- los campos de cierre/cancelación se muestran según el estado seleccionado;
- ejecución/cierre operativo y eficacia se presentan como conceptos separados;
- cada tarjeta histórica de seguimiento resuelve la `QmsRecordVersion` exacta mediante `sourceEntityId`, con fallback por secuencia para históricos;
- cada seguimiento muestra versión, estado CAPA, eficacia y si la versión es histórica o vigente;
- se muestran cierre operativo, cierre efectivo y próxima fecha correspondientes;
- desde el propio seguimiento se puede descargar el Anexo III de esa versión exacta;
- se añade helper probado para resolver seguimiento ↔ versión y calcular la siguiente secuencia.

No se modifica el modelo de datos ni las reglas de transición de C1. Queda pendiente C3: prueba transversal V00 → V01 → V02 con documentos históricos.


## Hito 10.8C3-C3 — Prueba transversal CAPA V00 → V01 → V02
Estado: **EN VALIDACIÓN EN RAMA**.

Se añade un smoke PostgreSQL con la acción real de seguimiento: V00 abierta y eficacia pendiente; V01 abierta con actuación, evidencia y próxima fecha; V02 cerrada con cierre operativo y eficacia conforme. Comprueba snapshots históricos, congelación de V00/V01, vínculo `sourceEntityId` y resolución del histórico sin modificar C1/C2.

Se corrige la interpretación de `?version=0/1/2` en la descarga de Anexo III, que anteriormente trataba esas peticiones como versión vigente. El parser tiene pruebas para V00, V01, V02 e inválidos.

`pnpm c3:smoke` verifica el ciclo y limpia sus datos ficticios. Con el servidor en marcha y la plantilla oficial instalada, `C3_BASE_URL=<URL de la app> pnpm c3:smoke` descarga los tres DOCX, inspecciona el contenido diferenciado y comprueba el vínculo `GeneratedDocument.recordVersionId`. Sin `C3_BASE_URL`, el smoke no afirma haber probado los documentos.


## Mejora transversal — Anulación administrativa de expedientes
Estado: **IMPLEMENTADA EN RAMA; PENDIENTE DE VALIDACIÓN FINAL**.

- aplica a Desviaciones, CAPA, Controles de Cambios, Reclamaciones y Devoluciones;
- no existe borrado físico;
- motivo y usuario obligatorios;
- conservación del código histórico y liberación del código para reutilización;
- filtro común Activos / Anulados / Todos, con Activos por defecto;
- expedientes anulados identificados expresamente;
- relaciones históricas conservadas e identificadas;
- bloqueo de nuevas relaciones con anulados;
- reactivación condicionada a que el código original continúe libre;
- exportaciones e indicadores excluyen anulados por defecto.

## D2.3 — Estado Borrador de Desviaciones
Estado: **IMPLEMENTADO EN RAMA; PENDIENTE DE VALIDACIÓN**.

- se añade `DRAFT` a Desviaciones;
- permite guardar expedientes incompletos sin perder el contenido;
- muestra en rojo los campos pendientes necesarios para abrir;
- incorpora acciones `Guardar borrador` y `Abrir desviación`;
- la apertura exige validación completa;
- no permite volver a Borrador una vez abierta/cerrada;
- separa Borradores de Abiertas en el listado y contadores;
- excluye borradores de indicadores, vencimientos/seguimientos y exportaciones por defecto;
- bloquea la generación de Anexo III en borrador;
- deja preparado D3 para asignar la codificación oficial al pasar de Borrador a Abierta.

## D3 — Codificación sugerida/controlada de Desviaciones
Estado: **IMPLEMENTADO EN RAMA; PENDIENTE DE VALIDACIÓN**.

- la interfaz calcula y muestra la siguiente codificación sugerida según departamento y año;
- el usuario puede aceptar la sugerencia o escribir manualmente otra codificación válida;
- un borrador sin código no consume numeración;
- si el borrador se guarda con código, dicho código queda reservado;
- al abrir sin código, la aplicación asigna automáticamente el siguiente disponible;
- la numeración es segura frente a concurrencia mediante bloqueo transaccional PostgreSQL;
- se comprueban códigos activos y anulados para impedir reutilización histórica;
- una vez abierta la desviación, el código queda fijado;
- se mantienen pruebas unitarias y smoke PostgreSQL concurrente integrado en CI.

## D4 — Desvinculación Desviación ↔ CAPA
Estado: **IMPLEMENTADO EN RAMA; PENDIENTE DE VALIDACIÓN**.

- botón Desvincular disponible desde la pestaña Relaciones de Desviaciones;
- botón Desvincular disponible desde la vista inversa de CAPA;
- la operación solo desactiva la `QmsRelation` canónica;
- no elimina ni modifica el expediente CAPA;
- ambas vistas dejan de mostrar la relación inmediatamente;
- la relación puede reactivarse mediante el flujo normal de vinculación sin crear duplicados;
- se registra historial operativo de la desvinculación en el expediente desde el que se ejecuta;
- pruebas del servicio común cubren desvinculación, consulta en ambos sentidos y reactivación.

## D6 — Prueba transversal final de Desviaciones
Estado: **IMPLEMENTADO EN RAMA; PENDIENTE DE CI Y VALIDACIÓN MANUAL FINAL**.

La prueba transversal cubre:
- orden y presencia de los bloques del formulario aprobados;
- guardado de Borrador incompleto sin bloqueo;
- bloqueo de apertura cuando faltan obligatorios;
- validación condicional de A. Origen;
- sugerencia y reserva manual de codificación;
- asignación automática del siguiente correlativo;
- relación Desviación → CAPA;
- desvinculación y revinculación sin borrar expedientes ni duplicar relaciones;
- seguimiento del expediente;
- versionado V00 → V01 y congelación de la versión histórica;
- snapshot compatible con generación de Anexo III;
- exclusión de Borradores de los indicadores operativos.

D5 se ejecutará después de cerrar D6: primero se congela el comportamiento funcional de Desviaciones y después se extraen los patrones reutilizables para otros módulos con pruebas de regresión sobre esta base.

## D5.1 — Conservación transversal de formularios tras error
Estado: **IMPLEMENTADO EN RAMA; PENDIENTE DE VALIDACIÓN**.

- se centraliza la serialización de los valores enviados y la revisión del formulario en `src/lib/forms/preserved-state.ts`;
- CAPA, Controles de Cambios, Reclamaciones y Devoluciones conservan los valores introducidos cuando falla una validación funcional o la persistencia;
- los formularios reutilizan los valores enviados al volver a renderizarse tras el error;
- las listas dinámicas controladas en React se mantienen sin reconstruirse desde cero;
- se añaden pruebas unitarias del mecanismo común;
- Desviaciones mantiene el comportamiento ya validado y queda como referencia funcional del patrón.



## D5.2 — Relaciones y desvinculación reutilizable
Estado: **IMPLEMENTADO EN RAMA; PENDIENTE DE VALIDACIÓN**.

- se centraliza la vinculación por código en `linkOperationalRelationByBusinessCode`;
- se centraliza la desvinculación desde cualquiera de los extremos en `deactivateOperationalRelation`;
- Desviaciones y CAPA reutilizan el patrón común ya validado en D-046;
- Reclamaciones incorpora desvinculación tanto de CAPA como de Devoluciones;
- Devoluciones incorpora desvinculación de la Reclamación de origen;
- revincular reactiva la misma fila `QmsRelation` y no crea duplicados;
- se conserva la dirección canónica Desviación → CAPA, Reclamación → CAPA y Reclamación → Devolución;
- se añaden pruebas unitarias del ciclo vincular → desvincular → revincular desde extremos inversos.


## D5.2b — Buscador dinámico al vincular expedientes
Estado: **IMPLEMENTADO EN RAMA; PENDIENTE DE VALIDACIÓN**.

- autocompletado reutilizable en el formulario común de relaciones;
- aplicado a Desviaciones, CAPA, Reclamaciones y Devoluciones;
- consulta dinámica por código mientras se escribe;
- muestra únicamente expedientes activos del tipo compatible seleccionado;
- excluye el expediente actual y relaciones ya activas;
- soporta navegación por teclado y selección con ratón;
- cambiar el tipo relacionado actualiza las sugerencias;
- el backend sigue siendo la autoridad final para validar y persistir la relación.


## D5.3 — Codificación sugerida/controlada transversal
Estado: **IMPLEMENTADO EN RAMA; PENDIENTE DE VALIDACIÓN**.

- reutiliza el patrón seguro ya validado en Desviaciones;
- añade sugerencia dinámica en altas de CAPA, Control de Cambio, Reclamación y Devolución;
- permite aceptar sugerencia, introducir un código manual válido o dejarlo vacío para asignación automática al guardar;
- asignación definitiva protegida por bloqueo transaccional PostgreSQL;
- evita duplicados incluyendo codificaciones históricas anuladas;
- la codificación queda bloqueada en edición;
- los códigos históricos existentes no se reformatean;
- smoke PostgreSQL `d5-3:smoke` incorporado a CI.


## D5.4A — Borrador transversal · CAPA
Estado: **IMPLEMENTADO EN RAMA; PENDIENTE DE CI Y VALIDACIÓN MANUAL**.

- nuevo estado CAPA `DRAFT`;
- alta inicial en Borrador;
- guardado incompleto permitido;
- validación completa al pasar a Abierta;
- codificación asignada/fijada al abrir;
- prohibido volver a Borrador desde estados operativos;
- seguimientos, relaciones nuevas y Anexo III bloqueados mientras está en Borrador;
- Borradores excluidos de KPI y exportaciones;
- contador y filtro específico de Borradores en listado;
- origen procedente de propuesta se conserva pendiente y se formaliza al abrir.


## D5.4B — Borrador transversal · Control de Cambios
Estado: **IMPLEMENTADO EN RAMA; PENDIENTE DE CI**.

- `ChangeFinalStatus` incorpora `DRAFT`;
- alta inicial en Borrador;
- guardado incompleto permitido;
- validación completa de la solicitud al pasar a Abierto;
- codificación asignada/fijada al abrir;
- prohibido volver a Borrador desde estados operativos;
- seguimientos, relaciones nuevas y Anexos III/IV/V bloqueados mientras está en Borrador;
- Borradores excluidos de KPI y exportaciones;
- filtro y contador específico de Borradores en listado;
- pruebas unitarias específicas D5.4B.


## D5.4C — Borrador transversal · Reclamaciones
Estado: **IMPLEMENTADO EN RAMA; PENDIENTE DE CI**.

- `ComplaintStatus` incorpora `DRAFT`;
- alta inicial en Borrador;
- guardado incompleto permitido;
- validación completa al pasar a Abierta;
- codificación asignada/fijada al abrir;
- prohibido volver a Borrador desde estados operativos;
- seguimientos, relaciones, CAPA/Devoluciones derivadas y Anexos III/IV bloqueados mientras está en Borrador;
- Borradores excluidos de KPI y exportaciones;
- filtro y contador específico de Borradores;
- pruebas unitarias específicas D5.4C.


## D5.4D — Borrador transversal · Devoluciones
Estado: **IMPLEMENTADO EN RAMA; PENDIENTE DE CI**.

- `ReturnStatus` incorpora `DRAFT`;
- alta inicial en Borrador;
- guardado incompleto permitido;
- validación completa al pasar a Abierta;
- codificación asignada/fijada al abrir;
- prohibido volver a Borrador desde estados operativos;
- seguimientos, relaciones y Anexos III/IV/V bloqueados mientras está en Borrador;
- Borradores excluidos de KPI y exportaciones;
- filtro y contador específico de Borradores;
- origen desde Reclamación preservado como pendiente hasta la apertura;
- pruebas unitarias específicas D5.4D.


## D5.5 — Filtros multiselección transversales
Estado: **IMPLEMENTADO EN RAMA; PENDIENTE DE CI**.

- componente reutilizable de filtro multiselección;
- parámetros repetidos en URL;
- multiselección transversal en los cinco listados QMS;
- Año y Departamento/Área multiseleccionables;
- estados/tipos/clasificaciones/eficacia/origen/ejecución/decisión multiseleccionables según módulo;
- filtros administrativos y filtros lógicos exclusivos permanecen simples;
- exportación simple conserva las selecciones múltiples;
- pruebas unitarias de helpers de query.


## D5.6 — Regresión transversal final
Estado: **IMPLEMENTADO EN RAMA; PENDIENTE DE CI**.

- nuevo smoke `pnpm d5-6:smoke`;
- valida Borrador → operativo en los cinco módulos;
- comprueba contratos transversales de codificación;
- comprueba presencia de reglas de relaciones QMS;
- comprueba bloqueo de documentos oficiales en Borrador;
- comprueba integración de filtros multiselección;
- se ejecuta junto a los smoke PostgreSQL, códigos, relaciones, versionado y documentos ya existentes;
- sin cambios Prisma ni nuevas reglas funcionales.


## R1 — CAPA · Bloque 1 funcional + UX
Estado: **COMPLETADO Y FUSIONADO EN `main` mediante PR #77; CI #409 verde y validación manual realizada.**.

- PR #77 fusionado por squash en `main` (`e52f50f`);
- separación entre Seguimientos funcionales (`QmsRecordVersion`) y Seguimiento de la acción;
- nuevo `CapaActionFollowup` sin backfill destructivo de `CapaFollowup`;
- formularios Nueva/Editar alineados con siete apartados: Identificación/origen, Defecto/causa raíz, Acción propuesta, Seguimiento de la acción, Evaluación de eficacia, Estado operativo y Conclusión;
- Guardar borrador / Guardar CAPA / Guardar como nuevo seguimiento;
- multiorigen Desviación/Reclamación con `QmsRelation` canónica;
- próxima fecha persistida en `Capa.nextFollowupDate`;
- detalle reorganizado y Acciones integradas en Resumen;
- pestaña Versiones renombrada conceptualmente a Seguimientos;
- listado actualizado con próximo seguimiento, cierre/ejecución y verificación final;
- campos históricos ocultos en la nueva UX se conservan;
- retirada la captura independiente de evidencia de ejecución; Seguimiento de la acción queda alineado con Anexo III (Fecha, Descripción y Observaciones);
- PDFs por versión, Anexo III multiorigen completo y componente documental transversal quedan para Bloque 2.

## R2A — CAPA · Anexo III + metadata por seguimiento
Estado: **COMPLETADO Y FUSIONADO EN `main` mediante PR #78**.

- Seguimiento 00/01/02… persistido como `QmsRecordVersion`;
- Anexo III descargable por versión histórica;
- fecha/motivo propios por seguimiento y multiorigen congelado en snapshot;
- `CapaActionFollowup` alimenta el apartado Seguimiento de la acción;
- orden descendente de seguimientos, colores de eficacia y regla de próximo seguimiento cerrada según validación manual.

## R2B — CAPA · PDF firmado por seguimiento + componente documental transversal
Estado: **COMPLETADO, VALIDADO Y FUSIONADO EN `main` mediante PR #79**.

- `main` tras PR #79: `e757967d92284d2f84b451187d1b13e32e949d1e`;
- PDF firmado independiente por Seguimiento 00/01/02… mediante `RecordVersionDocument`;
- carga, descarga y sustitución desde la pestaña Seguimientos;
- motivo obligatorio al sustituir y registro en historial operativo;
- bloqueo servidor de carga en CAPA Borrador;
- validación de PDF, cabecera, tamaño y pertenencia de `recordVersionId`;
- componente visual y servicio documental compartidos con Desviaciones;
- smoke PostgreSQL `pnpm r2b-documents:smoke` integrado en CI y smoke existentes conservados;
- pestaña Documentos de CAPA convertida en resumen documental;
- sin migración Prisma, sin `CapaDocument`, sin firma electrónica y sin cambios a CC/Reclamaciones/Devoluciones.

## R3 — CAPA · Regresión final
Estado: **IMPLEMENTADO EN RAMA `feature/capa-r3-final-regression`; PENDIENTE DE VALIDACIÓN MANUAL**.

- smoke PostgreSQL transversal `pnpm r3-capa:smoke`;
- cubre Borrador → Abierta → Seguimiento 01 → Seguimiento 02 → Cerrada;
- comprueba V00/V01/V02, congelación histórica, `sourceEntityId`, motivo, fecha y metadata;
- genera Anexo III por cada versión con el generador productivo y una plantilla temporal controlada en PostgreSQL; verifica contenido histórico, orígenes congelados, `CapaActionFollowup` y `GeneratedDocument.recordVersionId`;
- comprueba PDF firmado independiente por versión, descarga, sustitución con motivo, historial, pertenencia de versión, cabecera y tamaño;
- comprueba relaciones canónicas multiorigen sin inversas artificiales y conservación del histórico al cambiar relaciones vigentes;
- mantiene `CapaFollowup` sin backfill ni modificación destructiva;
- mantiene los smoke existentes, incluido `pnpm d6:smoke` para regresión de Desviaciones;
- no introduce reglas GMP nuevas, rediseños, cambios Prisma ni extensión documental a otros módulos.

## R1 — Núcleo transversal de revisión/comentarios
Estado: **IMPLEMENTADO EN RAMA `feature/review-comments-r1-core`; VALIDADO LOCALMENTE Y EN CI DEL PR #89**.

- enums `ReviewThreadStatus` y `ReviewTargetKind`;
- modelos transversales `ReviewThread` y `ReviewMessage`, vinculados a `QmsRecord` y opcionalmente a `QmsRecordVersion`;
- objetivos de expediente, sección, campo y elemento dinámico con `targetEntityType` + `targetEntityId` estable;
- snapshots deliberadamente inmutables de etiqueta y valor visto por el revisor;
- servicio transaccional común para crear, responder, aceptar y resolver;
- aceptación y resolución idempotentes, sin reapertura ni borrado;
- consultas comunes con mensajes cronológicos, filtro por estado/versión, orden por estado y conteos;
- Server Actions con errores controlados y actor textual existente;
- eventos de alto nivel en `ChangeHistory` para creación, aceptación y resolución;
- smoke PostgreSQL `pnpm review-r1:smoke` integrado en CI;
- sin cambios visuales en expedientes, sin bloqueo de cierre y sin cambios en reglas GMP, versionado, anexos o documentos.

## R2B1 — Revisión/comentarios · Desviaciones
Estado: **IMPLEMENTADO EN RAMA `feature/review-comments-r2b1-deviations`; PENDIENTE DE CI Y VALIDACIÓN MANUAL**.

- reutiliza los componentes transversales de R2A sin crear una UI paralela;
- añade Modo revisión y pestaña Revisión al detalle de Desviaciones;
- incorpora targets estables para identificación, origen, descripción, investigación, causa raíz, recurrencia, impacto, acciones y conclusión/disposición;
- acciones inmediatas y propuestas CAPA se revisan por UUID real mediante targets ITEM;
- «Ir al campo» conserva pestaña, modo de revisión, hilo y anchor estable;
- observaciones vinculadas a la versión funcional vigente cuando existe y soporte para históricos sin versión funcional;
- smoke `pnpm review-r2b1:smoke` integrado en CI;
- sin cambios funcionales en formularios, estados, reglas de cierre, relaciones, anexos, PDF o versionado.

## R2B2 — Revisión/comentarios · CAPA
Estado: **IMPLEMENTADO EN RAMA `feature/review-comments-r2b2-capa`; PENDIENTE DE CI Y VALIDACIÓN MANUAL**.

- reutiliza la UI transversal de R2A/R2B1;
- añade Modo revisión y pestaña Revisión al detalle CAPA;
- targets estables para tipo, ámbito de aplicación, defecto, causa raíz, impacto, origen, acciones propuestas, seguimiento de la acción, estado operativo, eficacia y conclusión;
- `CapaPlannedAction` y `CapaActionFollowup` se revisan por UUID real mediante targets ITEM;
- los hilos CAPA muestran `Seguimiento 00/01/02...` en lugar de `V00/V01/V02`;
- «Ir al campo» conserva pestaña, modo, hilo y anchor estable;
- soporte tanto para seguimiento funcional vigente como para históricos sin versión funcional;
- smoke `pnpm review-r2b2:smoke` integrado en CI;
- sin cambios funcionales en estados, cierre, eficacia, relaciones, anexos, PDF ni versionado.

## R2B3 — Revisión/comentarios · Devoluciones
Estado: **IMPLEMENTADO EN RAMA `feature/review-comments-r2b3-returns`; PENDIENTE DE CI**.

- reutiliza la UI transversal de R2A/R2B1/R2B2;
- añade Modo revisión y pestaña Revisión al detalle de Devoluciones;
- targets estables para datos generales, decisión/destino, productos, comprobaciones, seguimientos y reclamación de origen;
- `ReturnProduct` y `ReturnFollowup` se revisan por UUID real mediante targets ITEM;
- las observaciones se almacenan sin asociación a la versión técnica del expediente (`recordVersionId = null`);
- la UI oculta completamente el concepto de versión funcional en Devoluciones;
- «Ir al campo» conserva pestaña, modo, hilo y anchor estable;
- smoke `pnpm review-r2b3:smoke` integrado en CI;
- sin cambios funcionales en estados, cierre, relaciones, anexos, PDF, productos ni seguimientos.

## CC1 — Control de Cambios · Modelo funcional, estados y formulario
Estado: **COMPLETADO Y FUSIONADO EN `main` mediante PR #94**.

- representación funcional derivada a partir de `ChangeFinalStatus`, `ChangeRequestDecision`, `ChangeDictamenResult`, ejecución y eficacia, sin crear una máquina de estados paralela;
- estado funcional visible en cabecera y listado, manteniendo además el estado final existente;
- clasificación Mayor/Menor y próximo seguimiento conservan sus fuentes actuales; la fecha se deriva del último `ChangeControlFollowup` y no se duplica;
- formulario compartido de alta/edición reordenado como Solicitud, Dictamen, 2.a Implicación y requisitos, Plan de ejecución, Resultado del dictamen y Control interno;
- obligatoriedad funcional aplicada al salir de Borrador, con Control interno opcional y guardado de borradores incompletos preservado;
- `requestDecisionResponsible` se reutiliza con la denominación funcional «Responsable de dictamen»;
- `approvalNames` deja de capturarse sin eliminar el campo ni sobrescribir datos históricos, anexos o snapshots;
- sin cambios de schema Prisma, migraciones, seguimientos, documentos, Anexo V ni capa de revisión R2C.

## CC2 — Control de Cambios · Expediente, pestañas y UX
Estado: **IMPLEMENTADO EN RAMA `feature/change-control-cc2-expedient-tabs-ux`; PENDIENTE DE CI Y VALIDACIÓN MANUAL**.

- nueva pestaña inicial Información con descripción, departamento, clasificación, estado funcional y fechas de solicitud/implementación;
- Solicitud reorganizada visualmente en datos del solicitante, descripción, justificación, documentos y decisión de aceptación/denegación;
- Dictamen reorganizado en resultado/fecha, evaluación, implicación y requisitos, Plan de ejecución, seguimiento previsto, observaciones y Control interno separado;
- requisitos presentados como pregunta, evaluación y respuesta/justificación, con fallback discreto para históricos incompletos;
- Documentos agrupado en anexos generables, documentos por seguimiento y generaciones registradas, conservando las acciones existentes;
- pestañas Seguimiento, Relaciones e Historial preservadas funcionalmente;
- sin cambios Prisma, estados, validaciones, formularios, seguimientos, Anexo V, backend documental ni revisión R2C.

## R2C — Review Control de Cambios, listados y regresión transversal
Estado: **IMPLEMENTADO EN RAMA `feature/review-comments-r2c-change-control-regression`; PENDIENTE DE REVISIÓN MANUAL DE PR**.

Base: `main` con CC3 fusionado en `7a9b780`. El trabajo anterior sin confirmar se conserva en su worktree original.

- Control de Cambios reutiliza Modo revisión, marcadores, drawer, conversaciones, resumen y pestaña Revisión; 31 objetivos estáticos, filas lógicas 2.a y elementos dinámicos por UUID.
- Los seguimientos incluyen apertura 00 y acciones/evidencias en su snapshot observado. Los hilos históricos conservan `QmsRecordVersion` y valor; Devoluciones sigue sin versión funcional de Review.
- Navegación transversal con pestaña correcta, scroll/foco, resaltado de tres segundos e «Ir al campo» desde listado y drawer. Los enlaces a hilo sin anchor abren el drawer.
- Columna Revisión independiente de Control en los cinco módulos; PENDING y ACCEPTED diferenciados, RESOLVED neutro. Cinco filtros compartidos y una agregación de conteos por listado.
- Backend endurecido frente a objetivos manipulados, entidades/hilos ajenos, versiones ajenas/no vigentes y mensajes sobre hilos cerrados, también ante resolución concurrente.
- Sin cambios Prisma/migraciones ni en los servicios funcionales CC1/CC2/CC3. Ajuste de fixture CAPA para mantener su contrato de exportación tipado.
- `pnpm quality`: Prisma validate/generate, lint, 228 tests en 60 archivos y build correctos. Permanecen dos advertencias preexistentes de hooks en formularios CAPA/Control de Cambios.
- Todos los smokes de CI pasan en PostgreSQL 16 aislado, incluido `review-r2c:smoke`: cinco consultas reales de listado, ciclos de revisión, filtros, nueve tipos dinámicos, seguridad y Control de Cambios 00→01.
- El smoke nuevo se incorpora a CI. `server-only` se declara explícitamente para probar las consultas de servidor con la condición `react-server` fuera de Next.
- Corregida una regresión visual encontrada en navegador: las Server Actions invalidan detalle/listado en su respuesta, sin un segundo `router.refresh()` dentro de la transición que podía dejar el drawer pendiente con datos antiguos.
- Las acciones devuelven los hilos persistidos usando la query transversal existente; el provider los incorpora directamente y los formularios controlan su estado pendiente, evitando depender del refresco RSC para continuar una conversación.
- Chromium: Desviaciones, CAPA, Reclamaciones, Devoluciones y Control de Cambios pasan creación/respuesta/aceptación/resolución/nueva observación, enlace directo a hilo, «Ir al campo» desde drawer, highlight temporal y navegación desde listado, en 1440/768/390 px, sin errores de página JavaScript.
- Comprobados además Solicitud/Dictamen/2.a/tareas/Seguimiento 00 de CC y creación de un seguimiento posterior mediante su formulario real: el nuevo comentario usa la versión vigente y los históricos conservan su asociación. El caso exacto 00→01 también pasa en el smoke aislado.
- Ajustados filtros móviles y ancho mínimo del timeline para que las tablas tengan scroll local sin desbordar el documento. Los enlaces de indicador/campo cargan su destino completo; el enlace a hilo sin pestaña respeta la pestaña inicial real de cada módulo.
- Limitación local ajena a las acciones Review: el formulario funcional de nuevo seguimiento de CC persistió correctamente, pero su redirección a la misma URL dejó una vista vacía en una ejecución; la recarga mostró el seguimiento. Ese formulario/servicio no se modifica en R2C: comprobar su redirección en Codespace.

Validación manual focalizada de la PR: comprobar visualmente 2.a/Plan/Seguimientos, comparar Control y Revisión, probar recarga/enlaces históricos 00/01 y verificar anexos/PDF oficiales en el entorno con sus plantillas controladas. Los smokes locales no sustituyen la aprobación manual ni constituyen validación GMP.

### Correcciones tras la primera regresión manual — misma PR #97

- Procedencia de Desviaciones: el listado y el filtro mostraban directamente el valor almacenado. `deviationProvenanceOptions`/`deviationProvenanceLabel` centralizan las seis etiquetas españolas en el dominio y se reutilizan en formulario/listado/filtro; los valores persistidos y del filtro siguen siendo los internos, y el texto histórico libre se conserva.
- CAPA: reproducido el error de hidratación con un comentario ya persistido y navegador `Europe/Madrid` frente a servidor UTC. La traza mostraba `09:21` en servidor frente a `11:21` en cliente. No era corrupción del target, versión o snapshot. El formateo común de mensajes/aceptación/resolución usa ahora UTC explícito y visible, con fallback seguro para fechas no válidas.
- Control de Cambios: reproducido 00→crear 01→comentario en 01→«Ir al campo» y recarga. El UUID, anchor y deep link eran correctos; el drawer hidrataba la conversación con la misma discrepancia horaria. La corrección compartida elimina el error sin cambiar identidad, navegación ni versionado.
- No se modifican seed, schema, migraciones ni servicios funcionales. No se borran, reasocian o migran comentarios históricos para corregir estos errores.
- Se añaden siete casos de labels y tres de fechas (238 tests unitarios en total), y `pnpm review-r2c:ui:smoke` con fixtures propios: CAPA con comentario histórico/target ausente, CC 00→01→02, enlaces desde drawer/listado, recarga, scroll/foco/highlight y conservación de versiones/snapshots. Este smoke de Chromium se integra en CI después de quality.
- Ejecución local UI: `APP_ENV=test R2C_UI_BASE_URL=http://127.0.0.1:3002 R2C_UI_CHROMIUM_PATH=/usr/bin/chromium pnpm review-r2c:ui:smoke`, con servidor y DATABASE_URL apuntando a la misma base aislada. Sin navegador local, instalar primero `pnpm exec playwright install chromium`.
- Verificación: 25 tests afectados correctos; suite completa 238 tests/60 archivos, Prisma, lint y build correctos; smoke PostgreSQL R2C y nuevo smoke Chromium completos, sin errores JavaScript/hidratación en cliente Madrid. Permanecen únicamente los dos warnings de hooks preexistentes. La PR #97 queda abierta para segunda comprobación manual.


## R3A — Auditorías: expediente base y planificación

Baseline: main 0fa23067c1ab44e4e5bd719681d041fb77fde74f. Rama feature/audits-r3a-base-record. Audit, departamentos y participantes persistentes, cinco escenarios, Borrador/apertura, AI/AE, modalidad, listado con búsqueda SQL/paginación/filtros/ColumnSelector, detalle/edición, historial, estado administrativo y navegación QMS. Cierre final bloqueado. Demo ficticio idempotente.

No implementado en R3A: hallazgos/clasificación/recomendaciones, CAPA Plan, relaciones nuevas, seguimientos de hallazgos, informes/anexos/adjuntos/firmados, versiones formales, Review de ficha, cierre definitivo GMP, Plan Maestro ni alertas automáticas.

Se incluyen baseline previa y migración R3A porque main no disponía de migrations. Ver docs/AUDITS_R3A.md antes de desplegar sobre una BD existente. Validación y PR: ver resultados de CI y notas finales del bloque; aprobación funcional manual pendiente. No constituye validación GMP.

Verificación local R3A: las dos migraciones aplican desde otra BD vacía, seed y smoke PostgreSQL completos. Concurrencia AI/AE, IDs persistentes, retiradas/reactivación, filtros/búsqueda/paginación y administración verificados. `pnpm quality` verde: 254 tests en 61 archivos, Prisma validate/generate, lint y build. Solo dos warnings de hooks preexistentes. Smokes UI de R3A y R2C verdes sobre build de producción, servidor UTC y navegador Europe/Madrid; R3A cubre 1440/768/390px. El smoke detectó y cubre la corrección de reset de controles tras errores y el desplegable de columnas móvil. CI y revisión manual de la PR quedan como comprobación remota/funcional del bloque.

## R3B — Auditorías: hallazgos, CAPA Plan y seguimiento

Rama feature/audits-r3b-findings-relations-followup desde main 27c82704831c3425d48c0bb229d77e4ede42623d; R3A validado manualmente y fusionado por el usuario. Cuatro entidades hijas persistentes y enums, migración real, OBS/Rk concurrentes/estables, acciones múltiples, evidencia textual, seguimiento general/hallazgo, QmsRelation AUDIT → DEVIATION/CAPA y atribución compartida. Navegación inversa y estado vivo; orígenes/snapshots CAPA extendidos de forma conservadora. Pestañas, listado/filtros/búsqueda SQL y demo idempotente. No se implementan documentos, versiones formales, Review, adjuntos, cierre definitivo, Plan Maestro ni alertas.

Validación local completa: migración desde otra BD vacía y upgrade R3A → R3B preservando UUID/código/datos; 283 tests en 62 archivos; pnpm quality y build verdes, con los dos warnings de hooks preexistentes. Regresión PostgreSQL acumulada de los cinco módulos, R3A/R2C y smoke R3B con concurrencia, pertenencia, atribuciones compartidas, snapshots congelados e historial/filtros SQL. Chromium sobre build de producción: R3B 1440/768/390, formularios/errores/relaciones/retirada/historial; R3A y R2C verdes, servidor UTC y navegador Madrid. Los smokes esperan la carga del cliente antes de interactuar. CI remoto: consultar la PR y el informe final. Revisión funcional manual pendiente. No constituye validación GMP.

Corrección técnica posterior en PR #99: bloqueo de navegación RSC tras guardar Auditoría, reproducido con transacción/HTTP finalizados en next start y standalone. El formulario base recibe el resultado de su Server Action antes de navegar al detalle dinámico. Se conservan reglas e historial; se retiran timeouts ampliados/checkpoint y se restaura el clic Editar del smoke. Evidencia y operación en docs/AUDITS_R3A.md. Validación local con Node 22.23.3: BD nueva/migraciones, toda la regresión PostgreSQL, pnpm quality/build (283 tests/62 archivos), R2C UI, tres pasadas consecutivas R3A UI y R3B UI verdes. CI remoto final en la PR/informe del diagnóstico.

## R3C — Auditorías: documentos, versiones, Review y cierre

Rama feature/audits-r3c-documents-versioning-review-close desde main cfd05b65eb682f65bfe55ede98dc87cb79837ceb. Implementación y decisiones en AUDITS_R3C.md/D-066. Fuentes oficiales SharePoint recibidas/revisadas con hashes: A3 interno/externo, A4.03 CAPA Plan y Anexo IV real del PNT externo. Snapshots de emisión 00/01+ congelados, archivos históricos, PDF por versión, adjuntos, Review UUID y cierre QA por escenario en backend.

Migración aditiva, estados/codificaciones R3A/B conservados, navegación de Server Action estable mantenida. Integridad/listado/filtros y workspace documental, sin Plan Maestro ni alertas. Binarios corporativos fuera de Git: instalar con templates:audits:install. Validación local Node 22: pnpm quality verde (311 pruebas/64 archivos), 35 smokes PostgreSQL verdes, migración vacía y actualización R3B→R3C conservando datos, documentos reales con OOXML válido y render LibreOffice, R3C UI con fuentes oficiales en 1440/768/390 Madrid. Review R2C UI, tres R3A UI consecutivos y R3B UI verdes; CI definitivo en PR/informe final. Revisión manual documental Calidad pendiente, no validación GMP.


## R3D — Auditorías: regresión final y cierre

Estado: **COMPLETADO**. Rama feature/audits-r3d-final-regression desde main cc097c1312bbed5890ac2180635919479a328e8a. Informe en AUDITS_R3D.md.

Cinco escenarios integrados, incluida interna contratada INTERNAL/AI/informe interno. Versiones 00/01, histórico/documentos/PDF inmutables, CAPA Plan real de 14 filas/28 acciones, cierre parcial/definitivo, estado CAPA concurrente y doble cierre comprobados. Se corrigen adjuntos Office falsos/MIME, solapamiento y compresión de textos largos en CAPA Plan y mensaje de cierre obsoleto. Se corrige además React #418 del banner de anulación: fecha UTC/Madrid divergente tras medianoche, reproducida con diff exacto y ahora UTC explícito. Once pruebas de defectos; sin nueva funcionalidad, schema, migraciones ni reglas GMP/cierre/código.

Regresión local: 35 smokes PostgreSQL, quality con 322 tests/66 archivos, Prisma/build, cuatro migraciones desde otra base vacía y actualización desde main preservando UUID/códigos. R2C UI, R3A UI ×3, R3B UI y R3C UI oficial verdes en producción Node 22 UTC/Madrid y 1440/768/390. Cinco hashes oficiales intactos; OOXML y render LibreOffice comprobados, sin afirmar fidelidad perfecta ni apertura verificada en Microsoft Office. Revisión visual Office por Calidad previa al uso controlado sigue pendiente no bloqueante del cierre funcional; Plan Maestro anual y alertas quedan fuera. No validación GMP.

CI de cierre verde: https://github.com/FMAcovex/covex-quality-manager/actions/runs/37739441386 sobre b42b6e362844a29ea021680ff0f249c632a6c616. Smokes PostgreSQL, quality/build y R2C/R3A ×3/R3B/R3C UI confirmados. Auditorías COMPLETADO en alcance R3D; PR #101 abierta, sin merge ni squash.


## Devoluciones R4B

Devoluciones R4B sobre main fb931b6: cierre funcional implementado y verificado localmente. Se preservan ReturnFollowup/V00 técnico; UUID de productos estables, criterios aplicables, stock distinto de aceptación, archivo documental y filtros SQL/paginación. Fuente real GC-00/028/03 y anexos separados contrastados. Véase RETURNS_R4B.md; revisión visual global pendiente: Revisión UX/UI transversal final.

## R4C — Regresión conjunta final Reclamaciones / Devoluciones

Baseline main d2ee3266386a5e4e699a0f7a67da95e9458e17a1; rama feature/complaints-returns-final-regression. Cobertura limitada a los catorce puntos conjuntos R4A/R4B en COMPLAINTS_RETURNS_R4C.md. Se corrige únicamente la carrera de foco del selector de relaciones al revincular. Sin nuevas funcionalidades, rediseño, Prisma ni migraciones. CI específica de esta rama: smokes R4A/R4B/transversal/R4C, navegador R4C/R4A/R4B y quality final; batería acumulada intacta para las demás ramas. Resultado final y head en la PR; COMPLETADO condicionado a CI verde. Revisión UX/UI transversal final sigue fuera del alcance.

Validación R4C local final verde: 90 tests afectados/12 archivos; cuatro smokes PostgreSQL y navegador conjunto R4C + R4A/R4B con fuentes oficiales; quality final 346 tests/67 archivos, Prisma/lint/build. Los catorce puntos funcionales conjuntos quedan verificados; Reclamaciones y Devoluciones pueden marcarse COMPLETADO al confirmar la CI del head de esta PR. Sin merge ni squash automático.

## P1A — Documentación controlada: registro maestro PNT (2026-10-08)

Registro independiente de maestro/revisiones/historial, reutilización de Department, captura de borrador incompleto y registro de revisiones existentes verificadas. Listado SQL y ficha Información/Revisiones/Documentos/Historial; edición de maestro y borrador, snapshots consolidados preservados. Referencias GC-00/001/03 y GC-00/013/01 contrastadas en su fuente vigente. Sin importación, aprobaciones, firma, gestión completa de archivos, QMS ni alertas. Detalle y preparación de P1B en `PNT_P1A.md`.

## P1B-1 — Previsualización del índice maestro PNT (2026-10-08)

Analizador XLSX y pantalla de previsualización/conciliación de solo lectura sobre P1A, sin importación definitiva ni staging persistente. GC-00 se descarta por instrucción expresa; GC-00( es la única fuente para GC-00 y conserva su procedencia. Libro real comprobado privadamente: 39 hojas válidas, 821 apariciones PNT, 817 códigos únicos y cuatro grupos repetidos; cero grupos con revisiones diferentes tras excluir GC-00. Contrato, límites, privacidad y pendientes P1B-2 en `PNT_P1B1.md`.

## P1B-2 — Conciliación e importación controlada PNT (2026-10-09)

Staging limitado por lote/capacidad y retención, decisiones manuales con procedencia y responsable, propuesta explícita, importación parcial SERIALIZABLE e idempotente, resultados e historial operativo. GC-00 permanece descartada; solo GC-00( aporta GC-00. Revisiones importadas IMPORTED_PENDING / UNVERIFIED, maestros DRAFT, declaración del índice separada y visible. No sobrescribe históricos ni simula verificación/aprobación. Migración aditiva de staging y estado pendiente, sin cambios QMS. Detalle, pruebas y límites en `PNT_P1B2.md`. P2 (evidencia, aprobación, PDF) pendiente; datos reales solo analizados privadamente en QA sin confirmación definitiva.

## P2B — Verificación, aprobación externa y vigencia PNT (2026-10-09)

Sobre main e051c3b22921a687c1a7f7fefb7b17385208b59a (P2A fusionada), rama feature/pnt-p2b-lifecycle. Verificación explícita por revisión, discrepancias pendientes, registros externos separados de aceptación humana, funciones preparador/revisor/aprobador contrastadas en GC-00/001/03 y GC-00/013/01. Planificación no activa por fecha; activación explícita retira anterior atómicamente. Decisiones/enlaces inmutables y rectificación enlazada; fechas operativas separadas y datos/conciliación Excel intactos. Permisos técnicos independientes de write, fronteras sensibles de lectura y compatibilidad histórica P1A sin aprobación retrospectiva. Migración aditiva, sin cambios QMS, firma electrónica ni nuevas integraciones. Documentación/risgos/pruebas en PNT_P2B.md; CI/head final en la única PR abierta para revisión, sin merge ni squash. P2C operativo/cualificación pendiente.

## P3C-4 — Biblioteca documental: explotación y presentación (2026-10-09)

Implementado en rama `feature/pnt-p3c4-list-ux`, PR #115, pendiente de CI y validación visual manual. Incluye filtro rápido de vigencia, revisión prevista en 30 días, revisión vencida, fechas incompletas y verificación documental pendiente; vista todas/última revisión; ordenación de las ocho columnas; contadores separados de PNT y revisiones; 25 filas por página; XLSX con la selección y ordenación completas, no solo la página. Al abrir la ficha se conserva el regreso al listado con los filtros actuales. Se mejora la presentación de Información, Revisiones, Documentos, Historial y paneles de estado, sin cambio de permisos, validaciones, aprobación externa, datos históricos ni schema. Las fechas de decisiones P2B siguen teniendo prioridad frente a las originales. La mejora constituye funcionalidad de consulta y no validación GMP. Antes de fusionar: comprobar en Codespaces el rendimiento sobre el índice completo y el aspecto 1440/768/390.

## PNT — Correcciones de la revisión final

Rama `feature/pnt-final-corrections`, actualizada desde main `417e3a3a` tras el reinicio del entorno. F-01/F-02/V-01/V-02 y dos mejoras autorizadas; módulo **pendiente de revisión y aprobación del usuario, sin cierre**.

- Editabilidad compartida entre servidor, ficha y URL: borrador devuelto editable si nunca fue aprobado/consolidado. El historial de aprobación también bloquea.
- Objetos, bytes, decisiones, evidencias y cambios previos conservados. Editar añade su cambio e incrementa la versión; un contraste anterior no acredita contenido modificado.
- `returnTo` local conserva búsqueda, filtros, vista, orden y página en pestañas, formularios y guardados de contenido/estado/documentos; filtros expresamente modificados reinician página.
- Badge documental común, separado del maestro; procedencia por metadatos reales, sin inferencia por existencia del ciclo.
- Excel con verificación en español y enums intactos; aclaración de última revisión (número mayor), sin cambiar selección.
- Regresiones unitarias, PostgreSQL y Chromium en CI documental; capturas como artefacto. Sin schema/migraciones ni cambios funcionales en otros módulos. Sin merge/squash automático. Resultados en la única PR.

## Programas anuales de Auditorías — PR limitada (2026-10-10)

Implementada en rama sobre main tras PR #122: campos documentales de entradas/aprobadores, previsualización, emisión DOCX interna/general y externa/Anexo I, histórico independiente con snapshot/bytes/checksum, motivo desde emisión 01, concurrencia e idempotencia. Las funcionalidades ya aprobadas de Auditorías y PNT conservan su alcance.

Fuentes oficiales contrastadas en SharePoint; instalador separado con hashes del original interno `.doc` y PMAE V05 `.docx`, sin binarios corporativos en Git ni cambios en SharePoint. Ver `AUDITS_ANNUAL_PROGRAMMES.md` para el mapeo y operación. CI incorpora smoke PostgreSQL y navegador con plantillas ficticias compatibles; QA local complementaria utiliza documentos reales.

Pendiente de aceptación del usuario: edición y acabado en Microsoft Word, y preparación/revisión/aprobación documental por las vías existentes. No fusionada ni desplegada.

## Corrección CI #583 — PR #123 (2026-10-10)

Ambos fallos R4B UI se han acotado al reintento perdido de Suspense en el React compilado dentro de Next 15.5.26: hidratación completa, datos correctos, RSC HTTP 200 y Server Action HTTP 303 con destino correcto, sin commit posterior del cliente. Se aplica un parche pnpm mínimo a esa rama en producción/desarrollo, equivalente a la existente en react-dom 19.3.0. Sin cambios funcionales en Auditorías/PNT ni saltos de navegación; pruebas R4B originales preservadas y redirección HTTP reforzada.

Regresión del renderer: roja sin el parche y verde con él. Verificación previa: 12/12 filtros, 98 pruebas/9 archivos, lint/build y smokes PostgreSQL 16 + navegador de R4B y Programa Anual interno/externo, incluidas vistas 1440/768/390. La CI completa se lanza sobre el commit de esta corrección; resultado final en la PR/conversación. Detalle, límites del entorno local y mantenimiento en CI_583_R4B_DIAGNOSIS.md. Sin merge ni squash.
