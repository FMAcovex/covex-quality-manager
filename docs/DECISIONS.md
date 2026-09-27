# Decisiones cerradas

Este documento registra decisiones funcionales/arquitectónicas confirmadas. Codex no debe reabrirlas salvo instrucción expresa.

## D-001 — Proyecto independiente
COVEX Quality Manager es independiente de COVEX Training Manager. Puede reutilizar filosofía técnica, pero no comparte repositorio ni base de datos.

## D-002 — Stack
Stack objetivo:
- Next.js;
- TypeScript/React;
- PostgreSQL;
- Prisma.

Arquitectura monolítica modular.

## D-003 — Mínima dependencia de IT
El desarrollo y demo deben ser funcionales sin permisos corporativos especiales.

Fuera del MVP:
- Entra ID;
- SharePoint automático;
- Microsoft Graph;
- Power Automate.

## D-004 — Gestión documental MVP
La aplicación genera y descarga los anexos/listados. El usuario archiva manualmente los archivos corporativos.

La creación automática de carpetas o carga en SharePoint queda como mejora futura.

## D-005 — Fuente maestra
La base PostgreSQL será la fuente maestra operativa. Los Excel actuales se usarán para migración y contraste, no como base permanente.

## D-006 — Primer módulo
Desviaciones se implementa primero.

## D-007 — Diseño principal
Desviaciones utiliza aspecto de gestor de expedientes:
- filtros horizontales;
- buscador debajo;
- tabla operativa amplia;
- expediente a pantalla completa;
- pestaña de indicadores independiente dentro del módulo/app.

## D-008 — Listado
La tabla de Desviaciones toma como referencia el listado actual 2026 y muestra los campos funcionales hasta Observaciones. No muestra las columnas KPI internas como parte de la gestión diaria.

## D-009 — Observaciones
Observaciones internas es un campo propio y útil aunque no sea un campo específico del Anexo III.

## D-010 — Exportación Anexo V
La descarga anual genera el Anexo V oficial completo, incluyendo la hoja detallada y la vista simplificada/imprimible correspondientes a la plantilla versionada.

## D-011 — Listado simple
Debe poder descargarse un listado simple. Cuando se solicite desde una vista filtrada, debe poder respetar esos filtros. También existirá descarga completa por año.

## D-012 — Indicadores
Los indicadores se calculan a partir de los propios registros de la app. No se duplica la captura de datos en un Excel KPI.

## D-013 — Históricos
Se importarán todos los registros 2025 y 2026. Los campos ausentes no se inventan y se marcan como información histórica incompleta cuando corresponda.

## D-014 — Editabilidad
En V1, registros abiertos y cerrados son editables. Estado no equivale a bloqueo.

## D-015 — Historial
Registrar modificaciones de manera no silenciosa. En V1 es historial operativo, no audit trail GMP.

## D-016 — ID interno
Cada expediente usa UUID inmutable interno separado de la codificación visible.

## D-017 — Seguimientos
Los seguimientos son registros independientes 1:N, nunca columnas repetidas ni sobrescritura de seguimiento anterior.

## D-018 — Relaciones N:N
Las relaciones entre expedientes son multirrelación N:N.

Se implementarán mediante una entidad común `QmsRecord` y `QmsRelation`, con claves foráneas reales. Esto permite:
- una desviación -> varias CAPA;
- una CAPA -> varias desviaciones;
- reclamación -> varias desviaciones/CAPA/devoluciones;
- expediente -> varios tipos de expedientes relacionados.

Cada relación se almacena una sola vez en dirección canónica; la vista inversa se deriva en la interfaz. Las relaciones simétricas se normalizan para evitar duplicados invertidos.

## D-019 — CAPA
Las CAPA se vinculan formalmente a su/s expediente/s de origen. Una CAPA no es solo texto dentro de la desviación.

## D-020 — Versionado
Cada expediente conserva referencia a:
- versión de formulario;
- versión de plantilla documental.

Una nueva revisión de PNT/anexo no modifica documentos históricos.

## D-021 — Formularios
La interfaz para cumplimentar un expediente no replica visualmente el Word. Usa bloques orientados a trabajo y genera después el formato controlado.

## D-022 — Actualizaciones futuras
La app debe ser ampliable. Los campos GMP principales se mantienen tipados en BD; se permiten migraciones de esquema y versionado. Puede existir `extraData JSONB` como extensión, pero no sustituye campos regulados tipados.

## D-023 — Alertas
No implementar sistema de alarmas en el MVP, pero almacenar fechas estructuradas para poder añadirlo posteriormente.

## D-024 — GitHub
Repositorio privado: `FMAcovex/covex-quality-manager`.
Flujo:
- `main` estable;
- rama por hito;
- PR;
- comprobaciones;
- squash merge.

## D-025 — Codificación visible
`businessCode` nunca es PK. Su unicidad se controla por `recordType + businessCode`, permitiendo reglas de codificación independientes por módulo.

## D-026 — Departamento e histórico organizativo
Los expedientes referencian un catálogo `Department` mediante FK, pero conservan snapshot de código/nombre al crearse o importarse para que cambios organizativos futuros no reescriban el histórico.


## D-027 — Versionado funcional de expedientes
Se distinguen tres conceptos:
- versión de formulario/PNT;
- versión de plantilla documental;
- versión funcional del expediente.

La versión funcional se persiste en `QmsRecordVersion` como snapshot estructurado. `ChangeHistory` continúa registrando modificaciones de campos, pero no sustituye a una versión funcional.

Reglas:
- Desviaciones: V00 es la versión inicial. Una reapertura de una desviación Cerrada crea V01, V02… y congela la versión anterior, preservando su fecha de cierre histórica.
- Una edición ordinaria dentro de la misma etapa no crea una nueva versión funcional; actualiza el snapshot vigente y mantiene el detalle de cambios en `ChangeHistory`.
- CAPA: V00 es el informe inicial. Cada seguimiento crea V01, V02, V03… y congela la versión anterior.
- El cierre operativo y la eficacia de CAPA pueden pertenecer a versiones diferentes. Una CAPA puede estar Cerrada con eficacia Pendiente y alcanzar el cierre efectivo en un seguimiento posterior.
- Un documento generado puede quedar vinculado a la versión funcional exacta desde la que se generó.
- Si un expediente histórico anterior al Hito 6.1 no dispone de snapshots previos, no se reconstruyen versiones ficticias. Se crea un baseline histórico explícitamente identificado y el versionado exacto continúa desde ese punto.


## D-028 — Estructura de Control de Cambios
Cada Control de Cambio es un único expediente con navegación interna:
Solicitud | Dictamen | Seguimientos | Documentos | Relaciones | Historial.

Solicitud, Dictamen y Seguimientos son familias documentales distintas y no se modelan como expedientes independientes.

## D-029 — Baseline del Dictamen
Las tareas aprobadas en el Dictamen constituyen una línea base inmutable. Después de la aprobación no se sustituyen ni editan silenciosamente.

Las tareas nuevas se añaden desde Seguimiento, se etiquetan con su seguimiento de introducción y persisten posteriormente.

## D-030 — Seguimientos y cierre de Control de Cambios
Los seguimientos se numeran 00, 01, 02... sin límite funcional.

Se mantienen estados separados para:
- ejecución/cierre operativo;
- eficacia;
- cierre efectivo.

Se admite cierre sin ejecución únicamente con motivo documentado y eficacia No aplica.

## D-031 — Exportaciones de Control de Cambios
El listado operativo y el Anexo VII no son la misma vista.

El Anexo VII conserva exclusivamente las columnas del formato oficial. El listado simple puede incluir más columnas de gestión y respetar filtros activos.


## D-032 — Reclamaciones y Devoluciones como expedientes independientes
Reclamaciones y Devoluciones reutilizan el patrón visual y operativo de Desviaciones, pero mantienen entidades, PNT y anexos propios.

Una devolución puede derivar de una reclamación y viceversa, pero la vinculación se modela mediante QmsRelation y no mediante anidación o texto libre.

## D-033 — CAPA desde Reclamaciones
Reclamaciones dispone de propuestas CAPA 1:N. Una propuesta puede crear un expediente CAPA real, actualizando la propuesta y generando una relación GENERATES.

## D-034 — Productos de una Devolución
Una devolución admite varios productos. Los productos se almacenan como entidad 1:N y no como columnas repetidas.

El Anexo IV se genera individualmente por producto y el Anexo VI anual usa una fila por producto.

## D-035 — Plantilla fuente de Hito 8
Para Reclamaciones y Devoluciones se utiliza el PNT DOCX completo como fuente controlada. En tiempo de generación se extrae únicamente el anexo aplicable.

Esta decisión evita mantener copias derivadas manuales de cada anexo y reduce el riesgo de divergencia de formato.


## D-036 — Administración no destructiva
La administración funcional no elimina físicamente departamentos, catálogos, valores, versiones, plantillas ni reglas que puedan formar parte del histórico. Los elementos dejan de aplicarse mediante estado inactivo/retirado y, cuando corresponda, fecha de fin de vigencia.

Los códigos utilizados no se reutilizan con otro significado.

## D-037 — Versiones de formulario
Una versión activa no se modifica desde Administración. Para evolucionar un formulario:
1. se clona la versión vigente;
2. la copia nace como DRAFT;
3. pueden ajustarse metadatos de presentación/listado;
4. los cambios estructurales GMP tipados requieren actualización técnica, migración y pruebas;
5. al activar el borrador, la versión activa anterior queda RETIRED y finaliza su vigencia el día previo.

La activación nunca reescribe expedientes existentes.

## D-038 — Plantillas controladas en PostgreSQL
Las nuevas plantillas compatibles pueden cargarse desde Administración como DOCX/XLSX. La aplicación:
- almacena el binario en PostgreSQL;
- registra nombre, MIME, tamaño y SHA-256;
- permite mantenerla inactiva hasta revisión;
- recupera el archivo por módulo, tipo documental y versión al generar documentos.

Las plantillas históricas instaladas por filesystem continúan funcionando como fallback.

Si una nueva revisión modifica la estructura de tablas/campos del anexo, la carga del archivo no basta: el generador debe adaptarse y validarse antes de activar la plantilla.

## D-039 — Parámetros configurables
Los parámetros administrables se limitan a comportamiento no estructural. No se convierten en texto configurable:
- estados GMP;
- clasificaciones reguladas;
- reglas de cierre;
- lógica de eficacia;
- campos GMP tipados;
- relaciones estructurales.

## D-040 — Preparación de alertas
Hito 9 incorpora reglas configurables de vencimiento y una bandeja transversal de próximos/vencidos. No existe todavía envío automático de correos, Teams o notificaciones.

El envío requiere:
- canal corporativo;
- identidad/roles;
- permisos;
- definición de destinatarios;
- validación correspondiente.

Hasta entonces `ENABLE_ALERT_DELIVERY=false`.
