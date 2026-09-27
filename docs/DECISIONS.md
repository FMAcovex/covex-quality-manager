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
