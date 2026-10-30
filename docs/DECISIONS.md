# Decisiones cerradas

## P2A — Custodia documental inmutable por revisión (2026-10-09)

ControlledRevisionDocument separa bytes/metadatos del snapshot de ControlledDocumentRevision. PostgreSQL BYTEA persistente y transacción conjunta con historial; sustitución mediante INSERT y antecesor/motivo, trigger contra UPDATE/DELETE. Word de trabajo no es aprobado; firmado/evidencia permanecen sin verificar. Adjuntar conserva estados y procedencia P1B-2. Acceso documental fail-closed con gateway autenticado configurado o demo explícito no operativo, nunca por actor escrito. Sin integración SharePoint, aprobación/publicación ni firma electrónica; configuración/riesgos/P2B en `PNT_P2A.md`.

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
- una reclamación -> varias CAPA;
- una reclamación -> varias devoluciones;
- una CAPA o devolución -> consultar sus expedientes de origen mediante la vista inversa.

En el bloque 10.8C3-B1 las únicas relaciones operativas autorizadas son
`DEVIATION GENERATES CAPA`, `COMPLAINT GENERATES CAPA` y
`COMPLAINT GENERATES RETURN`. Control de Cambios no participa todavía.

Cada relación se almacena una sola vez en dirección canónica; la vista inversa se deriva en la interfaz. La capa común de relaciones valida los tipos de ambos `QmsRecord` y evita que los módulos creen combinaciones adicionales.

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

Una devolución puede derivar de una reclamación. La vinculación se modela como una única `QmsRelation` Reclamación → Devolución; la devolución consulta la misma fila como relación de origen, sin almacenar otra relación inversa.

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


## D-041 — Datos de demostración
El dataset de demostración del Hito 10 es exclusivamente ficticio:
- todos los códigos visibles comienzan por `DEMO-`;
- los textos indican expresamente que no son expedientes GMP reales;
- la carga es idempotente;
- requiere `ALLOW_DEMO_DATA=true`;
- queda bloqueada siempre con `APP_ENV=production`.

Los datos demo no constituyen evidencia de validación ni deben mezclarse con datos corporativos reales.

## D-042 — Backup lógico del Hito 10
La exportación lógica del Hito 10:
- cubre todos los modelos Prisma;
- conserva fechas y binarios con codificación reversible;
- incorpora recuentos y checksum SHA-256;
- puede verificarse antes de conservar o trasladar el archivo.

Es una herramienta técnica de demo/contingencia. No sustituye la política corporativa futura de backup, restauración, retención, cifrado, acceso o disaster recovery, que se definirá en Hito 11 con IT.


## D-043 — Anulación administrativa de expedientes
Los expedientes de negocio no se borran físicamente desde la interfaz. Cuando un expediente se crea por error o debe retirarse de la operativa se utiliza una anulación lógica transversal.

Reglas:
- la anulación exige motivo y usuario;
- se conservan UUID, datos del módulo, versiones, documentos, relaciones e historial;
- el código visible original se conserva en `annulledBusinessCode`;
- `businessCode` se libera al anular para permitir reutilizar la codificación;
- solo puede existir un expediente activo por módulo y codificación;
- los listados muestran por defecto únicamente expedientes activos y ofrecen filtro Activos / Anulados / Todos;
- exportaciones e indicadores excluyen anulados por defecto;
- las relaciones ya existentes se conservan y muestran el código histórico con estado Anulado;
- no pueden crearse nuevas relaciones con expedientes anulados;
- la reactivación exige motivo y recupera el código original solo si no ha sido reutilizado por otro expediente activo.

## D-044 — Estado Borrador en Desviaciones
Las Desviaciones incorporan un estado operativo `DRAFT` previo a `OPEN`.

Reglas:
- un borrador puede guardarse con campos obligatorios pendientes;
- los campos pendientes se identifican visualmente en el formulario;
- la transición Borrador → Abierta exige superar todas las validaciones obligatorias;
- una desviación Abierta o Cerrada no puede volver a Borrador;
- los borradores no cuentan como desviaciones abiertas ni entran en indicadores, vencimientos, seguimientos u exportaciones oficiales por defecto;
- el Anexo III no se genera mientras el expediente esté en Borrador;
- el código de negocio puede permanecer vacío durante el borrador; la asignación automática definitiva se resolverá en D3 al abrir el expediente.

## D-045 — Codificación sugerida y controlada de Desviaciones
La codificación de una Desviación puede introducirse manualmente durante el alta/borrador o aceptarse desde una sugerencia correlativa calculada por la aplicación.

Reglas:
- formato `D/XX-NN/ZZZ/YYYY`, usando código de departamento, correlativo de tres cifras y año de apertura;
- al seleccionar departamento y año, la interfaz propone el siguiente correlativo disponible;
- la sugerencia no impide escribir manualmente otra codificación válida;
- un borrador sin código no consume numeración; si el usuario guarda el borrador con un código, esa codificación queda reservada por el expediente;
- al abrir un borrador sin código, la aplicación asigna el siguiente correlativo disponible;
- la confirmación del código se realiza dentro de la misma transacción que guarda/abre el expediente;
- un bloqueo transaccional PostgreSQL serializa la asignación por departamento y año para evitar duplicados concurrentes;
- la validación considera tanto `businessCode` como `annulledBusinessCode`, evitando reutilizar una codificación histórica anulada;
- una vez abierta la desviación, el código queda fijado y no se modifica en ediciones o versiones posteriores;
- la lógica se centraliza en `src/lib/qms/business-code.ts` para futura reutilización controlada.

## D-046 — Desvinculación Desviación ↔ CAPA
La desvinculación entre una Desviación y una CAPA actúa exclusivamente sobre la relación QMS canónica `Desviación → CAPA`.

Reglas:
- nunca elimina ni anula la Desviación ni la CAPA;
- no crea una relación inversa artificial;
- la misma fila `QmsRelation` se desactiva mediante `isActive = false`, conservando trazabilidad técnica y permitiendo reactivación idempotente;
- al desvincular, la relación deja de mostrarse tanto desde Desviaciones como desde CAPA porque ambas vistas consultan únicamente relaciones activas;
- las referencias históricas de propuestas CAPA ya registradas no se borran por esta operación;
- una nueva vinculación entre los mismos expedientes reactiva la relación existente en lugar de crear un duplicado.



## D-047 — Desvinculación transversal de relaciones operativas QMS
El patrón de D-046 se reutiliza para las tres relaciones operativas autorizadas:
- Desviación → CAPA;
- Reclamación → CAPA;
- Reclamación → Devolución.

Reglas:
- vincular desde cualquiera de los dos extremos siempre resuelve y persiste la única dirección canónica permitida;
- desvincular nunca elimina ni anula expedientes y solo marca `QmsRelation.isActive = false`;
- la operación se registra en el historial operativo del expediente desde el que se ejecuta;
- las consultas de detalle muestran únicamente relaciones activas;
- revincular los mismos expedientes reactiva la fila histórica existente mediante `upsert`, sin crear duplicados;
- la matriz de relaciones no se amplía: Control de Cambios continúa fuera de las relaciones operativas de V1.


## D-048 — Buscador dinámico al vincular expedientes
Los formularios de relaciones operativas incorporan búsqueda dinámica por codificación.

Reglas:
- solo se sugieren expedientes activos;
- solo se sugieren tipos compatibles con la matriz vigente de relaciones QMS;
- el expediente actual y los ya vinculados activamente quedan excluidos;
- al cambiar el tipo de expediente relacionado, las sugerencias se recalculan;
- seleccionar una sugerencia rellena la codificación; la creación de la relación continúa validándose en servidor;
- el buscador no amplía la matriz de relaciones ni sustituye las validaciones de D-018/D-047.


## D-049 — Codificación sugerida y controlada transversal
El patrón de D-045 se extiende a CAPA, Controles de Cambios, Reclamaciones y Devoluciones sin modificar los códigos históricos existentes.

Reglas:
- la interfaz propone el siguiente correlativo disponible según los datos identificativos del módulo;
- el usuario puede aceptar la sugerencia, introducir manualmente otro código válido o dejar el campo vacío para que el servidor asigne el siguiente correlativo al guardar;
- la asignación definitiva se realiza dentro de la transacción con bloqueo PostgreSQL por serie/año;
- se consideran tanto `businessCode` como `annulledBusinessCode`, por lo que una codificación histórica anulada no se reutiliza;
- después de crear el expediente, la codificación queda fijada y se muestra como solo lectura en edición;
- los expedientes históricos conservan su codificación aunque no responda al patrón actual;
- formatos aplicados en V1:
  - CAPA correctiva: `AC/<departamento>/ZZZ/YYYY`;
  - CAPA preventiva: `AP/<departamento>/ZZZ/YYYY`;
  - Control de Cambio: `C/<departamento>/ZZZ/YYYY`;
  - Reclamación de cliente: `R/C/ZZZ/YYYY`;
  - Reclamación a proveedor: `R/P/ZZZ/YYYY`;
  - Devolución: `DEV/<área-almacén>/ZZZ/YYYY`.


## D-050 — Estado Borrador transversal · CAPA
CAPA incorpora el estado `DRAFT` como estado administrativo previo al ciclo operativo.

Reglas:
- una CAPA nueva se inicia en Borrador;
- el Borrador puede guardarse con campos incompletos y sin codificación;
- al pasar a Abierta se aplican todas las validaciones obligatorias y se asigna/fija la codificación controlada;
- una CAPA Abierta, Cerrada o Cancelada no puede volver a Borrador;
- Borrador no admite seguimientos, relaciones operativas nuevas ni generación de Anexo III;
- Borrador queda excluido de KPI, vencimientos y exportaciones oficiales;
- si el borrador nace desde una propuesta de Desviación/Reclamación, el origen se conserva como pendiente y solo se formaliza al abrir la CAPA.


## D-051 — Estado Borrador transversal · Control de Cambios
Control de Cambios incorpora `DRAFT` dentro de `ChangeFinalStatus` como estado previo al ciclo operativo.

Reglas:
- un nuevo Control de Cambio se inicia en Borrador;
- el Borrador puede guardarse con campos incompletos y sin codificación;
- al pasar a Abierto se aplican los campos obligatorios de solicitud y se asigna/fija la codificación controlada;
- un Control de Cambio Abierto o Cerrado no puede volver a Borrador;
- las fases propias del módulo (solicitud, Dictamen, ejecución, eficacia y cierre) se mantienen sin redefinir;
- Borrador no admite seguimientos, relaciones operativas nuevas ni generación de Anexos III, IV o V;
- Borrador queda excluido de KPI y exportaciones operativas/oficiales.


## D-052 — Estado Borrador transversal · Reclamaciones
Reclamaciones incorpora `DRAFT` en `ComplaintStatus` como estado previo al ciclo operativo.

Reglas:
- una nueva Reclamación se inicia en Borrador;
- el Borrador puede guardarse con campos incompletos y sin codificación;
- al pasar a Abierta se exigen los campos de identificación operativa y se asigna/fija la codificación controlada;
- una Reclamación Abierta o Cerrada no puede volver a Borrador;
- Borrador no admite seguimientos, relaciones operativas nuevas, creación de CAPA/Devolución derivadas ni generación de Anexos III/IV;
- Borrador queda excluido de KPI y exportaciones oficiales;
- las reglas de cierre y eficacia se mantienen intactas al salir de Borrador.


## D-053 — Estado Borrador transversal · Devoluciones
Devoluciones incorpora `DRAFT` en `ReturnStatus` como estado previo al ciclo operativo.

Reglas:
- una nueva Devolución se inicia en Borrador;
- el Borrador puede guardarse con campos incompletos y sin codificación;
- al pasar a Abierta se exigen los campos operativos y se asigna/fija la codificación controlada;
- una Devolución Abierta o Cerrada no puede volver a Borrador;
- Borrador no admite seguimientos, relaciones operativas nuevas ni generación de Anexos III/IV/V;
- Borrador queda excluido de KPI y exportaciones oficiales;
- si el borrador nace desde una Reclamación, el origen se conserva como pendiente y la relación canónica Reclamación → Devolución solo se formaliza al abrir.


## D-054 — Filtros multiselección transversales en listados QMS
Los listados de Desviaciones, CAPA, Controles de Cambios, Reclamaciones y Devoluciones admiten selección múltiple en los filtros combinables.

Reglas:
- Estado administrativo permanece como filtro único por ser mutuamente excluyente (Activos / Anulados / Todos).
- Se permite multiselección en Año, Departamento/Área y categorías operativas propias de cada módulo (estado, tipo, clasificación, eficacia, origen, ejecución o decisión, según aplique).
- Los filtros especiales con lógica exclusiva (por ejemplo Con/Sin CAPA, medidas adoptadas, plazo o seguimiento) permanecen como selección única.
- Los valores seleccionados se serializan como parámetros repetidos y el backend aplica semántica OR dentro de cada filtro mediante `IN`, manteniendo AND entre filtros distintos.
- Las exportaciones simples con filtros actuales conservan todos los valores seleccionados.


## D-055 — Cierre D5 mediante regresión transversal acumulativa
D5 se cierra con una regresión transversal única que no añade reglas de negocio nuevas.

Cobertura:
- validación Borrador → operativo en Desviaciones, CAPA, Control de Cambios, Reclamaciones y Devoluciones;
- mantenimiento de codificación controlada;
- contratos de relaciones QMS ya aprobados;
- bloqueo documental en Borrador;
- filtros multiselección y parámetros repetidos;
- convivencia con los smoke existentes de código, relaciones, versionado, documentos y PostgreSQL.

La aceptación de D5 depende del smoke `d5-6:smoke` y del conjunto acumulado de CI, no de una nueva lógica paralela.


## D-056 — R1 CAPA: separar seguimiento funcional y seguimiento de la acción
La revisión R1 de CAPA adopta dos conceptos independientes:

- **Seguimientos 00/01/02… del expediente**: se representan exclusivamente mediante `QmsRecordVersion`. El registro inicial es Seguimiento 00; una edición ordinaria refresca la versión vigente y «Guardar como nuevo seguimiento» congela la vigente y crea la siguiente.
- **Seguimiento de la acción**: contenido funcional de CAPA persistido en `CapaActionFollowup` con fecha, descripción y orden, más observaciones generales en `Capa.actionFollowupObservations`.

Reglas:
- `CapaFollowup` se conserva intacto como histórico/legacy; R1 Bloque 1 no realiza backfill ni borrado.
- `Capa.nextFollowupDate` pasa a ser la fuente operativa del próximo seguimiento del expediente.
- Los orígenes nuevos de CAPA se seleccionan entre expedientes reales y se materializan mediante relaciones QMS canónicas Desviación → CAPA y Reclamación → CAPA.
- En borrador, los identificadores de origen se conservan como datos pendientes y no se crean relaciones operativas.
- `originType` y `originCode` se mantienen como compatibilidad histórica, no como fuente maestra del multiorigen.
- Los campos históricos retirados de la interfaz no se eliminan ni se vacían durante una edición.
- R1 no crea una captura independiente de “evidencia de ejecución”. El apartado Seguimiento de la acción se limita a Fecha, Descripción y Observaciones conforme al Anexo III. `CapaFollowup` permanece solo como histórico/legacy, sin backfill ni nueva captura desde la UX R1; los documentos/PDF vinculados a versiones se resolverán en el Bloque 2.
- El PDF por versión y la generalización documental se aplazan al Bloque 2.

## D-057 — PDF firmado por versión funcional y reutilización documental
Los PDF firmados manualmente de Desviaciones y CAPA se vinculan a la versión funcional exacta mediante `RecordVersionDocument` con `kind = SIGNED_PDF`.

Reglas:
- cada `QmsRecordVersion` puede tener su propio PDF firmado;
- un PDF de una versión no se copia automáticamente al crear una versión posterior;
- la sustitución de un PDF existente exige motivo y se registra en `ChangeHistory` como historial operativo;
- la validación servidor comprueba extensión PDF, límite de 15 MB, cabecera `%PDF-` y pertenencia de la versión al expediente;
- CAPA no admite carga de PDF firmado mientras esté en Borrador;
- no se introduce firma electrónica ni una tabla documental específica por módulo;
- el formulario y la lógica común de almacenamiento/descarga se reutilizan de forma conservadora entre Desviaciones y CAPA, manteniendo las rutas y comportamiento de Desviaciones.

## D-058 — Núcleo transversal de revisión y comentarios
Los hilos de revisión se vinculan a la identidad común `QmsRecord`, no a las entidades específicas de cada módulo. Pueden referenciar opcionalmente la `QmsRecordVersion` revisada y apuntar al expediente, una sección, un campo o un elemento dinámico mediante su tipo e identificador estable.

Reglas:
- el comentario inicial y todas las respuestas se conservan exclusivamente como `ReviewMessage`;
- los estados son `PENDING`, `ACCEPTED` y `RESOLVED`, con transiciones `PENDING → ACCEPTED → RESOLVED` o `PENDING → RESOLVED`;
- aceptar no resuelve y responder no cambia el estado;
- un hilo `RESOLVED` queda cerrado: conserva todo su histórico pero no admite nuevas respuestas; una nueva observación se registra en un hilo nuevo;
- no se implementa reapertura ni borrado de hilos o mensajes;
- `fieldLabelSnapshot` y `valueSnapshot` conservan lo visto al crear la observación y no se sincronizan después con el expediente;
- creación, aceptación y resolución se registran como eventos de alto nivel en `ChangeHistory`; las respuestas no se duplican allí;
- los comentarios no modifican datos del expediente, no introducen reglas por estado GMP y no bloquean su cierre;
- R1 no añade interfaz visual a las páginas de los módulos.

## D-059 — R2A: infraestructura visual transversal y piloto en Reclamaciones
La interfaz de revisión se compone de piezas comunes bajo `src/components/review` y de catálogos estables bajo `src/lib/qms/review/targets`. Reclamaciones es el único módulo integrado en R2A; el resto de módulos conserva su interfaz actual.

Reglas:
- la identidad de un objetivo se forma con claves estructurales (`module`, `targetKind`, `tabKey`, `sectionKey`, `fieldPath`) y, para elementos dinámicos, el tipo y el identificador real; el label visible nunca es identidad;
- `anchorId` es estable, no depende de posiciones ni textos traducibles;
- `?review=1` activa los marcadores y se conserva al navegar entre pestañas;
- el acceso «Ir al campo» combina pestaña, modo de revisión, hilo y anchor estable;
- la observación se asocia en servidor a la versión funcional de mayor secuencia que esté vigente al crearla; una versión posterior no cambia esa asociación ni el snapshot;
- los resueltos siguen visibles, pero solo `PENDING + ACCEPTED` forman el contador activo;
- la revisión no escribe campos funcionales, no altera estados ni bloquea los flujos del expediente.

## D-060 — R2B1: extensión de revisión a Desviaciones
Desviaciones reutiliza sin duplicación la infraestructura visual transversal validada en R2A.

Reglas:
- el Modo revisión, la pestaña Revisión, el drawer, los contadores y «Ir al campo» utilizan los componentes comunes de `src/components/review`;
- los targets estáticos de Desviaciones se declaran en un catálogo estable propio del módulo y conservan `tabKey`, `sectionKey`, `fieldPath` y `anchorId` independientes del texto visible;
- las acciones inmediatas se identifican mediante `DeviationImmediateAction` + UUID real;
- las propuestas CAPA se identifican mediante `DeviationCapaPlan` + UUID real;
- una observación nueva se asocia a la versión funcional vigente cuando existe; los históricos sin snapshot funcional siguen siendo revisables con `recordVersionId = null`;
- los snapshots de valor y versión permanecen inmutables aunque el expediente cree una versión posterior;
- la capa de revisión no modifica formularios, reglas GMP, estados, cierres, relaciones, anexos, PDF ni versionado funcional de Desviaciones.

## D-061 — R2B2: extensión de revisión a CAPA
CAPA reutiliza la infraestructura transversal de revisión ya validada en Reclamaciones y Desviaciones, preservando su vocabulario funcional propio.

Reglas:
- Modo revisión, pestaña Revisión, drawer, contadores y «Ir al campo» reutilizan los componentes comunes;
- los objetivos estáticos cubren identificación, origen, defecto, causa raíz, impacto, acciones propuestas, seguimiento de la acción, estado operativo, eficacia y conclusión;
- las acciones propuestas se identifican mediante `CapaPlannedAction` + UUID real;
- los seguimientos de acción se identifican mediante `CapaActionFollowup` + UUID real;
- la versión funcional mostrada en revisión se denomina `Seguimiento 00/01/02...`, no `V00/V01/V02`, sin cambiar la persistencia en `QmsRecordVersion`;
- una observación nueva se vincula al seguimiento funcional vigente cuando existe; históricos sin snapshot siguen siendo revisables con `recordVersionId = null`;
- el snapshot y la asociación al seguimiento permanecen inmutables aunque se cree un seguimiento posterior;
- la capa de revisión no modifica reglas GMP, formularios, estados, cierres, eficacia, relaciones, anexos, PDF ni la lógica de versionado CAPA.

## D-062 — R2B3: extensión de revisión a Devoluciones
Devoluciones reutiliza la infraestructura transversal de revisión sin introducir versiones funcionales de usuario.

Reglas:
- Modo revisión, pestaña Revisión, drawer, contadores y «Ir al campo» reutilizan los componentes comunes;
- los objetivos estáticos cubren datos generales, motivo/incidencias, documentación, decisión, destino final, trazabilidad, productos, comprobaciones, seguimientos y relación con la reclamación de origen;
- los productos se identifican mediante `ReturnProduct` + UUID real;
- los seguimientos se identifican mediante `ReturnFollowup` + UUID real;
- las observaciones de Devoluciones se crean siempre con `recordVersionId = null`, aunque exista un `QmsRecordVersion` técnico para documentos/snapshots;
- la UI de revisión de Devoluciones no muestra `V00/V01`, `Seguimiento 00/01` ni «Sin versión» porque el módulo mantiene un único expediente editable sin revisiones funcionales;
- la capa de revisión no modifica estados, cierre, relaciones, productos, seguimientos, anexos, PDF ni reglas ya validadas de Devoluciones.

## D-063 — R2C: cierre transversal de revisión y visibilidad en listados
Control de Cambios reutiliza los modelos y componentes transversales existentes. No se añaden modelos ni migraciones.

Reglas:
- catálogo de 31 objetivos estáticos: Información, Solicitud, Dictamen y ocho filas lógicas de implicación/requisitos; tareas y seguimientos se identifican por tipo de entidad y UUID persistente;
- creación, respuestas, aceptación y resolución validan en servidor el catálogo del módulo, la pertenencia de la entidad/hilo al expediente y la versión vigente; Devoluciones conserva `recordVersionId = null`;
- los comentarios históricos conservan versión y valor observado, sin moverse ni clonarse al crear un seguimiento nuevo;
- `Seguimiento 00 · Apertura` identifica la apertura en el contexto de revisión CAPA, Reclamaciones y Control de Cambios, sin alterar su versionado funcional;
- una respuesta y la resolución del mismo hilo se serializan: un hilo cerrado no admite mensajes posteriores ni reapertura; una observación nueva genera otro hilo;
- «Ir al campo» desde listado/drawer utiliza pestaña, `review=1`, hilo y anchor, cierra el drawer y aplica un resaltado temporal; un enlace con hilo sin anchor abre directamente el drawer;
- los cinco listados separan Control (`dataQualityStatus`) de Revisión (`ReviewThread`), con conteos pendientes/aceptados y ausencia de alerta para resueltos;
- filtros compartidos Todas/Pendientes/Aceptadas/Activas/Sin activas mediante relaciones SQL; una sola agregación `groupBy` para las filas visibles, nunca una consulta por fila;
- Review no se incorpora a anexos ni cambia reglas de estados, cierre, documentos, relaciones o seguimiento de CC1/CC2/CC3.
- corrección de regresión manual: las fechas de mensajes/aceptación/resolución de Review se formatean en `es-ES` con UTC explícito y visible, para que servidor y navegador hidraten el mismo texto sin depender de su zona local; no se alteran timestamps persistidos ni asociaciones históricas.


## D-064 — Auditorías R3A y límites aprobados

Un único módulo Audit/QmsRecord AUDIT. INTERNAL/EXTERNAL con cinco escenarios; interna contratada sigue siendo INTERNAL. Hallazgos serán hijos persistentes en R3B; no se duplica CAPA. Relaciones a Desviación/CAPA llegarán en R3B sin modificar la matriz actual. Versiones por emisión/revisión del informe, no por seguimiento, y Review/documentos en R3C. Plan Maestro posterior. Cierre definitivo se completará con hallazgos/seguimiento/CAPA; R3A bloquea CLOSED en UI y backend.

AI/departamento/YY/AAAA: correlativo 01–99 por área y año. Área de codificación explícita entre áreas auditadas; autoselección cuando solo hay una. AE/códigoEntidad/YY/AAAA para proveedor: código manual normalizado a mayúsculas, nunca derivado del nombre; correlativo por entidad/año. Año inicial: fecha prevista, después apertura, después realizada. Código y año quedan fijos al abrir aunque se reprograme. Serie/dimensión y escenario operativos inmutables para evitar incoherencia con el código. Borrador permite corregirlos.

Cliente/autoridad: businessCode null, UUID QMS y externalReference opcional; no se inventa serie. API administrativa permite reactivar AUDIT sin código para esos escenarios y borradores, conservando controles previos de los demás módulos. La UI de Auditorías indica reserva de código anulado.

Participantes textuales UUID sin maestro global; al abrir al menos un auditor y exactamente un jefe si son varios. Áreas/participantes retirados se inactivan; pertenencia de UUID se valida en servidor. Demo sigue DEMO- como los otros módulos y permanece DRAFT; su apertura sustituye el código demo por una codificación normativa.

## D-065 — Auditorías R3B: hallazgos, plan y seguimiento

Se implementa la arquitectura y reglas de docs/AUDITS_R3B.md sobre R3A. Hijos UUID persistentes, OBS/Rk asignadas al guardar con bloqueo por auditoría y reserva histórica. Recomendaciones y criticidad independientes sin plazos automáticos. Acciones locales múltiples con AuditActionStatus, tratamiento sin acciones justificable y estado del hallazgo derivado. Cierre parcial derivado del plan registrado con acciones pendientes; no equivale a eficacia ni cierre definitivo.

La matriz añade únicamente AUDIT GENERATES DEVIATION/CAPA; vínculos a expedientes existentes. Una relación global y atribuciones N:N por hallazgo. Retirada individual conserva el vínculo global; desvinculación global exige cero atribuciones activas y solicitud explícita. Orígenes CAPA admiten AUDIT con snapshots vigentes y anteriores preservados. Seguimientos generales/de hallazgo con DATE y pertenencia validada. Próxima revisión se toma del último seguimiento cronológico. Sin documentos, versiones de informe, Review ni CLOSED definitivo.

## D-066 — Auditorías R3C: emisión, documentos y cierre

Se implementa docs/AUDITS_R3C.md sobre R3A/R3B. Las cinco fuentes oficiales autorizadas de SharePoint se han descargado y revisado, con hashes registrados; quedan excluidos BORRADOR y OBSOLETOS. A4.03 es CAPA Plan oficial. El Plan externo se extrae del Anexo IV del PNT real, sin inventar fichero independiente.

Versionar únicamente emisión/revisión formal del informe: 00 inicial, 01+ con motivo/autor/fecha y snapshot congelado desde creación, incluida plantilla. Ediciones/seguimiento/plan actual no generan revisión. Cliente/autoridad conserva acta externa primaria y su revisión. PDF externo firmado por versión, sin sobrescribir; ausencia es aviso documental y no bloqueo absoluto de cierre. Review R2C reutilizado con UUID y asociación histórica exacta.

Cierre interno por QA con informe, tratamiento/evidencia/verificación y CAPA atribuida necesaria cerrada/eficaz; no bloqueo general por todas las Desviaciones. Proveedor: parcial al envío, normal con verificación o excepción explícita sin respuesta/no críticos, justificación/actor/fecha y siguiente auditoría. Cliente/autoridad: documento primario, acciones/evidencia y respuesta cuando requerida, sin eficacia local universal inventada. DRAFT/OPEN/CLOSED permanecen; no reapertura automática. Detalle de política y despliegue en AUDITS_R3C.md.

## D-067 — Reclamaciones R4A: seguimiento funcional único y documentos v03

Por petición expresa del usuario, los nuevos seguimientos funcionales se registran exclusivamente como QmsRecordVersion V00/V01+, con fecha/motivo y snapshot. ComplaintFollowup y sus datos se conservan como legacy, sin borrado/backfill masivo. Guardar actualiza la versión vigente; nueva versión es una acción explícita. Las relaciones canónicas y los targets Review mantienen UUID e históricos.

Para Reclamaciones v03 se usan los anexos separados reales autorizados en SharePoint, cuyos hashes figuran en COMPLAINTS_R4A.md; D-035 conserva aplicación para históricos v02 y Devoluciones. Anexo IV es opcional para respuesta formal al cliente. Sin cambios de matriz, migración ni firma electrónica. La revisión UX/UI global queda aplazada hasta completar todos los módulos.

## D-068 — Devoluciones R4B: seguimiento operativo y archivo documental

GC-00/028/03 §5.2, vigente 26/05/2026, exige actualizar el formulario durante la investigación y no define revisiones funcionales. Se mantiene ReturnFollowup y V00 técnico único editable; sin V01/V02, migración ni backfill inventado. Review conserva UUID y recordVersionId null. III/IV/V generados y PDF recibidos se archivan por bytes/checksum/snapshot documental independiente del V00 mutable; sustitución PDF conserva el anterior. Detalle, clasificación previa y hashes reales en RETURNS_R4B.md.

D-035 sigue aplicando a históricos instalados. Las copias separadas vigentes de III/IV/V/VI revisadas en SharePoint son fuentes autorizadas para R4B; ningún activo 03 poblado se sobrescribe silenciosamente con otro checksum. Aceptar gestión no libera stock; se comprueba aplicabilidad y coherencia de destino contra el PNT. Sin rediseño general ni permisos técnicos derivados de responsabilidades documentales.

## P1A — Identidad y revisión de documentación controlada (2026-10-08)

El PNT utiliza `ControlledDocument`, `ControlledDocumentRevision` y su historial específico, reutilizando Department con snapshots congelados. No se reutiliza QmsRecordVersion ni QmsRelation. Maestro administrativo y estado documental son distintos. El registro de una revisión documental existente exige fuente y verificación; no equivale a aprobación/publicación. Una vigente y una revisión en elaboración simultáneas; sin invención de revisiones ni fechas. Las consolidadas no se editan. P2 añadirá evidencia de aprobación vinculada a la revisión y separada del método de firma; no se implementa en P1A. Véase `PNT_P1A.md`.

## P1B-1 — Declaración del índice separada de verificación (2026-10-08)

La previsualización XLSX no verifica documentos controlados ni modifica P1A. La declaración del índice, sus valores originales y procedencia se conservan en un contrato de análisis; `sourceMetadata` permite su futura incorporación sin equipararla al estado documental verificado. No se añade esquema ni flujo de aprobación en P1B-1. La fuente GC-00 queda excluida completamente; solo GC-00( aporta procedimientos del departamento GC-00. Confirmación idempotente y decisiones de conciliación corresponden a P1B-2 (`PNT_P1B1.md`).

## P1B-2 — Importación declarada pendiente y staging limitado (2026-10-09)

Los PNT del índice no adquieren estado documental IN_FORCE ni evidencia de verificación. Se añade IMPORTED_PENDING separado de DRAFT, con ausencia de consolidación/verificador, y los nuevos maestros quedan DRAFT / UNVERIFIED. Estado declarado y procedencia se conservan en metadatos; desconocidos/contradicciones requieren decisiones manuales. Staging 30 días, 100 lotes pendientes y 16 MiB de JSON por lote, sin binario XLSX; resultados confirmados y decisiones conservan el historial mínimo. Reimportación omite identidades existentes, sin sobrescribir datos verificados o snapshots. Confirmación por propuesta exacta, versión/huella y transacción SERIALIZABLE. P2 acreditará documentalmente la revisión mediante un flujo posterior, sin aprobación ni firma ficticia ahora. Véase `PNT_P1B2.md`.

## P2B — Decisiones externas, fechas operativas e históricos (2026-10-09)

GC-00/001/03 y GC-00/013/01 justifican funciones preparación/revisión/aprobación, no tres aprobadores obligatorios; preparación y aprobación distintas y autoridad Calidad/Técnica según ámbito contrastado humanamente. P2B registra evidencia externa y su aceptación humana separadas; no autentica firmas. Ciclo explícito sin atajos ni activación por reloj; una vigente/una en elaboración y obsolescencia anterior transaccional. Proyección por UUID de revisión conserva fechas operativas separadas de las originales Excel/P1A; decisiones/enlaces inmutables y rectificaciones vinculadas. Históricos P1A no reciben aprobación retrospectiva; nuevas entradas históricas de servidor requieren permiso legacy-register y actor autenticado. Read documental y capacidades verify/record-approval/accept-approval/activate/retire/correct son independientes de write; explotación falla cerrada sin gateway autorizado. Sin roles corporativos atribuidos automáticamente, firma electrónica, comunicaciones ni integración. Condiciones, fuentes, ambigüedades y límites P2C en PNT_P2B.md.

## PNT — Editabilidad tras devolución a preparación (corrección autorizada)

La existencia de `ControlledRevisionLifecycle` no consolida ni importa una revisión. El borrador devuelto puede editarse si no está consolidado y su historial no contiene aprobación aceptada, estado aprobado/vigente/obsoleto/anulado u origen histórico consolidado. Servidor y UI comparten la condición. Todos los registros previos y documentos permanecen por UUID.

La edición incrementa la versión de concurrencia sin modificar decisiones/evidencias; sus secuencias existentes permanecen intactas (puede haber huecos). El contraste favorable anterior se conserva históricamente, pero la verificación operativa pasa a REVIEW_REQUIRED hasta contrastar el contenido modificado. Se conserva la atribución previa y no se añade aprobación automática ni nuevas reglas GMP. El módulo sigue pendiente de revisión del usuario.

## Programas anuales de Auditorías — emisión documental (2026-10-10)

Tras aprobar el usuario la propuesta, se limita la ampliación a emitir el Programa Anual de los planes de PR #117. Internas utilizan la plantilla general PMAI V04/01-2023; el DOCX de 2026 se mantiene como referencia de contraste, no cambia los cargos de aprobación. Externas emiten exclusivamente Anexo I del PMAE V05/06-2026; no se utiliza el antiguo Anexo II ni se reedita el cuerpo del maestro.

Se adopta secuencia de emisiones 00/01 independiente de V04/V05, con motivo desde 01. Solo entradas activas planificadas, sin incorporación ni reclasificación automática de auditorías fuera de plan. Se congelan datos, ejecución disponible, plantilla y bytes en histórico propio `AuditAnnualProgrammeVersion`. Descargar conserva el mismo archivo y no emite. Los aprobadores se cumplimentan expresamente; firmas/fechas se completan manualmente en Word. No se modifica el modelo/ciclo de vida de los expedientes individuales ni sus versiones aprobadas.

La generación no acredita revisión del Plan Maestro ni aprobación del Programa Anual. Las obligaciones de los procedimientos vigentes se tramitan por su vía documental. Véase `AUDITS_ANNUAL_PROGRAMMES.md` para fuentes, correspondencia, instalación y aceptación manual pendiente.

## CI #583 — reintento síncrono de React incluido en Next (2026-10-10)

PR #123 incorpora un parche pnpm ligado a next@15.5.26 para conservar el ping de Suspense recibido durante un render activo. Se traslada exclusivamente la rama corregida ya presente en react-dom@19.3.0; App Router utiliza su propio renderer compilado. Sin actualización general del framework, temporizadores de recuperación ni cambios de navegación/acciones/modelos de negocio. Dos regresiones prueban el renderer instalado; los recorridos de navegador se conservan. Revisar y retirar el parche cuando una actualización de Next integre la corrección. Evidencia y alcance compartido del runtime en CI_583_R4B_DIAGNOSIS.md.


## D-069 — Cierre funcional del núcleo y baseline V1 (2026-10-10)

Se acepta como referencia para la fase de consolidación el commit de main 5194afe5 (PR #123 integrada) y la CI #585 verde. Los siete módulos —Desviaciones, CAPA, Controles de Cambios, Reclamaciones, Devoluciones, Auditorías y PNT— están integrados y se consideran cerrados en alcance de desarrollo revisado. No se declaran instalados, cualificados ni GMP validados. Las notas cronológicas antiguas conservan su significado histórico. La referencia viva es V1_BASELINE_AND_BACKLOG.md.

## D-070 — Preservar diseño actual; UX de listados acotada (2026-10-10)

Se conserva el diseño corporativo actual: apariencia, disposición principal, navegación, colores y componentes. No se autoriza un rediseño. La mejora visual prioritaria se limita a **maquetación/espaciado/legibilidad de filtros e indicadores en listados de cada módulo**, con pruebas responsive 1440/768/390 y sin cambiar filtros, reglas ni consultas. Las restantes mejoras UX son funcionales: retorno con filtros/pestaña, búsqueda, ayuda, errores inline, indicadores de cambios pendientes y vistas guardadas según alcance aprobado.

## D-071 — Guardado explícito y conservación de comportamiento (2026-10-10)

Se mantiene guardado explícito en expedientes y formularios; no autoguardado silencioso GMP. Mantener campos ante error, control de concurrencia, protección de doble envío, versiones, snapshots y documentos históricos. Las PR transversales no homogenizarán indebidamente estados, cierres o seguimientos de módulos con procedimientos distintos. Una mejora con impacto funcional requiere aceptación y regresión propias.

## D-072 — Arquitectura QMS extensible, sin reescritura (2026-10-10)

Conservar monolito modular Next.js/TypeScript/React + PostgreSQL/Prisma. Preparar contratos de módulo y servicios comunes (identidad y autorización, gestión documental, relaciones, tareas, KPI, notificaciones, flujos) por composición y evolución versionada. No introducir microservicios, motor genérico o nuevas tablas solo por previsión. Nuevos dominios como Proveedores, OOS/OOT, PQR, validaciones, formación y equipos son posibilidades, no alcance V1. Training Manager permanece proyecto independiente salvo decisión posterior. Véase QMS_TARGET_ARCHITECTURE.md.

## D-073 — Configurabilidad controlada y futura aprobación (2026-10-10)

Separar catálogos/parametrización administrativa, versiones de formularios, reglas de negocio controladas, definiciones de workflow y cambios de código. Diseñar futuros flujos versionados con revisión/aprobación/devolución y tareas; cada instancia conservará definición/versiones aplicadas. La firma se asociará al snapshot o archivo exacto. **No afirmar que existe actualmente un workflow corporativo de aprobación o una firma electrónica GMP**. Su implementación requiere requisitos y evaluación de riesgos específicos.

## D-074 — Identidad, firma y trazabilidad son controles distintos (2026-10-10)

Login no equivale a autorización; autorización no equivale a firma; PDF firmado recibido no equivale a firma electrónica generada por la aplicación. No considerar un nombre de actor escrito manualmente identidad autenticada para uso GMP. Evaluar autenticación corporativa, RBAC en servidor, segregación de funciones, audit trail legible/seguro y firmas según uso previsto y requisitos aplicables. El historial operativo de V1 **no constituye audit trail GMP validado**. Implantación sujeta a QA/DT/IT y validación.

## D-075 — Dashboard y mejoras técnicas basados en evidencia (2026-10-10)

Crear dashboard QMS global reutilizando KPI existentes, con definiciones de cálculo, filtros, tendencias, tareas y navegación al expediente; no inventar valores ni duplicar relaciones. Medir SQL, paginación, volumen documental y latencia antes de optimizar. CI por impacto más pruebas integrales periódicas; no silenciar fallos ni retirar regresiones. Mantener seguimiento del parche Next/React #123 hasta una actualización verificada.

## D-076 — Implantación controlada y frontera GMP (2026-10-10)

IT estudiará alojamiento en servidor interno corporativo (o VM, por decidir); exigir HTTPS, identidad/permisos, secretos, operación, copias automáticas y restauración demostrada, seguridad de documentos, trazabilidad y cambios controlados. Carga real de históricos/PNT y plantillas requiere conciliación y aceptación separadas de las pruebas técnicas. Validación GMP y liberación se documentarán conforme a uso previsto; no se infiere por CI verde ni por generación de Word en LibreOffice.

## D-077 — Gobernanza del roadmap y PR antiguas (2026-10-10)

Se aprueban fases 0–7 del nuevo roadmap (ROADMAP.md); primero PR A documental, luego PR B filtros/indicadores sin rediseño y PR C de productividad/navegación. Las PR antiguas #11/#16/#17/#19/#20/#21/#76/#112 son **candidatas a obsolescencia**, no cambios pendientes a fusionar. Cerrar solo después de contrastar su diff con main y registrar reemplazo o descarte; preservar enlaces sin fusionar. PR A no ejecuta cierre ni cambia comportamiento.

## D-078 — Identidad 4B1, consulta global y actuación explícita (2026-10-12)

Se autoriza Entra OIDC de tenant único con admisión local controlada, sesiones revocables y comprobación por operación en servidor. Todo usuario activo/admitido consulta globalmente los siete módulos; departamento/expediente limitan las actuaciones concedidas, nunca la lectura ordinaria. Descarga, exportación, importación, administración y capacidades documentales son permisos propios. IT no hereda atribuciones GMP. Las políticas operativas quedan pendientes de aceptación QA/DT y cualquier cambio requiere aceptación renovada. Autoría operativa de sesión, UUID estable aditivo y conservación de históricos/snapshots; ningún nombre de formulario autentica una actuación. Proveedor/usuarios sintéticos exclusivamente en pruebas aisladas, sin bypass HTTP ni administrador por defecto en producción. La configuración real y aceptación IT siguen pendientes; no se implantan 4B2/4B3 ni se declara firma o audit trail GMP validado. Véase PHASE_4B1.md.

## D-079 — Preparación de infraestructura y recuperación 4B2 (2026-10-12)

Se prepara el alcance autorizado de 4B2: alternativas Docker Engine y Linux nativo, artefacto standalone supervisado, HTTPS y secretos externos, PostgreSQL16 persistente y privado, identidades DB separadas y migraciones manuales. El backup operativo completo usa snapshot consistente, cifrado y manifiesto autenticado; la restauración exige un destino nuevo independiente, coteja integridad y revoca sesiones/flows recuperados antes de reconciliación IT/QA. El exportador JSON demo no se considera recuperación corporativa. No se decide sistema operativo/Docker, certificados/red/vault, retención, RPO/RTO ni WAL/PITR: quedan pendientes de IT/QA y ensayos del entorno final. No se despliega, cambia el modelo/migraciones/reglas QMS ni se declara validación GMP. Véase PHASE_4B2.md.

## D-080 — Alcance técnico autorizado de Audit Trail B1 (2026-10-13)

Se implementa únicamente el motor PostgreSQL/Prisma y un piloto sintético sin ruta pública ni activación en operaciones ordinarias, según autorización de Fase 4B3-B1. Captura SQL obligatoria, contexto transaccional, identidad de sesión, journal protegido, separación de roles y recuperación verificable son controles técnicos; no aprueban políticas GMP ni las decisiones D01–D12 de 4B3-A. No se reconstruyen históricos ni se sustituyen snapshots/documentos/ChangeHistory. Los límites DBA y de confianza servidor/SQL se declaran expresamente. B2 y C requieren autorización posterior, sin inferir validación o liberación productiva. Véase PHASE_4B3_B1.md.

## D-081 — Criterios funcionales autorizados para B2, sin aceptación GMP (2026-10-13)

El responsable del proyecto confirma para diseño/implementación B2: modelo híbrido (D01); inclusión de cambios persistidos relevantes y borradores (D02); motivos opción B, uno por operación crítica/rectificación y sin obligación genérica en todos los guardados (D03); sin reconstrucción/retroatribución histórica (D04); custodia opción A, distinguir Word de trabajo y emisión/evidencia formal, conservar originales sustituidos (D05); atomicidad de negocio/historial/auditoría/evidencias (D07); protección B1 con límites DBA/custodia externa pendientes (D08). Una rama y PR B2, sin despliegue, firmas, aprobación nueva, activación productiva ni avance C. No equivale a URS/matriz GMP aprobada por QA/DT/IT; criticidad, riesgo residual y liberación siguen pendientes. Véase PHASE_4B3_B2.md y autorización adjunta de Fase4B3-B2.

## D-082 — Finalización conjunta autorizada de B2 y C (2026-10-13)

El responsable del proyecto autoriza continuar desde `3982220` en la rama existente, completar B2, verificar un checkpoint técnico interno y después implementar C sin aprobaciones intermedias. Una única PR final para los trabajos restantes de 4B3; sin merge, despliegue, datos corporativos, migraciones reales ni activación/validación GMP. Revisión y exportación del journal necesitan permisos específicos, sin atribuciones automáticas por administración técnica. QA/DT/IT mantienen pendientes retención, periodicidad regulatoria, custodia externa y liberación. Esta autorización amplía el límite C de D-081; no vuelve a decidir D01/D02/D03/D04/D05/D07.

## D-083 — Contrato de módulo QMS: diseño aprobado y decisiones MC-1 a MC-4 (2026-10-16)

El responsable del proyecto aprueba el diseño de [MODULE_CONTRACT.md](MODULE_CONTRACT.md) y su plan de migración en PR 2–5, cada una sin cambio visible, con test de equivalencia y aprobación de alcance propia (MC-1). Control de Cambios se mantiene sin relaciones operativas con otros módulos, en continuidad con D-018/D-047; el formulario de alta de la pestaña Relaciones debe retirarse en una PR acotada, conservando la consulta de relaciones existentes y sin borrar datos (MC-2). La relación de PNT con expedientes se reconoce como necesidad futura, sin incorporar PNT a `QmsRecord` ni ampliar la matriz por ahora (MC-3). Los tipos `RELATED_TO`, `IMPLEMENTED_BY` y `ASSOCIATED_WITH`, que ninguna regla admite, se retiran por etapas: primero de interfaz y código de aplicación junto con MC-2; después del enum Prisma en una PR propia, con migración que se detenga si existe alguna fila que los use y con adaptación de fixtures y pruebas de audit trail que hoy los emplean (MC-4). No implica cambio de reglas GMP, de la matriz vigente ni de datos históricos.

## D-084 — Vistas guardadas por usuario, excluidas del audit trail (2026-10-16)

El responsable del proyecto aprueba guardar en base de datos, por usuario, combinaciones de filtros de los listados de los siete módulos (opción B), en la tabla `SavedListView`. Una vista guarda solo la consulta del listado (filtros, orden y vista), sin paginación ni datos de expedientes. Cada usuario ve, crea, sobrescribe y elimina únicamente las suyas; no se comparten ni dan acceso a nada que el usuario no pueda ya consultar. Se decide excluirlas del audit trail (opción 1): son una preferencia personal de consulta que no crea, modifica ni anula datos GMP, documentos o expedientes. La tabla no tiene trigger `audit_b2_required` y sus dos acciones no figuran en el mapa de operaciones de `action-boundary.ts`; un test fija la exclusión. Las 63 operaciones de la matriz B2 no cambian. La exclusión queda documentada y justificada para revisión de QA; si QA decide incluirlas, bastará añadir trigger y operación en una PR propia. Sin cambios de permisos, reglas GMP ni datos existentes.

## D-085 — Ciclos de vida vigentes aceptados y sucesión de vigentes PNT (2026-10-16)

El responsable del proyecto revisa los hallazgos del ciclo de vida descriptivo ([MODULE_CONTRACT.md](MODULE_CONTRACT.md) §4.3) y decide:

1. **Alta directa en Cerrada:** se mantiene. Un expediente puede concluirse en el mismo momento en que se registra.
2. **Reapertura sin nueva versión:** se mantiene. Reabrir está permitido y no exige crear una versión; editar versiones anteriores es una facilidad operativa del día a día, no un control GMP.
3. **CAPA Cancelada:** puede reabrirse, y cancelar no exige un motivo separado: Cancelada es un estado y la justificación se escribe en el propio expediente.
4. **Edición de expedientes anulados:** se mantiene como está. Los anulados no se muestran en el listado por defecto y su editabilidad no plantea problema en la V1.
5. **PNT, registro histórico como vigente:** se corrige. Al registrar como vigente una revisión histórica, la vigente anterior del mismo PNT pasa a Obsoleta desde la nueva fecha de vigencia, igual que en la activación y en el cambio manual. No se sustituye una vigente con número de revisión posterior, y la nueva vigencia no puede comenzar antes que la anterior.

Los puntos 1–4 no cambian código: el ciclo de vida declarado en los contratos ya los describe. Ninguno se presenta como control GMP validado.

## D-086 — Editor de roles limitado a los permisos de cada módulo (2026-10-16)

El responsable del proyecto aprueba que las políticas de rol solo admitan, para cada módulo, los permisos que declara su contrato (`permissionsForModule`, PR 4 del contrato de módulo). Usuarios y roles sigue reservado al rol técnico. El servidor rechaza cualquier otra combinación con un mensaje que nombra módulo y permiso. El cuadro de texto JSON se sustituye por una tabla con una fila por módulo, una casilla por permiso admitido y su ámbito (Todos / Asignados; los permisos que solo admiten Todos no ofrecen Asignados). Si un rol existente tiene permisos no admitidos, el editor los enumera y se retiran al guardar la nueva política, que, como hasta ahora, revoca las sesiones del rol y queda pendiente de aceptación QA/DT. No cambian los roles guardados ni los permisos efectivos hasta que se guarda una política.

## D-087 — Demo local para ver y probar la aplicación (2026-10-16)

El responsable del proyecto aprueba una **demo local** para ver y probar la aplicación en su propio ordenador antes de ponerla en funcionamiento, sin IT ni Entra. Complementa D-078: la identidad sintética de 4B1 sigue restringida a pruebas automatizadas aisladas, y la demo usa un modo propio, `AUTH_PROVIDER=demo`, con estos límites:

- solo se activa con `APP_ENV=demo`, la base de datos `covex_demo` y un origen `http://localhost` o `http://127.0.0.1`; un servidor publicado (https o con dominio) no puede usarlo, y el arranque de producción, que exige Entra, lo rechaza;
- se entra eligiendo uno de cuatro perfiles ficticios (Garantía de Calidad, responsable de departamento, consulta, administrador técnico) de un tenant ficticio; la sesión es una sesión normal de la aplicación y todos los permisos se comprueban igual que con Entra;
- `POST /auth/demo` es la cuarta ruta pública del inventario de operaciones, y solo funciona en ese modo y con origen coincidente;
- el kit (`compose.demo.yaml`, `ops/demo/`) publica el puerto solo en `127.0.0.1`, carga datos ficticios (`demo:seed`) y no activa el audit trail GMP;
- las plantillas oficiales no se incluyen; se pueden instalar en la demo copiando su ZIP en `plantillas/`, que no se versiona.

La demo no es un entorno validado ni de producción y no admite datos reales.

## D-088 — Módulo OOS: ampliación del alcance y diseño (2026-10-16)

El responsable del proyecto decide añadir un módulo de **resultados fuera de especificación (OOS)** según el PNT GC-10/014/04. Amplía D-072, que dejaba OOS/OOT como posibilidad fuera de V1. Diseño en [OOS_DESIGN.md](OOS_DESIGN.md). Decisiones cerradas:

- la fuente es el PNT GC-10/014/04, vigente aunque el fichero diga «en redacción»; las plantillas de los anexos III y IV se toman del PNT, no de los anexos sueltos, y su encabezado correcto es 04;
- código `OOS/API|MD/YYY/AAAA` con numeración independiente por área y año, asignada al abrir; los códigos históricos se conservan;
- estados Borrador, Abierto y Cerrado, con la fase (I o II) como campo propio, y resultado Invalidado, Confirmado o No concluyente;
- relaciones canónicas OOS → CAPA y OOS → Desviación;
- solo OOS; OOT y resultados atípicos quedan fuera.

Esta PR es documental. La implementación se hará en las PR OOS-1 a OOS-3, cada una con su aprobación de alcance, y quedan abiertas las decisiones de la sección 10 del diseño.

**Ampliación del 17/10/2026 (OOS-1):** el Anexo VI es un listado imprimible solo con las columnas del PNT; el «Resultado» de cada parámetro de la Fase I es texto libre; la disposición de la Fase I cierra el OOS por error de laboratorio o lo deja abierto y habilita la Fase II (Anexo IV); no se importan OOS antiguos. OOS-1 incluye la Fase II, el resultado y el cierre; las relaciones y la captura del audit trail pasan a OOS-2 y los anexos a OOS-3.

**Ampliación del 17/10/2026 (OOS-2):** OOS-2 implementa las relaciones OOS → CAPA y OOS → Desviación y la revisión (Review) del OOS. La captura del audit trail B2 de las operaciones de OOS se separa a una PR propia (OOS-2b): requiere nuevos códigos de operación en la matriz de `PHASE_4B3_A.md` con su análisis de riesgo, extender la política de captura publicada a `OosRecord` y sustituir funciones SQL contratadas, lo que necesita aprobación de alcance. Hasta entonces, con la política B2 activa en una base de pruebas, las escrituras de OOS se rechazan en lugar de registrarse sin captura.

**Ampliación del 17/10/2026 (OOS-2b):** el responsable del proyecto aprueba el alcance de la captura B2 de OOS. Se añaden las operaciones OO01–OO05 a la matriz de `PHASE_4B3_A.md` (§3.9; de 63 a 68 operaciones):

- OO01: alta y apertura;
- OO02: datos iniciales y Fase I;
- OO03: Fase II;
- OO04: resultado y cierre;
- OO05: relaciones y anulación.

La migración aditiva `20261017000200_b2_oos_capture` hace lo siguiente:

- protege y captura `OosRecord` con la política de campos congelada en `scripts/audit-oos-build.ts`;
- extiende con el prefijo OO, el módulo OOS y su tabla las cinco funciones B2 que tienen la lista de módulos fija;
- se acompaña del contrato `ops/backup/audit-contract-oos.json`.

Los campos críticos de OOS (investigación, conclusión, disposición, dictámenes y resultado) son una propuesta técnica por analogía con los demás módulos y siguen pendientes de aceptación formal de QA/DT, como el resto de la matriz. Sin activación ni validación GMP por estar implementado (D-076).

**Ampliación del 17/10/2026 (OOS-3):** Calidad corrige el encabezado de los anexos del PNT GC-10/014/04 a 04. Los Anexos III, IV y VI se derivan del propio PNT, verificado por SHA-256, y se cumplimentan sin rediseño (`OOS_DESIGN.md` §8):

- cada OOS usa la plantilla vigente en su fecha de emisión, sin campos nuevos en el expediente;
- el Anexo VI marca el estado de seguimiento con el fondo de la fila, amarillo pendiente y verde cerrado, como pide §5.2;
- las descargas de los Anexos III y IV son documentos de trabajo con recibo y operación OO06 en la matriz (69 operaciones);
- el módulo admite además los permisos «Exportar» y «Generar documentos».

Adjuntar el anexo firmado a mano queda pendiente, porque la custodia de originales firmados requiere versiones funcionales.

**Ampliación del 17/10/2026 (OOS-4):** el PDF firmado a mano de los Anexos III y IV se adjunta en la ficha del OOS y se custodia como original recibido, igual que en Devoluciones. Como OOS no tiene versiones funcionales, el original se asocia a un snapshot técnico (versión 0) que se crea o refresca al recibirlo, sin ciclo de versiones ni firma electrónica. La sustitución exige motivo.

Detalle técnico:
- migraciones `20261017000500_oos_signed_document_kinds` y `20261017000600_b2_oos_signed_documents` (`covex_b2_retain_signed_original` ampliada a OOS);
- contrato `audit-contract-oos-signed.json`;
- la operación OO06 cubre generación y PDF firmado;
- permiso «Adjuntar documentos».

La demo local instala el PNT de OOS si se copia en `plantillas`.

**Ampliación del 17/10/2026 (anexos sin encabezado):** los anexos OOS en uso de la carpeta «FUERA DE ESPECIFICACIONES» no llevan encabezado y solo numeran la página. Cada anexo se deriva desde el título de su formulario, sin encabezado, pie ni títulos del PNT, y «Página n de X» se completa con el total de páginas del formulario. La derivación anterior de OOS-3 del mismo PNT se sustituye al reinstalar, con cambio de configuración `TEMPLATE_REDERIVED`; cualquier otro binario distinto sigue sin sustituirse (`OOS_DESIGN.md` §8).

## D-089 — Historial dentro de la Cronología (2026-10-17)

Decisión del responsable del proyecto. Las fichas de Desviaciones, CAPA, Controles de cambios, Reclamaciones, Devoluciones y OOS dejan de tener la pestaña «Historial». Mostraba las mismas modificaciones que la Cronología (fecha, usuario, campo y motivo) y la Cronología las reúne con versiones, documentos y relaciones. Sustituye a la pestaña «Historial» de la navegación de D-028 y de `UI_SPEC.md`.

- El historial operativo de D-015 se sigue registrando igual; solo cambia dónde se consulta.
- Documentación controlada conserva su Historial: no tiene Cronología y muestra el valor anterior y el nuevo de cada campo.
- Auditorías conserva su Historial: muestra los valores registrados de cada cambio, que la Cronología no enseña. *(Sustituido por D-110 · R5A: Auditorías también usa Cronología, que en este módulo muestra los «Valores registrados» de cada cambio.)*
- Los seguimientos legacy de Reclamaciones, que solo se veían en Historial, pasan a la pestaña «Versiones».
- El Audit Trail no cambia.

## D-090 — Indicadores sin objetivos ni límites de control (2026-10-17)

Decisión del responsable de Calidad. Los indicadores de los módulos son descriptivos y se valoran a final de año, fuera de la aplicación. Cierra lo que la documentación de indicadores dejaba «pendiente de decisión de Calidad».

- No se fijan objetivos por KPI ni se colorean las variaciones como mejora o empeoramiento.
- No se añade gráfico de control con límites (media ± 2σ/3σ): con pocos expedientes al mes los límites apenas avisan, y la media móvil de 12 meses ya muestra la tendencia.
- No se añade la tasa de reclamaciones por unidades o lotes distribuidos; la aplicación no registra el volumen distribuido.
- No se añade exportación del resumen anual.

## D-091 — Verificación de eficacia de CAPA en el siguiente seguimiento (2026-10-17)

Decisión del responsable de Calidad. La eficacia de una CAPA se verifica en el seguimiento siguiente al cierre de sus acciones, antes del cierre efectivo.

- Al cerrar operativamente una CAPA con la eficacia pendiente, y en cada seguimiento posterior mientras siga pendiente, es obligatoria la fecha del próximo seguimiento, rotulada «Fecha prevista de verificación de eficacia».
- No se crea un campo nuevo: la fecha es el próximo seguimiento que ya existía. No cambia el Anexo III.
- Indicadores de CAPA cuenta las verificaciones vencidas (próximo seguimiento hoy o antes) y las que no tienen fecha.

## D-092 — Categoría de causa raíz (6M) (2026-10-17)

Decisión del responsable de Calidad. Desviaciones, CAPA, Reclamaciones y OOS tienen un apartado adicional, «Categoría de causa raíz (6M)», junto a la causa raíz redactada.

- **Categorías GMP genéricas:**
  - mano de obra;
  - método;
  - máquina;
  - material;
  - medio ambiente;
  - medición;
  - «No determinada».
- Se puede marcar más de una. Es opcional y no sustituye a la causa raíz redactada ni a la investigación.
- No aparece en los anexos impresos; las plantillas aprobadas no cambian.
- Una CAPA creada desde una desviación o reclamación hereda sus categorías, que se pueden editar.
- Indicadores (Desviaciones, CAPA y Reclamaciones) añade el Pareto «Causa raíz (6M)». Cuenta menciones; los expedientes sin categoría salen como «Sin categoría».
- Captura B2: campo `rootCauseCategories` (JSON, no crítico). Contrato `audit-contract-root-cause.json`, que solo amplía la política de captura.

## D-093 — Inclusión en bloque al importar el índice de PNT (2026-10-17)

Decisión del responsable de Calidad, para la carga inicial desde el índice de Garantía de Calidad (Excel por departamentos).

- El lote de importación ofrece «Incluir en bloque» para dos grupos de filas pendientes:
  - PNT vigentes según el índice, sin más incidencia que el aviso de fórmula y con revisión y fecha de vigencia;
  - PNT anulados según el índice, aunque no tengan fechas ni revisión. Se cargan para conservar el código.
- Se incluyen con los datos del índice. Las fechas o revisiones no interpretables quedan vacías.
- Todo se importa sin verificar, como cualquier fila. La revisión y confirmación de la propuesta no cambian.
- Las demás filas se siguen decidiendo una a una: duplicados, conflictos, errores de celda, estado sin determinar o en elaboración, y vigentes incompletos.
- Es una sola operación auditada (PN06) con un evento DECISION que lista las filas afectadas.
- Requisito: los departamentos de cada hoja deben existir en Configuración. Si no, la fila no entra en el bloque.

## D-094 — Otros lotes afectados en Desviaciones, Reclamaciones y OOS (2026-10-17)

Decisión del responsable de Calidad. Un expediente puede afectar a más de un lote o producto.

- El primer lote sigue en los campos de siempre. La búsqueda, las importaciones y los anexos no cambian para un expediente de un solo lote.
- Los demás se registran en «Otros lotes afectados», con las mismas columnas que el lote principal.
  - Desviaciones: tipo (producto terminado o materia prima/acondicionamiento), producto o material, lote, tamaño de lote y cantidad afectada.
  - Reclamaciones: referencia, lote y cantidad.
  - OOS: material, lote, tamaño y cantidad.
- **Anexos impresos:** cada casilla muestra el valor principal y los adicionales, uno por línea. No se rediseña ninguna plantilla.
- **Búsqueda:** la búsqueda global y la de cada listado encuentran también los otros lotes.
- **Captura B2:** campo `additionalLots` (JSON, no crítico). Contrato `audit-contract-additional-lots.json`, que solo amplía la política de captura.

## D-095 — Ayuda para valorar la recurrencia en Desviaciones (2026-10-17)

Decisión del responsable de Calidad. Junto a «¿Causa raíz recurrente?» (edición) y a la recurrencia (ficha, pestaña de investigación), la aplicación muestra las desviaciones de los 12 meses anteriores a la apertura que comparten alguno de estos datos:

- **mismo lote:** principal, de material, de proveedor u otros lotes afectados;
- **mismo producto o material;**
- **misma área y procedencia.**

Se ordenan por número de coincidencias y fecha, como máximo 10, con enlace a cada una. Solo informa: la valoración de la recurrencia la sigue haciendo quien investiga y no se guarda nada nuevo.

## D-096 — Evidencias adjuntas por expediente (2026-10-18)

Decisión del responsable de Calidad. Desviaciones, CAPA, Controles de cambios, Reclamaciones, Devoluciones y OOS tienen una pestaña **«Evidencias»** para adjuntar archivos que respaldan el expediente (fotografías, registros, certificados…). Auditorías ya tenía su propio registro de documentos recibidos y no cambia.

- **Formatos:** PDF, DOCX, XLSX, PNG y JPG, de hasta 15 MB. Se comprueba el contenido real (cabecera PDF, paquete Office o firma de imagen), no solo la extensión.
- **Datos de cada evidencia:** descripción (obligatoria), referencia opcional (seguimiento, acción, documento…), quién la adjunta y cuándo, tamaño y huella SHA-256.
- **Solo se añaden.** Una evidencia no se sustituye ni se borra desde la interfaz. Los expedientes anulados no admiten nuevas evidencias. Se pueden adjuntar en cualquier otro estado, incluido después del cierre.
- **No se imprimen** en los anexos: las plantillas aprobadas no cambian. Tampoco aparecen entre los documentos generados.
- **Permisos:** adjuntar requiere «Adjuntar documento» del módulo; descargar requiere «Descargar». La descarga vuelve a verificar la huella.
- **Trazabilidad:** la carga queda en el historial operativo y en la cronología. Con la captura B2 activa se registra con la operación de documentos de cada módulo (DV08, CA08, CC07, RC07, DE07, OO06).
- **Pendiente:** no hay análisis antivirus de los archivos (como en el resto de adjuntos, ver `PNT_P2A.md`).

Técnicamente, la evidencia se guarda en `GeneratedDocument` con el tipo `RECORD_EVIDENCE`. Esa tabla ya está capturada por B2 y es inmutable una vez guardado el archivo, así que no hace falta un contrato B2 nuevo.

## D-097 — Alta de departamentos desde el índice de PNT (2026-10-18)

Decisión del responsable de Calidad, para la carga inicial del índice de Garantía de Calidad.

- Al analizar el Excel, cada hoja aporta su departamento: el código de la hoja y el nombre de su cabecera (la fila «Nº XX-00»). Las hojas MC-20_1, MC-20_2… se agrupan en un solo departamento.
- La previsualización muestra un bloque «Departamentos del índice» con la situación de cada uno: ya existe, existe inactivo, falta en Configuración o anulado en el índice.
- Los que faltan se dan de alta de una vez, con el nombre del índice. Se puede corregir el nombre o desmarcar alguno antes de guardar. Los existentes no se modifican.
- **Los departamentos marcados «DEPARTAMENTO ANULADO» en el índice no se dan de alta.** Sus PNT quedan sin departamento y fuera de la inclusión en bloque; se pueden decidir una a una si más adelante se crea el departamento.
- Tras el alta, el Excel se vuelve a analizar para conciliar las filas con los departamentos nuevos. Un lote guardado antes no se actualiza: hay que analizar de nuevo y guardar un lote nuevo; el lote lo indica.
- Requiere el permiso de gestionar la configuración. Es una operación de configuración (TR02) con su historial de cambios por departamento.

## D-098 — Disposición final por opciones y relleno literal de las plantillas (2026-10-18)

Decisión del responsable de Calidad tras la verificación de anexos del 18/10/2026 ([ANNEX_VERIFICATION_2026-10-18.md](ANNEX_VERIFICATION_2026-10-18.md)).

- **Disposición final de Desviaciones (opción A).** El campo pasa de texto libre a una lista con las opciones del Anexo III: Aprobado, Rechazado, Rechazado – Destruir, Rechazado – Devolver y Otro, con cantidad y comentarios. El anexo marca exactamente esa casilla (Destruir y Devolver marcan también Rechazado) y escribe la cantidad en su línea «Cantidad ____». Si la opción no tiene línea propia, la cantidad se añade debajo. Un texto anterior que no coincide con ninguna opción se conserva sin cambios, se muestra en el formulario como «Otro (registrado antes)» y se imprime como «Otro» con su texto. No hay migración de datos.
- **Observaciones internas en los listados.** Se mantienen en los listados anuales de Reclamaciones (Anexo V) y Devoluciones (Anexo VI) como seguimiento, aunque no aparezcan en los informes.
- **Relleno literal.** Los generadores conservan el texto de la plantilla: la etiqueta se mantiene tal cual y el dato se escribe a continuación o debajo. Solo se sustituyen los huecos de relleno (`____`, fechas en blanco, códigos de ejemplo), los ejemplos y las indicaciones de relleno. No se añaden opciones que la plantilla no tiene: en Control de cambios V, «no aplica» de la eficacia va en las observaciones.
- **Versión de un anexo.** Una versión mal escrita en la descarga de una versión anterior del Anexo III de Desviaciones da error, en lugar de descargar la vigente.

Las pruebas usan plantillas sintéticas con los textos literales afectados; las plantillas reales siguen fuera del repositorio.

## D-099 — Instalador único de plantillas y catálogo de huellas (2026-10-18)

Decisión del responsable de Calidad, tras detectar en la verificación de anexos que los instaladores sueltos esperaban otras huellas o nombres que los generadores.

- **Un catálogo** (`src/modules/configuration/template-catalog.ts`) es la única fuente de las huellas SHA-256 aceptadas, la vigencia y el origen de cada plantilla controlada: archivo directo, anexo recortado del PNT, anexos de OOS derivados del PNT o programa anual normalizado.
- **Un comando**, `pnpm templates:install -- <carpetas, ZIP o archivos>`, reconoce cada archivo por su huella, no por su nombre, y sustituye a los nueve instaladores anteriores, que se eliminan. La demo lo usa con la carpeta `plantillas`. Solo lee los archivos: no ejecuta nada de los paquetes.
- **Nunca se sustituye una versión instalada por otro archivo.** Se completa una versión registrada sin archivo, no se repite una ya instalada y se rechaza otro contenido para la misma versión. Única excepción: las derivaciones anteriores documentadas de los anexos de OOS (OOS-3), que se sustituyen por la actual del mismo PNT. Una versión nueva queda activa solo si no hay otra activa de ese anexo.
- **Devoluciones IV y V (opción A):** se aceptan solo recortados del PNT GC-00/028/03 (con su título «Anexo IV: HOJA DE DEVOLUCIÓN DE PRODUCTO» y «Anexo V: DECLARACIÓN…»), que es lo que se verificó. Los archivos sueltos «A4 PETICION DEV 03» y «A5 DECLARACION CLIENTE 03» ya no se aceptan. Una instalación anterior con esos archivos no se toca: el instalador la informa como conflicto.
- **Sin copia en disco:** los generadores leen la plantilla de la base de datos, verificada con su SHA-256 registrado; ya no buscan archivos en la carpeta `templates/`.
- Siguiente paso aprobado, en una PR aparte: al registrar una versión nueva en Configuración, avisar si le faltan o se le añaden campos respecto a lo que el generador rellena, antes de activarla.

## D-100 — Comprobación de una versión nueva de plantilla antes de activarla (2026-10-18)

Decisión del responsable de Calidad: cuando se añadan, quiten o muevan campos en una revisión del PNT, la aplicación debe evitar que se active una plantilla que todavía no sabe rellenar.

- Al registrar una versión nueva en Configuración → Versiones, la aplicación la compara con la **versión activa del mismo anexo**: tablas, filas, casillas y texto de cada casilla, el texto fuera de las tablas y, en los listados Excel, las hojas y el texto de cada celda. Compara lo que de verdad rellena el generador: si el anexo se recorta del PNT, compara el anexo recortado.
- **No cuentan** como diferencia los códigos, números de revisión ni fechas (palabras con cifras), ni los huecos de relleno, ni las casillas marcadas.
- **Compatible** (mismas casillas y etiquetas): se puede activar. Los expedientes nuevos usan la versión nueva y los anteriores conservan la suya.
- **No compatible** (falta, cambia o se añade un campo, cambian filas, casillas, tablas u hojas, o la aplicación rellena esa versión con otro mapeo): se muestra la lista de diferencias y **no se deja activar**; el servidor también lo impide. Hay que adaptar la aplicación (campo en el expediente y relleno de esa versión) y añadir la versión al catálogo de plantillas (D-099). Una versión del catálogo con la misma huella se puede activar.
- Sin versión activa con archivo no hay con qué comparar y la activación se permite como hasta ahora.
- Los generadores y la comprobación usan la misma definición de qué parte del documento se rellena y con qué mapeo (`src/modules/configuration/annex-generator-views.ts`). Reclamaciones III y IV y Devoluciones III, IV y V rellenan la v03 con un mapeo propio y el resto de versiones con el del PNT completo; una versión nueva de esos anexos necesita adaptación.

## D-101 — Usuario de la aplicación junto al responsable en texto libre (2026-10-18)

Decisión del responsable de Calidad: los campos de responsable de acciones y tareas pueden vincularse, además, a un usuario de la aplicación, para poder filtrar después lo asignado a cada persona.

- Campos: «Ejecutada por» de las acciones inmediatas y «Responsable» de las CAPA propuestas (Desviaciones); «Responsable» de las acciones propuestas (CAPA); responsable de dictamen, responsable de seguimiento, responsable de cada acción del plan y responsable de cada seguimiento (Controles de cambios); responsable de las CAPA propuestas y de las devoluciones propuestas (Reclamaciones); responsable de ejecución de las acciones de hallazgo (Auditorías).
- El **texto libre se conserva** y es lo único que se imprime en los anexos. El usuario es opcional y no se imprime. Al elegir un usuario con el texto vacío, se propone su nombre; si el texto ya tiene contenido, no se toca.
- Solo se pueden elegir usuarios **activos y autorizados**. Un usuario ya asignado que después se desactiva se conserva y se muestra como «(inactivo)»; asignar uno nuevo inactivo no se permite (el servidor también lo comprueba).
- En un Control de cambios con el Dictamen aprobado, el plan sigue bloqueado, pero se puede vincular o cambiar el usuario de sus acciones, porque no forma parte del plan impreso.
- El seguimiento 00 que se abre al aprobar el Dictamen hereda el usuario del responsable de seguimiento.
- Las columnas nuevas entran en la captura del historial B2 (contrato `B2_RESPONSIBLE_USERS`) y en las versiones del expediente. El vínculo no sustituye a la firma ni identifica a quien aprueba.

## D-102 — «Asignadas a mí» en el panel y en los listados (2026-10-18)

Decisión del responsable de Calidad: cada usuario debe poder ver lo pendiente a su cargo a partir del usuario vinculado al responsable (D-101).

- **Panel:** indicador «asignadas a mí» (con las vencidas) y opción «Asignadas a mí» en el filtro de plazos. La bandeja muestra cada acción pendiente con su fecha prevista (o «Sin fecha»), el expediente y el estado Vencida, Próxima (30 días) o Pendiente. Respeta los filtros de área, departamento y año.
- **Listados:** filtro «Asignación → Asignadas a mí» en Desviaciones, CAPA, Controles de cambios, Reclamaciones y Auditorías. Devoluciones y OOS no tienen responsables vinculados.
- Qué cuenta como pendiente (misma regla en panel y listados, `src/lib/qms/assigned.ts`):
  - Desviación no cerrada con una CAPA propuesta a su cargo todavía sin crear.
  - CAPA en borrador o abierta con una acción propuesta a su cargo.
  - Control de cambios no cerrado: decisión de la solicitud pendiente a su cargo; seguimiento a su cargo con el Dictamen aprobado; acción del plan a su cargo que no está completada ni marcada No aplica en ningún seguimiento.
  - Reclamación no cerrada con una CAPA propuesta sin crear o una acción derivada a su cargo.
  - Auditoría con una acción de hallazgo activa a su cargo abierta, en curso o pendiente de verificar.
  - PNT no anulado, desde D-118: la función de una revisión en su fase, o la revisión periódica a su cargo (ver D-118).
  - Las acciones inmediatas de una desviación ya están ejecutadas y no cuentan.
- Solo cuentan los responsables con usuario vinculado; un nombre escrito en el texto libre no se interpreta. Es una ayuda de trabajo: no envía avisos ni sustituye a los plazos y reglas de alertas.

## D-103 — Ajustes tras las pruebas: Arial 11 en los anexos Word, OOS sin plantilla y buscador en la barra superior (2026-10-18)

Decisiones del responsable de Calidad tras probar la aplicación:

- **Anexos Word en Arial 11.** Todo dato que la aplicación escribe en un anexo Word sale en Arial 11. Se conserva el resto del formato de la plantilla (color, negrita, alineación) y las etiquetas de la plantilla no cambian. Cuando el dato va dentro de una etiqueta («Cantidad ____», «D./D.ª ____», «AÑO: ____», «Nombre y Apellidos: …»), solo el dato pasa a Arial 11. Los listados Excel conservan el formato de celda de su plantilla.
- **OOS sin plantilla instalada.** Los anexos III, IV y VI de OOS se obtienen del PNT GC-10/014/04 con `pnpm templates:install`. Si faltan:
  - Configuración → Versiones los lista como pendientes y recuerda cómo instalarlos;
  - en el expediente, los botones «Anexo III» y «Anexo IV» aparecen desactivados con el motivo, en vez de dar error al pulsarlos.
- **Buscador global discreto.** La barra superior tiene un campo de búsqueda pequeño en el que se escribe directamente; Intro abre los resultados en /search y Ctrl+K (⌘K) lleva el foco al campo. Al escribir se ensancha. En /search no aparece, porque la página tiene su propio campo. En móvil ocupa su propia línea.

## D-104 — Velocidad al cambiar de apartado (2026-10-18)

Decisión del responsable de Calidad tras medir los tiempos:

- **Barra fina de progreso al cambiar de apartado.** La pantalla «Cargando información…» (`src/app/loading.tsx`) se mostraba en cada clic y React la mantenía un mínimo de unos 300 ms, aunque la página ya hubiera llegado. Ahora, al cambiar de apartado, sigue visible la página anterior y aparece una barra de 3 px arriba (`NavigationProgress`), solo si la navegación tarda más de 120 ms. La pantalla de carga se conserva únicamente para la primera carga de la página: va en un `<Suspense>` fijo del layout (`PageLoading`), que React no vuelve a mostrar durante las navegaciones.
- **Modo producción para probar.** `pnpm preview` compila y arranca la aplicación en modo producción. Es el modo recomendado para probarla (por ejemplo en Codespaces). `pnpm dev` queda solo para programar, porque compila cada apartado la primera vez y responde varias veces más lento.
- Mediciones con unas 4.500 expedientes sintéticos:
  - en producción, el servidor responde a cada apartado en 40–100 ms;
  - el clic en el menú pasa de ~850 ms a ~170–290 ms, medido con el navegador de pruebas;
  - con `pnpm dev`, la primera visita a cada apartado tarda 1,3–2,7 s y las siguientes ~0,5 s.

## D-105 — Instalar plantillas desde Configuración (2026-10-18)

Decisión del responsable de Calidad:

- **Botón «Instalar plantillas»** en Configuración → Versiones, dentro de la tarjeta «Plantillas controladas». Se suben a la vez los ZIP de plantillas, el PNT de OOS o anexos sueltos (.zip, .docx, .xlsx; hasta 15 MB por envío). No hace falta la terminal.
- **Mismas reglas que `pnpm templates:install`.** Ambos usan el mismo servicio (`template-install-service.ts`):
  - cada archivo se reconoce por su SHA-256 con el catálogo único (D-099), no por su nombre;
  - de los ZIP solo se leen los archivos de Office; nada de lo que traiga el paquete se ejecuta;
  - una versión instalada nunca se sustituye por otro archivo;
  - todo se guarda en una transacción y se comprueba lo guardado antes de confirmarla;
  - cada alta queda en el historial de configuración con el usuario y el origen.
- **Resultado por plantilla** en la propia página: instalada, ya estaba, no sustituida o error, y la lista de archivos no reconocidos.
- **Permiso «gestionar la configuración»** (`installTemplatesAction`, operación TR04 del diseño de audit trail).
- **Revisiones nuevas.** Un archivo que no está en el catálogo no se instala. La revisión nueva de un anexo se registra con «Registrar nueva plantilla» y solo se activa si es compatible con la versión vigente (D-100). Si cambian las casillas, hay que adaptar la aplicación y añadir la versión al catálogo.
- **Programa anual interno (PMAI V04).** El original es `.doc` y solo se puede convertir con LibreOffice desde la terminal. La página lo indica. Queda pendiente sustituirlo en el catálogo por su versión `.docx`, cuando Calidad la facilite (resuelto en D-106).

## D-106 — Programa anual interno desde su .docx (2026-10-18)

Decisión del responsable de Calidad:

- **El PMAI V04 se instala desde el `.docx` guardado en Word por Calidad** (SHA-256 `8dc8c00c04dd2138f1352a903dc18727a48909ab9f7c898eb8c36bb5d53fdea9`), no desde el `.doc` original. Ya no hace falta LibreOffice para instalar ninguna plantilla; el instalador deja de leer `.doc`.
- **Comprobado antes de cambiarlo:**
  - mismas casillas y etiquetas que la conversión del `.doc` (comprobación D-100, sin diferencias);
  - el programa generado tiene el mismo texto y el mismo diseño;
  - el `.docx` de Word conserva mejor el formato: la conversión ponía en negrita el equipo auditor y el aprobador técnico.
- **Instalaciones anteriores.** Donde el PMAI se instaló convirtiendo el `.doc`, la instalación del `.docx` sustituye ese archivo y lo anota en el historial de configuración. Esas conversiones no daban siempre el mismo archivo, así que no se pueden enumerar como derivaciones anteriores (`replacesDocConversion`). Los programas ya emitidos no cambian: cada emisión guarda su propio documento.
- Se mantiene la versión `PMAI-V04-01-2023-GENERAL`: es el mismo documento controlado en otro formato de archivo.

## D-107 — Plantillas instaladas solas al arrancar (2026-10-18)

Decisión del responsable de Calidad: en la aplicación instalada, las plantillas se cargan solas, sin que nadie tenga que subirlas.

- **Carpeta del servidor.** IT deja los ZIP de plantillas, el PNT de OOS y el `.docx` del programa anual interno en la carpeta de plantillas del servidor. La aplicación lee la carpeta indicada en `TEMPLATE_INSTALL_DIR` cada vez que arranca y las instala.
  - Con Docker, `ops/compose.production.yaml` ya monta `COVEX_ASSETS_DIR` en `/app/templates` en solo lectura y fija `TEMPLATE_INSTALL_DIR=/app/templates`.
  - En la instalación nativa, se indica en `/etc/covex/production.env`.
- **Mismas reglas que la terminal y el botón (D-099, D-105):**
  - cada archivo se reconoce por su SHA-256;
  - nada de los ZIP se ejecuta;
  - una versión instalada nunca se sustituye;
  - cada alta queda en el historial como «Instalación automática al arrancar».
- **Repetir no cambia nada.** Un arranque con las plantillas ya instaladas no escribe nada.
- **No bloquea la aplicación.** La instalación corre en segundo plano después de arrancar. Si la carpeta no existe, está vacía o algo falla, la aplicación funciona igual y las plantillas se pueden subir desde Configuración.
- **Con el audit trail obligatorio activado no se instala al arrancar**, porque cada cambio necesita un usuario autenticado: se usa el botón «Instalar plantillas».
- **Las plantillas siguen fuera de Git**: el repositorio es público. En la carpeta `plantillas/` del repositorio se ignora todo salvo su `README.md`. En desarrollo o Codespaces, `.env.example` propone `TEMPLATE_INSTALL_DIR="plantillas"`.

## D-108 — Demo con perfiles ficticios en GitHub Codespaces (2026-10-19)

Decisión del responsable de Calidad: poder probar la aplicación con usuarios ficticios sin instalar nada (ni Docker), desde el Codespace del repositorio.

- **Un comando:** `pnpm demo:codespace` (`scripts/demo/codespace.sh`):
  - arranca el PostgreSQL de `compose.yaml` y crea, si no existe, una base aparte `covex_demo`;
  - aplica las migraciones, los catálogos, los datos ficticios y los usuarios de la demo;
  - compila y arranca la aplicación en el puerto 3000 con la página de perfiles (Garantía de Calidad, responsable de departamento, consulta y administrador técnico).
- **La base habitual del Codespace no se toca.** La demo usa siempre `covex_demo` y datos ficticios.
- **Plantillas:** se instalan solas al arrancar desde la carpeta `plantillas` (D-107) o con «Instalar plantillas».
- **Solo dentro de un Codespace.** La demo local (D-087) admitía únicamente `http://localhost`. Ahora acepta además la dirección exacta del propio Codespace, `https://<nombre>-<puerto>.<dominio>`, que GitHub da en `CODESPACES`, `CODESPACE_NAME` y `GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN`.
  - Sigue exigiendo `APP_ENV=demo`, `AUTH_PROVIDER=demo` y la base `covex_demo`.
  - Fuera de un Codespace no existen esas variables.
  - El arranque de producción exige Entra y la rechaza.
- **Formularios y entrada.** Según el reenvío de puertos, el origen de la petición llega como la dirección del Codespace o como `http://localhost:3000`. Dentro del Codespace se admiten ambos, y solo esos, en la entrada a la demo, en el control CSRF y en las acciones de servidor (`next.config.ts`). Si la entrada a la demo falla, el terminal muestra el motivo, sin datos de sesión.
- **Acceso.** Los puertos de un Codespace son privados por defecto: solo la cuenta de GitHub del propietario puede abrir la demo. No hay que hacerlos públicos.

## D-109 — Ejemplos de la demo en todos los módulos (2026-10-19)

Decisión del responsable de Calidad: la demo debe enseñar cómo funciona cada módulo con varios expedientes, no solo con el ejemplo inicial de cada uno.

- **Qué carga:** `scripts/demo/seed-examples.ts` (`pnpm demo:examples`) añade expedientes ficticios en distintos estados:
  - 7 desviaciones, 7 CAPA y 7 PNT;
  - 6 controles de cambios, 6 reclamaciones, 6 devoluciones, 6 auditorías y 6 OOS.
- **Estados que cubre:** borradores, abiertos, cerrados, anulados o cancelados, con relaciones entre módulos (desviación → CAPA, reclamación → devolución, OOS → desviación, etc.) y tareas asignadas a los perfiles de Garantía de Calidad y de responsable de departamento.
- **Fechas relativas al día de la carga.** Así siempre hay plazos vencidos, próximos y revisiones de PNT a punto de vencer.
- **Códigos en el formato real** (`D/LG-30/001/2026`, `AC/PM-10/001/2026`…), continuando la numeración que ya exista en la base de la demo.
- **Solo en la demo.** Solo se ejecuta con `APP_ENV=demo`, `AUTH_PROVIDER=demo`, la base `covex_demo` y `ALLOW_DEMO_DATA=true`. Todos los textos son inventados y llevan la marca «EJEMPLO DEMO (D-109)».
- **Una sola vez.** Si los ejemplos ya están, no hace nada. Los PNT cuyo código ya exista no se tocan.
- **Cuándo se carga:** `pnpm demo:codespace` y la demo Docker lo ejecutan al preparar la base.
- **Límites:** el historial de modificaciones de cada ejemplo solo registra el alta («Ejemplo de la demo»). Los anexos se generan solo si las plantillas están instaladas.
- **CAPA plan de los ejemplos (D-110):** `scripts/demo/seed-capa-plans.ts` (`pnpm demo:capa-plans`) establece la versión 00 de las auditorías abiertas de ejemplo y registra un seguimiento 01 en la interna. Se ejecuta después de instalar las plantillas porque cada versión congela su A4.03; sin esa plantilla no hace nada, y no toca las auditorías que ya tienen versiones.

## D-110 — Auditorías: CAPA plan con versiones, hallazgos y aspecto (2026-10-19)

Decisión del responsable de Calidad tras revisar el módulo. El diseño completo está en `docs/AUDITS_R5.md` y se implanta en cuatro PR (R5A–R5D).

| Tema | Decisión |
|---|---|
| Versiones del CAPA plan | Numeración propia 00, 01, 02…, independiente del informe. 00 al establecer el CAPA plan; cada seguimiento genera la versión siguiente. |
| Cierre de la auditoría | Todas las acciones cerradas o no aplicables, con evidencia o justificación, y cada hallazgo tratado. Las Desviaciones y CAPA vinculadas siguen su propio ciclo y no bloquean. |
| Cliente e inspección | Solo CAPA plan: el informe recibido se adjunta, sin textos obligatorios ni informe COVEX. |

- Sustituye de D-066 la regla «solo se versiona al emitir el informe» y los requisitos de cierre de las acciones (verificación de cada acción, CAPA atribuidas cerradas y eficaces). El resto de D-064/D-065/D-066 sigue vigente.
- **R5A (implantada):**
  - el expediente usa la cabecera, las pestañas y los estados en color de los demás módulos;
  - el historial operativo pasa a Cronología, como en D-089: la pestaña «Historial» desaparece y sus enlaces abren Cronología. En Auditorías, cada cambio de la Cronología conserva sus «Valores registrados» (anterior y nuevo), que antes solo enseñaba Historial;
  - Documentos reúne todas las descargas;
  - el CAPA plan del estado actual se descarga siempre, también en borrador, y desde Hallazgos;
  - los errores de descarga se muestran como página legible;
  - los formularios de planes y programas anuales conservan lo escrito ante un error.
- **R5B1 (implantada):**
  - cada hallazgo es una ficha con un único elemento en edición, indicado en la dirección, sin desplegables anidados;
  - las acciones del CAPA Plan aparecen en filas;
  - «Justificar y cerrar» un hallazgo sin acciones;
  - se pueden vincular Desviaciones y CAPA en borrador, también desde una auditoría en borrador (se busca el borrador por su descripción);
  - cerrar un hallazgo exige el permiso CLOSE también en el servidor.
- **R5B2 (implantada):**
  - «Abrir CAPA» y «Abrir desviación» desde un hallazgo abren el alta ya rellenada con departamento, descripción del hallazgo y origen;
  - lo guardado, como borrador o abierto, queda vinculado al hallazgo;
  - la acción de alta del módulo de destino crea la relación y la atribución, y exige EDIT en la auditoría;
  - si en la CAPA se quita la auditoría de los orígenes antes de guardar, no se vincula;
  - se descartó crearlo con un clic: el audit trail asigna cada operación a un único módulo.
- **R5C1 (implantada):**
  - tabla nueva `AuditCapaPlanVersion`, de solo anexado: la versión no se modifica ni se borra; captura B2 y contrato `audit-contract-capa-plan.json`, sin cambiar funciones `covex_b2_*`;
  - «Establecer CAPA plan (versión 00)» en Seguimiento, con la auditoría abierta y permiso EDIT (operación AU06), aunque los hallazgos estén incompletos y sin informe emitido;
  - fija la fecha del CAPA plan y la de establecimiento (si ya existía, se conserva) y congela la foto y el A4.03 con «00»;
  - las fechas del CAPA plan salen del formulario del informe;
  - la pestaña Versiones separa «Informe» y «CAPA plan», con la descarga de cada versión;
  - sin la plantilla A4.03 no se emite y se avisa de cómo instalarla.
- **R5C2 (implantada):**
  - **Seguimiento del CAPA plan.** Desde la tarjeta «CAPA plan» de Seguimiento (permiso FOLLOWUP, operación AU04), una tabla con todas las acciones activas y los hallazgos sin acciones.
    - Campos por fila: fecha objetivo, estado, fecha de cierre, referencia de evidencia y evidencia u observación; en los hallazgos, además, el tratamiento.
    - Datos del seguimiento: fecha, próxima revisión opcional y observaciones.
    - Al guardar, en una transacción, se actualizan las filas que cambian (con las validaciones de cierre de siempre) y se emite la versión siguiente con su A4.03.
    - Sin cambios ni observaciones no se emite versión.
    - Cerrar, dar por no aplicable, reabrir o cambiar una fecha de cierre exige motivo, y cerrar exige el permiso CLOSE.
  - **Seguimientos anteriores:** los `AuditFollowup` se muestran en solo lectura y ya no bloquean el cierre.
  - **Cierre**, según la tabla de `AUDITS_R5.md` §5:
    - acciones activas cerradas o no aplicables con evidencia, referencia o justificación;
    - hallazgos sin acciones con tratamiento terminal y evidencia;
    - CAPA plan establecido si hay hallazgos;
    - informe emitido (internas y proveedor) o recibido, con la respuesta si se requiere (cliente e inspección).
  - **Deja de exigirse** la verificación de cada acción, que las CAPA vinculadas estén cerradas y eficaces, el envío del informe de proveedor, la evidencia de cierre y los seguimientos pendientes. Se mantiene la excepción de proveedor.
  - **Aviso al cerrar:** si la última versión del CAPA plan no refleja el estado actual, se recomienda un seguimiento final.
  - **Cierre parcial:** CAPA plan establecido (internas) o informe enviado (proveedor), también sin informe emitido.
  - **A4.03:** las versiones del informe ya no generan ni ofrecen A4.03; el CAPA plan solo se numera en su propia secuencia.
- **R5D (implantada):**
  - **Cliente e inspección sin informe COVEX.** Emitir el informe se rechaza con «En auditorías de cliente o inspección no se emite informe COVEX: adjunta el informe recibido.»; la pestaña Versiones no ofrece «Emitir» y las versiones anteriores se conservan en solo lectura (descargas, sin cargar PDF firmado nuevo).
  - **«Informe recibido»** en «Informe y cierre»: los documentos AUDIT_RECEIVED adjuntos, «requiere respuesta», la fecha de respuesta enviada y observaciones internas opcionales. Guardar estos datos no toca la conclusión ni las fechas de informe que tuviera el expediente.
  - **Integridad:** en estos escenarios no se avisa de informe sin versión, de datos sin versión ni de cierre sin conclusión.
  - **Situación y listado:** la situación no queda en «informe pendiente» (Planificada, Realizada, En seguimiento o Cerrada); la columna Informe muestra «No aplica»; el filtro «Informe: pendiente» las excluye y «En seguimiento» no exige versión de informe. Cargar un PDF firmado en una versión antigua se rechaza también en el servidor.
  - **Tipos de hallazgo por escenario:** cliente, `CLIENT_OBSERVATION` y `RECOMMENDATION`; inspección, `AUTHORITY_OBSERVATION` y `RECOMMENDATION`; el resto, `FINDING` y `RECOMMENDATION`. Se valida en el servidor («Tipo de hallazgo no permitido en este escenario.») y el desplegable solo ofrece esos tipos. Un hallazgo existente de otro tipo (por ejemplo, tras cambiar el escenario) conserva su tipo al guardarse.
  - Sin migración. El CAPA plan, sus versiones y su A4.03 funcionan igual que en los demás escenarios.
- **Ajustes posteriores a R5 (implantados):**
  - El seguimiento del CAPA plan solo comprueba las filas que cambian: una fila intacta no lo bloquea por su marca de edición ni por sus validaciones.
  - La fecha objetivo de cada acción se valida también en el servidor.
  - Si otra persona cambió una fila, el error «cambió» ofrece «Recargar con los datos actuales».
  - Las fechas propuestas (CAPA plan y seguimiento) son las de hoy en Madrid, no en UTC.
  - La demo siembra versiones del CAPA plan cuando la plantilla A4.03 está instalada (D-109).


## D-111 — Mejoras visuales de los expedientes y del inicio (2026-10-19)

Decisión del responsable de Calidad, a partir de un comentario de IT: los expedientes recogen mucha información y está poco señalizada. Diseño en `docs/superpowers/specs/2026-10-19-expedientes-visual-design.md` y plan en `docs/superpowers/plans/2026-10-19-expedientes-visual.md`.

- **Solo presentación.** No se quita ningún dato, campo, flujo ni permiso. Sin migraciones ni funciones nuevas. Lenguaje visual corporativo (D-070). Prioridad escritorio.
- **Cuatro entregas:**
  - V1: cabecera común y franja de datos clave;
  - V2: índice lateral en los formularios;
  - V3: pestaña única «Desviación»;
  - V4: «Mis tareas» como primer bloque del inicio, sin selector de departamento.
- **V1 (implantada):**
  - **Cabecera común** (`RecordHeader`) en Desviaciones, CAPA, Cambios, Reclamaciones, Devoluciones, OOS y Auditorías, con las acciones siempre en el mismo orden: «Anular expediente» separado a la izquierda, «Modo revisión», las acciones propias del módulo y la acción principal («Editar…») la última. El aviso de expediente anulado sigue bajo la cabecera.
  - **Borradores sin código** de Desviaciones y CAPA: se titulan con su texto descriptivo (material o proceso, o descripción del defecto) y el chip «Borrador · sin código».
  - **Franja de datos clave** (`RecordKeyFacts`) como primera tarjeta del resumen o de la información de los 8 módulos:
    - el estado con su color;
    - las fechas principales en negrita;
    - el plazo o próximo seguimiento en rojo («Vencido») o ámbar («Próximo», 30 días) con la misma regla que el panel (`classifyDue`), y sin color si el expediente está cerrado.

    Los datos siguen también en su sitio.
  - **Auditorías:** los campos de Información pasan de cajas con borde al estilo etiqueta/valor de los demás módulos.
  - **Vacíos atenuados** en la franja y en la información de Auditorías.
  - **Móvil:** pestañas en una sola fila desplazable.
  - **Documentación controlada** conserva su cabecera propia y recibe la franja (estado, revisión vigente, vigente desde, próxima revisión con su tono y departamento).
- **V2 (implantada):** índice lateral de apartados en los formularios de alta y edición de los 8 módulos (`FormWithIndex` y `SectionIndex`).
  - Se construye con los títulos que ya tienen los formularios (A. Origen, B…, E. Investigación…) y no cambia campos, orden, validaciones ni guardado.
  - A partir de 1200 px aparece como una columna fija a la izquierda que marca el apartado visible. Al pulsar un apartado, la página baja hasta él.
  - Por debajo de 1200 px no aparece y el formulario se ve como antes.
- **V3 (implantada):** en Desviaciones, las pestañas Descripción, Investigación, Acciones y Conclusión se sustituyen por una única pestaña «Desviación».
  - Contiene las mismas tarjetas, en el mismo orden, bajo cuatro apartados bien marcados, con su ancla (`#desviacion-descripcion`…) e índice lateral.
  - Siguen siendo bloques separados: descripción del evento, investigación, causa raíz, evaluación de impacto, acciones inmediatas, CAPA propuestas y conclusión.
  - **Compatibilidad:** las claves antiguas (`?tab=investigation`…) son alias que muestran «Desviación» y bajan al apartado.
  - **Comentarios de revisión:** el catálogo conserva sus claves de pestaña, de modo que los comentarios ya guardados siguen asociados a su campo y se abren sin recargas.
- **V4 (implantada):** en el inicio, **«Mis tareas»** es el primer bloque, bajo el título del panel, y está siempre visible.
  - Muestra las tareas del usuario (vencidas, próximas y pendientes) con la misma tabla y la misma definición de «asignada» de D-102. Sin tareas, indica «No tienes tareas asignadas.».
  - Enseña las 15 primeras. Si hay más, «Ver todas» lleva al modo «Asignadas a mí» de la lista de plazos, que no cambia.
  - La tarjeta «asignadas a mí» enlaza a este bloque.
  - Sin selector de departamento fuera de «Filtros» (descartado por el responsable de Calidad).
- **Estado:** D-111 completa, con V1–V4 implantadas.

## D-112 — Ficheros fuera de las lecturas por defecto (BE1-A, 2026-10-20)

Decisión del responsable de Calidad dentro de BE1 (backlog `docs/V1_BASELINE_AND_BACKLOG.md`), que se reparte en tres entregas: A (esta), B (errores y registros) y C (índices con evidencia). Diseño en `docs/superpowers/specs/2026-10-20-be1a-ficheros-fuera-de-lecturas-design.md`, plan en `docs/superpowers/plans/2026-10-20-be1a-ficheros-fuera-de-lecturas.md` y medición en [PHASE_BE1A.md](PHASE_BE1A.md).

- **Exclusión por defecto.** El cliente Prisma de la aplicación (`src/lib/db-client.ts`) no lee la columna `fileData` de los siete modelos con ficheros: `TemplateVersion`, `RecordVersionDocument`, `GeneratedDocument`, `ControlledRevisionDocument`, `AuditAnnualProgrammeVersion`, `AuditCapaPlanVersion` y `AuditTrailExport` (`binaryOmit` en `src/lib/db-binary-omit.ts`). Vale también dentro de las transacciones y en las relaciones anidadas.
- **Quien necesita los bytes los pide:** `omit: withBytes` en la consulta, o `fileData: true` en un `select`. Así lo hacen las descargas, la carga de plantillas para generar Word, la instalación de plantillas, los documentos de Auditorías, la exportación del historial y las emisiones que devuelven el fichero.
- **Inventario.** `src/lib/db-binary-omit.test.ts` lista los archivos de `src` que leen o escriben `fileData` y comprueba que `binaryOmit` cubre todos los modelos con `Bytes` del esquema. Un archivo nuevo que lea bytes hace fallar la prueba hasta revisarlo.
- **Límite conocido:** el compilador no conoce la exclusión en ningún caso, porque el cliente se tipa como `PrismaClient` y las funciones reciben `Prisma.TransactionClient`; una fila leída sin pedir los bytes sigue tipada con `fileData`. Las salvaguardas son el inventario y el smoke `be1a:smoke`. El inventario funciona por archivo: una lectura nueva sin `withBytes` dentro de un archivo que ya está en la lista no lo hace fallar, así que esas lecturas se revisan a mano.
- **Sin cambios** de pantallas, permisos, checksums, custodia inmutable, esquema ni migraciones. Los scripts que crean su propio `PrismaClient` (copias de seguridad, recuperación, mediciones) siguen leyendo todo.
- **Siguiente:** BE1-B (registro de errores) y BE1-C (índices) necesitan su propia aprobación de alcance. El cambio de almacenamiento de ficheros queda para decidir con IT a partir de los volúmenes medidos.

## D-113 — Registro de errores con referencia visible (BE1-B, 2026-10-20)

Decisión del responsable de Calidad dentro de BE1, segunda entrega. Diseño en `docs/superpowers/specs/2026-10-20-be1b-registro-de-errores-design.md` y plan en `docs/superpowers/plans/2026-10-20-be1b-registro-de-errores.md`.

- **Para IT, en el servidor.** Cada fallo del servidor deja una línea JSON en la salida estándar (`src/lib/log/server-log.ts`), que IT recoge con docker, journald o el colector que apruebe. Sin tabla ni pantalla en la aplicación, sin librerías nuevas y sin migraciones.
- **Campos:**
  - `service`, `event`, `level`, `at`;
  - `ref`, `operation` y `module`;
  - `userId`: solo el UUID interno, sin nombre ni correo;
  - `errorName`;
  - `prismaCode` y `prismaModel`, si es un error de Prisma;
  - `frames`: hasta 10 líneas de la traza con forma de línea de pila, sin la cabecera del mensaje aunque ocupe varias líneas. En producción son posiciones del código compilado, sin mapas de fuente.
- **Nunca se escribe:** el mensaje del error, su `cause`, el `meta` de Prisma, argumentos, cuerpos, cabeceras, cookies, SQL ni valores de formulario.
- **Escritura directa.** Se escribe con `process.stdout.write`, porque el arranque de producción silencia `console` (`ops/runtime/logging.mjs`, 4B2); ese envoltorio no cambia. Antes de D-113, en producción, la «Referencia técnica» de la página de error no aparecía en ningún registro.
- **Referencias:**
  - **Errores no controlados:** `onRequestError` (`src/instrumentation.ts`) los registra con `ref` igual al `digest` que la página de error muestra como «Referencia técnica». No se registra la URL real, solo la plantilla de ruta. En estos casos `userId` va vacío, porque Next.js llama al gancho fuera del contexto de la petición.
  - **Fallos inesperados al guardar:** la rama genérica de `persistenceFormError` registra el fallo y añade «Referencia para IT: E-xxxxxxxx» al mensaje principal (`error`), que muestran todos los formularios, también los de seguimiento. Los errores esperados no se registran: duplicado, relación o registro inexistente, validación y motivo crítico.
- **`catch` de servidor.**
  - Los que ocultaban fallos reales ahora registran: descarga de documentos PNT, inicio, retorno y cierre de sesión, instalación de plantillas al arrancar, lectura de plantillas al activar y marcador de error de la importación PNT.
  - Los que tratan una entrada mal formada, una URL de retorno, la configuración o un acceso denegado llevan un comentario.
  - La prueba `src/lib/log/silent-catch.test.ts` detecta los casos habituales de `catch` de servidor que descartan el error sin registrarlo ni justificarlo. También detecta `console.error` y `console.warn` en código de servidor, que están silenciados en producción (salvo el diagnóstico del modo demostración), y las traducciones de errores de Prisma a un texto genérico sin registro.
  - Tras la revisión final pasan a registrar también los errores inesperados de las vistas guardadas, de las acciones de revisión, del guardado de PNT y de las rutas de documentos, ciclo, estado manual, índice e importación de PNT.
- **No es** el audit trail, ni el historial, ni una evidencia GMP: es un registro operativo para diagnosticar fallos técnicos.

## D-114 — JIT desactivado en la aplicación y consultas reescritas, sin índices nuevos (BE1-C, 2026-10-20)

Decisión del responsable de Calidad dentro de BE1, tercera y última entrega. Diseño en `docs/superpowers/specs/2026-10-20-be1c-consultas-medidas-design.md`, plan en `docs/superpowers/plans/2026-10-20-be1c-consultas-medidas.md` y medición en [PHASE_BE1C.md](PHASE_BE1C.md).

- **JIT desactivado en las conexiones de la aplicación.** `createAppPrismaClient` añade `options=-c jit=off` a `DATABASE_URL` (`src/lib/db-url.ts`).
  - Si la URL ya trae `options`, no se toca: IT puede fijar otra configuración.
  - No cambia la configuración del servidor PostgreSQL ni los scripts con su propio cliente (copias, recuperación, mediciones). Tampoco el cliente propio del importador del índice PNT (`src/modules/controlled-documents/import/database.ts`), que hace cargas por lotes y no consultas cortas; queda con JIT activo.
  - Motivo: la aplicación hace consultas cortas, y la compilación JIT costaba más que la propia consulta (~420 ms frente a 28 ms en la de seguimientos de Auditorías del panel).
- **Dos consultas reescritas, con los mismos resultados:**
  - Auditorías «con PDF firmado»: parte de los PDF firmados y comprueba con `NOT EXISTS` que su versión es la última, en vez de recorrer todas las versiones;
  - panel de inicio: las fechas de ciclo de vida de las revisiones PNT se leen en una consulta filtrada por documento, sin la lista de pares que generaba el `include` anidado.
- **Sin índices nuevos, migraciones ni cambios de esquema.** La medición no señaló ningún caso que mejorase con un índice. Los índices de texto para las búsquedas por lote exigirían `pg_trgm` y solo ayudarían campo a campo.
- **Resultado con 20.000 expedientes ficticios:** «con PDF firmado» de 110 a 31 ms; panel de 211 a 170 ms.
- **Nueva medición** con datos reales tras la carga del histórico (fase 5, DATA1).
- **Comprobado:**
  - con el smoke `be1c:smoke` (grupo `postgresql`): mismos expedientes que la consulta anterior, también con un PDF firmado solo en una versión antigua; la lectura de fechas PNT del panel sin lista de pares; y `SHOW jit` = `off`;
  - con `phase3b2:smoke`, cuya cohorte incluye revisiones PNT sin ciclo de vida y con fechas nulas: el panel es igual que la referencia de 3B2.

## D-115 — CI1 aplazado (2026-10-20)

Decisión del responsable de Calidad. Diseño de referencia en `docs/superpowers/specs/2026-10-20-ci1-ci-mas-rapida-design.md`.

- **Medición:** la CI ejecuta todas las pruebas en cada PR que no sea solo de documentación y tarda unos 9,5 min (8 min 19 s a 10 min 2 s en las tres últimas ejecuciones). El camino crítico es el build (~3 min) más el grupo de regresión más lento (~6 min).
- **Decisión:** no se cambia la CI por ahora. Acortar la espera en ~3 min, el resumen de fallos y la batería nocturna son mejoras de comodidad del desarrollo que no aportan a los usuarios ni a los requisitos GMP.
- **Si se retoma:** sin selección de pruebas por impacto. El repositorio es público, así que los minutos de GitHub Actions no tienen coste, y omitir grupos permitiría fusionar una PR sin pasar regresiones que sí rompe. Se repartirían los grupos en más trabajos paralelos.

## D-116 — Campos de anexos pendientes de las PR #19, #20 y #21 (2026-10-20)

Decisión del responsable de Calidad tras revisar las PR antiguas del Hito 10.2. La versión fusionada fue #22; estos cuatro puntos quedaban sin trasladar y sin decisión.

1. **Desviaciones, «Turno»: se añade.**
   - Campo `shift` de texto libre y opcional, junto a «Detectado por», como el turno de OOS. No hay lista cerrada de turnos en el PNT, así que no se inventa una.
   - Se escribe en la casilla «turno» del Anexo III, tabla 0, fila 5, celda 5, en lugar de la indicación de la plantilla, igual que la fecha y la hora.
   - Queda en las versiones del expediente y en el Anexo III de cada versión. Las versiones anteriores quedan sin turno.
   - Captura B2 como texto no crítico (contrato `B2_DEVIATION_SHIFT`). Migración aditiva, sin cambios de funciones, triggers ni tablas de auditoría.
2. **Desviaciones, nombres de validación QA y de aprobación final (tablas 1 y 4 del Anexo III): se rellenan a mano** al firmar. Se podrán incorporar si en el futuro se implantan flujos de aprobación.
3. **CAPA, «Emitido / revisado / aprobado por» (Anexo III): igual que el punto 2.** Se rellenan a mano al firmar.
4. **Devoluciones, Anexo V (declaración del cliente): no lo rellena COVEX.** Lo cumplimenta el cliente, así que la aplicación no recoge sus casillas de evidencias ni su responsable técnico.

Con esta decisión, el resto del contenido de #19, #20 y #21 está cubierto por #22 y las PR posteriores, y las tres se cierran sin fusionar.

## D-117 — Mejoras de interfaz sin rediseño tras la auditoría UI/UX (2026-10-20)

Decisión del responsable de Calidad tras la auditoría UI/UX de la Fase 1, hecha sobre la interfaz real con datos ficticios: 31 hallazgos, 27 comprobados en pantalla o medidos.

- **Se mantiene el diseño actual.** No se adopta ninguna de las tres direcciones de rediseño estudiadas. Las mejoras corrigen acabado, coherencia y accesibilidad sin cambiar la navegación, los colores, la estructura de las pantallas ni el comportamiento GMP.
- **El orden de los campos de los formularios no se modifica.** Sigue el orden de los apartados de los anexos oficiales.
- **Tres entregas, cada una en su PR y con las pruebas en verde:**
  1. **Acabado:** controles con el estilo del navegador, jerga interna, contraste, foco, alineaciones y nombres accesibles.
  2. **Acciones y errores:** ventana de anular, posición de «Anular», validación en línea y en español y hora local en el audit trail.
  3. **Coherencia:** fuente incluida en la aplicación y componentes comunes de tabla, botón, campo y pastilla.

  Al terminar se repite la auditoría.
- **Decisiones sobre los puntos abiertos:**
  - **Acción principal de las fichas:** un texto común en todos los módulos, «Editar / seguimiento».
  - **Datos repetidos en las fichas:** cada dato se muestra una sola vez, sin quitar ninguno.
  - **Listado de Desviaciones:** se mantienen todas las columnas; cada usuario ajusta las suyas con el selector y las vistas guardadas.
  - **Audit trail:** hora local en lugar de UTC.
  - **Contadores de los listados:** muestran totales sin contar anulados ni borradores.
  - **Columna «Control»:** se le da un nombre más preciso.
  - **Pestañas de CAPA:** «Seguimiento de la acción» pasa a un nombre como «Proceso de las acciones»; «Seguimientos» se mantiene.
- **Entrega 1, hecha:**
  - enlace «← módulo» con el estilo de la aplicación;
  - «Cerrar sesión» como botón de la aplicación;
  - textos internos sustituidos («Hito 6.1», «Hito 9», «4B3», «snapshot»);
  - procedencias antiguas traducidas, sin ofrecerlas al registrar;
  - gris secundario y pastilla «Cancelada» con contraste de al menos 5:1;
  - anillo de foco común;
  - cabecera separada del borde;
  - botones desplegables alineados;
  - rejilla de Configuración alineada;
  - acceso sin menú de módulos;
  - nombre accesible en el buscador de los listados;
  - campos de texto largo con la fuente de la aplicación;
  - sin borde decorativo en la ficha de Devoluciones.
- **Entrega 2, hecha:**
  - **Ventanas modales** («Anular/Reactivar expediente» y «Preparar recordatorio»): el foco entra en la ventana y queda retenido con Tab, Esc la cierra, el foco vuelve al botón que la abrió y el título es su nombre accesible. La confirmación de anular va en rojo sólido.
  - **«Anular expediente»** sigue separado a la izquierda de las acciones (D-111), pero en estilo de texto y más pequeño que la acción principal.
  - **Campos pendientes al guardar:** en lugar del aviso del navegador campo a campo, un resumen en español lista todos los campos pendientes, con un enlace a cada uno, y los marca en el formulario. Se aplica a Desviaciones, CAPA, Cambios, Reclamaciones, Devoluciones y OOS.
    - Las reglas de obligatoriedad y la validación del servidor no cambian.
    - No se desactiva la validación del navegador: Reclamaciones, Devoluciones y OOS aún no devuelven los errores del servidor por campo.
  - **Acción principal de las fichas:** «Editar / seguimiento» en los siete módulos. El borrador de Desviaciones sigue diciendo «Editar borrador».
  - **Audit trail:** hora local de Madrid con la zona (CET/CEST).
    - Los datos se conservan en UTC.
    - La exportación CSV y los filtros de fecha del audit trail global siguen en UTC.
  - **Contadores de los listados:** son totales del módulo, nunca cuentan anulados (tampoco con los filtros «Anulados» o «Todos») y llevan una nota que lo explica. Los borradores se cuentan aparte.
  - **Columna «Control»:** pasa a «Calidad del dato», que es lo que indica (datos importados incompletos o por revisar).
  - **Pestaña de CAPA «Seguimiento de la acción»:** pasa a «Proceso de las acciones». El apartado del formulario, la revisión y el Anexo III conservan el nombre del anexo.
- **Entrega 3, hecha:**
  - **Tipografía Inter incluida en la aplicación** (paquete `@fontsource-variable/inter`, licencia OFL), sin depender de Internet ni de las fuentes del equipo.
  - **Cada dato una sola vez en la pestaña de resumen o información** de Desviaciones, CAPA, Cambios, Reclamaciones, Devoluciones, OOS y Auditorías:
    - La franja de datos clave es el sitio de los datos que muestra. En esa pestaña la cabecera no repite sus datos ni los de las tarjetas, y las tarjetas no repiten los de la franja.
    - En las demás pestañas la cabecera conserva sus etiquetas, porque allí no hay franja.
    - Cuando un dato con comentarios de revisión solo queda en la franja, su ancla y su marca de revisión pasan a la franja: los comentarios guardados siguen enlazados.
    - No se elimina ningún dato de la ficha.
  - **Tablas:** celdas de 13 px, pastillas de 12 px y casillas de selección de 20 px.
  - **Campos de una línea:** altura común de 40 px en filtros y formularios. «Guardar vista» tiene el tamaño de los botones vecinos.
  - **Listados:**
    - el código del expediente tiene el mismo estilo en todos los listados, incluido PNT;
    - la clasificación de Cambios usa los colores de las demás clasificaciones;
    - la paginación es común («N resultados · Página X de Y · 25 por página», con Primera, Anterior, Siguiente y Última) en los ocho listados.
  - **Variables de diseño** de tamaños de letra, radios, altura de campo y colores de estado, aplicadas a lo que toca esta entrega.
  - **Móvil:** los botones no se parten en dos líneas.
  - **Rótulos en mayúsculas:** se quita el rótulo que repetía el título en la tarjeta de información de Cambios. El resto de rótulos de contexto de módulo se mantiene.
- **Repetición de la auditoría (2026-10-20):** 24 hallazgos resueltos, 4 en parte (H-08, H-16, H-22 y H-28), 3 fuera por decisión y 6 nuevos (N-01 a N-06), ninguno crítico ni importante.
- **Entrega 4, hecha (acabado tras la repetición):**
  - **N-01:** el resumen de campos pendientes se agrupa por apartado, con el número de pendientes y un enlace al apartado y a cada campo.
  - **N-02 y H-22:** hasta 1199 px, los botones de cabecera de los listados pasan de fila sin partirse. La barra de módulos se difumina solo cuando no cabe y hasta llegar al final.
  - **N-03:** en móvil, la barra fija de acciones de los formularios muestra «Cancelar» como enlace y los botones de guardar en una fila.
  - **N-04:** «Vencida» del inicio usa el mismo rojo que el vencido de las fichas.
  - **N-05:** el audit trail de la ficha usa la paginación común, tiene un estado vacío compacto y concuerda en singular y plural.
  - **N-06:** los avisos junto a las acciones de la cabecera de la ficha van detrás de los botones.
  - **H-08:** los campos de una línea miden 40 px aunque otro campo de la misma fila tenga ayuda o una etiqueta de dos líneas.
  - **H-16 y H-28** quedan como estaban: las variables se aplican en cada PR que toque estilos, y los rótulos de módulo se mantienen.
- **Correcciones de validación y fechas (2026-10-21), detectadas al revisar los formularios:**
  - **CAPA:** una acción propuesta con datos pero sin descripción ya no se descarta en silencio. El servidor la rechaza con un aviso, también en borrador, para no perder lo escrito. Las filas vacías se siguen ignorando.
  - **Devoluciones:** si se vacía la fecha de próximo seguimiento de una devolución abierta que lo requiere, el servidor lo rechaza aunque haya una fecha guardada.
  - **Errores por campo en Reclamaciones, Devoluciones y OOS:** el servidor asocia cada error a su campo. El resumen del formulario marca el campo y lo enlaza, agrupado por apartado. Solo quedan en el aviso general los errores que no son de un campo. La validación del navegador se mantiene.
  - **Mensajes de Devoluciones:** las comprobaciones se nombran con la etiqueta del formulario, no con su nombre interno.
  - **Audit trail general:** los filtros «Desde» y «Hasta» son días naturales de Madrid. La exportación CSV añade «Fecha (Madrid)» y «Corte (Madrid)» junto a las columnas en UTC, que se conservan; el manifiesto indica las dos zonas.
- **Logotipo de COVEX (2026-10-21):** el logotipo facilitado por el responsable sustituye a la marca provisional «C» en la cabecera (40 px de alto). Va incluido en el build de la aplicación (`src/components/brand/covex-logo.png`) para que también funcione en la imagen Docker. Esto resuelve en parte H-30 (identidad propia), sin rediseñar la cabecera.

## D-118 — PNT: responsables de elaborar, revisar y aprobar, y de la revisión periódica (2026-10-27)

Decisión del responsable de Calidad: poder asignar quién trabaja en cada revisión de un procedimiento y que aparezca en «Mis tareas» (D-102).

- **Por función.** Cada revisión en elaboración, en revisión o pendiente de aprobación tiene tres responsables: Elabora, Revisa y Aprueba (las funciones de GC-00/001/03). Cada uno con texto libre, usuario de la aplicación opcional y fecha prevista, como D-101.
- **Revisión periódica en el maestro.** Cada PNT tiene un responsable de la revisión periódica (texto libre y usuario).
- **Dónde se asigna.** Botón «Asignar responsables» en la pestaña Revisiones de la ficha, con permiso de edición y si el maestro no está anulado. Una sola pantalla para el maestro y para las revisiones que admiten asignación. Al elegir un usuario sin escribir el nombre, se guarda su nombre. Cada cambio queda en el historial operativo del PNT y en la captura del audit trail (B2).
- **Qué cuenta como pendiente en «Mis tareas» y en el filtro «Asignadas a mí» del listado de PNT** (regla compartida en `src/lib/qms/assigned.ts`):
  - la función solo cuenta en su fase: Elabora con la revisión en borrador, Revisa en revisión y Aprueba pendiente de aprobación. La fecha prevista de la función decide si está vencida o próxima;
  - la revisión periódica cuenta cuando la revisión vigente está vencida o vence en 30 días (fecha efectiva, la del ciclo de vida si existe) y no hay otra revisión en elaboración, revisión, aprobación o aprobada pendiente de vigencia;
  - nunca en un PNT anulado. Los PNT no tienen año: en el panel solo se filtran por departamento.
- **Límites.** Es una ayuda para repartir el trabajo. No registra quién elaboró, revisó o aprobó (eso sigue en el documento aprobado fuera de la aplicación), no cambia el estado de la revisión, no es firma electrónica ni aprobación GMP y no envía avisos. Las revisiones vigentes, obsoletas o anuladas no admiten cambios de responsables.

## D-119 — Revisión por un agente independiente antes de fusionar cada PR (2026-10-28)

Decisión del responsable de Calidad: cada PR pasa, antes de fusionarse, por un agente revisor independiente (contexto nuevo, sin el razonamiento de quien lo implementó), además de la CI.

- Revisa el diff completo contra el código y `/docs`: errores de funcionamiento, permisos y seguridad, migraciones y captura del audit trail, pruebas que falten y desviaciones de las decisiones y de `AGENTS.md`.
- Los hallazgos críticos o importantes se corrigen antes de fusionar, con una prueba que falle antes del arreglo cuando sea comprobable con una prueba (si no, se justifica en la PR). Los menores o descartados se explican en la PR, cuya descripción resume el resultado.
- Es un control de desarrollo: no sustituye a la revisión humana ni a la validación GMP.

## D-120 — Calendario de vencimientos (2026-10-29)

Decisión del responsable de Calidad: ver en un calendario los plazos de todos los módulos.

- **Página «Calendario»** (`/calendar`), con vista de mes o de semana, anterior, siguiente y «Hoy». Se llega desde el inicio: «Ver calendario» en los plazos del panel y «Ver en el calendario» en «Mis tareas». No se añade al menú principal.
- **Qué aparece con «Todos los plazos»:**
  - las mismas fuentes que los plazos del panel y las alertas:
    - próximo seguimiento de desviaciones, CAPA, cambios, reclamaciones y devoluciones;
    - ejecución prevista de cambios;
    - próxima revisión de auditorías y hallazgos;
    - revisión de la revisión vigente de cada PNT (el ciclo de vida manda si existe);
  - las auditorías planificadas aún no realizadas;
  - las acciones pendientes con fecha prevista de cualquier responsable (también las que aún no tienen), con la misma regla de pendiente que «Mis tareas» (D-102 y D-118).

  El calendario muestra las fechas aunque su regla de alerta esté desactivada: las reglas deciden qué se avisa en el panel, no qué fechas existen. La eficacia CAPA pendiente, cuya fecha depende de la antelación configurada en su regla, no aparece.
- **«Solo mis tareas»:** exactamente «Mis tareas» con fecha. Indica cuántas no tienen fecha y cuántas vencieron antes del periodo.
- **Filtros:** área (módulo), departamento y vista. Lo vencido se marca en rojo y con la palabra «Vencida».
- **No guarda nada:** solo lee. Mismos permisos de consulta que el panel. En móvil se muestra como lista por días. El recuento incluye los días de los meses vecinos que se ven en la cuadrícula.

## D-121 — Vista previa de PDF e imágenes sin descargar (2026-10-29)

Decisión del responsable de Calidad: ver los archivos sin descargarlos, con la solución más sencilla.

- **Botón «Ver»** junto a la descarga. Abre el archivo en una pestaña nueva del navegador. Aparece en:
  - las evidencias adjuntas de los seis expedientes;
  - los PDF firmados de Desviaciones, CAPA, Cambios, Reclamaciones, Devoluciones (Anexos III y V), OOS y Auditorías;
  - los archivos históricos de Devoluciones;
  - los documentos recibidos de Auditorías.
- **Solo PDF, PNG y JPG.** Word y Excel se siguen descargando: el navegador no los muestra y convertirlos exigiría instalar un conversor en el servidor.
- **Misma ruta y mismos permisos que la descarga.** La vista previa añade `?preview=1` y la ruta responde «en línea» solo si el tipo guardado del archivo es PDF o imagen. Se mantienen las mismas comprobaciones que la descarga de cada ruta (permiso de descargar y, donde la ruta la hace, la huella SHA-256), y todas las rutas cambiadas envían `nosniff`.
- No cambia ningún dato ni plantilla.

## D-122 — Modelos de Control de cambios (2026-10-29)

Decisión del responsable de Calidad: empezar los Controles de cambios habituales desde un caso tipo.

- **Configuración → Modelos de cambio.** Calidad crea y edita modelos con permiso de gestionar la configuración. Cada modelo tiene:
  - nombre, «cuándo usarlo» y estado (activo o inactivo);
  - lo que prerrellena: departamento, alcance (y «Otros»), textos guía de descripción, justificación y documentos aportados, y las acciones habituales del plan de ejecución (una por línea, sin responsable ni fecha).
- **«Partir de un modelo»** en el alta de un Control de cambios. El formulario sale prerrellenado y todo se puede cambiar. No se guarda nada hasta pulsar Guardar.
- **Nunca prerrellena:** fechas, código, solicitante, decisión de la solicitud, evaluación, clasificación, implicaciones, resultado del Dictamen ni seguimiento. Son datos de cada caso.
- **Trazabilidad:**
  - el historial de alta del cambio indica «desde el modelo X (versión N)», con la versión que se usó al prerrellenar;
  - cada cambio de un modelo sube su versión y queda en el historial de configuración (identificado por el id del modelo, no por su nombre) y en la captura del audit trail, como las reglas de alerta;
  - los nombres no se repiten (sin distinguir mayúsculas);
  - un departamento desactivado no se puede elegir, pero el modelo que ya lo tenía lo conserva al editarse;
  - los modelos no se borran, se desactivan;
  - cambiar un modelo no modifica los expedientes ya creados.
- Solo Controles de cambios. Otros módulos, si se piden, en una PR propia.

## D-123 — Herramientas de investigación guiadas en Desviaciones (2026-10-29)

Decisión del responsable de Calidad: ayudar a ordenar la investigación de una desviación con 5 porqués, Ishikawa (6M) y brainstorming. No hay anexo del PNT para estas herramientas, así que se trabajan dentro del formulario.

- **Dónde:** en «E. Investigación» del formulario de Desviaciones, en un desplegable opcional «Herramientas de análisis». La ficha las muestra en solo lectura dentro de «Investigación».
- **Se elige la herramienta.** Al abrir el desplegable se pulsa «5 porqués», «Ishikawa (6M)» o «Brainstorming» y solo se muestra la elegida; se puede añadir otra cuando se quiera. Una herramienta con contenido se muestra siempre y no se puede ocultar, para no esconder trabajo hecho. La elección no marca «Metodología empleada»: se marca al usar una causa como causa raíz o a mano.
- **Qué contienen:**
  - 5 porqués: problema y hasta cinco «¿por qué?», con el estado de la cadena; cada porqué conserva su número y solo se quitan los huecos del final;
  - Ishikawa: causas posibles agrupadas por las 6M (sin «No determinada»);
  - brainstorming: ideas con categoría 6M opcional;
  - cada causa con evidencia o comprobación (opcional) y estado.
- **Hipótesis frente a confirmada.** Cada causa es una hipótesis hasta que quien investiga la marca como descartada o confirmada. La aplicación no cambia estados ni propone causas: sin IA.
- **«Usar como causa raíz»** solo está disponible para una causa confirmada (o el último porqué de una cadena confirmada). Con un clic copia el texto a «Causa raíz» sin duplicarlo y marca su categoría 6M y la metodología. No guarda nada: se revisa la redacción y se guarda como siempre.
- **No cambia el Anexo III.** Las herramientas no se imprimen; la causa raíz, la categoría y la metodología siguen siendo los campos de siempre. *Sustituido por D-124: desde entonces se imprimen en la casilla de causa raíz.*
- **Trazabilidad:**
  - se guardan con el expediente (campo `investigationTools`), en sus versiones y en el historial de modificaciones;
  - la captura B2 las registra como un campo JSON no crítico;
  - guardar sin tocarlas no las anota como cambio.
- **Validación en servidor:**
  - estados y herramientas cerrados;
  - categoría 6M obligatoria en Ishikawa;
  - hasta 60 causas y 5 porqués;
  - 1000 caracteres por texto.

  Un valor no válido bloquea el guardado, también en borrador, y el formulario conserva lo escrito para corregirlo.
- Solo Desviaciones. Otros módulos, si se piden, en una PR propia.

## D-124 — FTA y herramientas de investigación en el Anexo III de Desviaciones (2026-10-30)

Decisión del responsable de Calidad, que completa D-123.

- **FTA (árbol de fallos) como cuarta herramienta.**
  - Un evento principal (el fallo) y sus causas en esquema con sangrías, hasta 4 niveles.
  - En una causa con causas debajo se indica si basta una (O) o hacen falta todas a la vez (Y).
  - Cada causa tiene evidencia y estado (hipótesis, descartada o confirmada), como el resto.
  - Solo una causa final (sin causas debajo) y confirmada se puede usar como causa raíz; marca la casilla «FTA» de la metodología, que ya existe en la plantilla.
  - Quitar una causa quita también las que cuelgan de ella.
- **Las herramientas se imprimen en el Anexo III.** En la casilla «Análisis de causa raíz» (apartado G) va primero la causa raíz redactada, como hasta ahora, y debajo el análisis de **todas** las herramientas usadas:
  - 5 porqués: problema y cada porqué, con el estado de la cadena;
  - Ishikawa: las causas por categoría 6M;
  - brainstorming: las ideas, con su categoría si la tienen;
  - FTA: el evento principal y el esquema con sangrías y la relación O/Y.

  Cada causa sale con su estado y su evidencia, también las descartadas, porque muestran qué se comprobó y se excluyó.
- **Se cumplimenta la plantilla, no se cambia.** Es texto en la casilla existente, con el formato de valor de siempre; la plantilla v06 no se modifica. Comprobado generando el anexo con la plantilla v06.
- El anexo de cada versión imprime las herramientas de esa versión. Sin herramientas, la casilla queda como antes (solo la causa raíz). Un anexo de una versión anterior a D-124 que ya tenía herramientas (D-123) se genera ahora con ellas, así que puede no coincidir con la copia descargada entonces; la copia firmada de referencia es la que se adjuntó.
- En el anexo cada causa ocupa una línea: los saltos de línea dentro de una causa se convierten en espacios, y se quitan los caracteres de control.
- Una causa del FTA en blanco con causas debajo bloquea el guardado («Cada causa necesita una descripción»); solo se descartan las causas finales en blanco.
- No hay cambios de base de datos: el FTA va en el mismo campo `investigationTools`, que ya captura B2.

## D-125 — Figuras en los apartados de Desviaciones (2026-10-30)

Decisión del responsable de Calidad: poder poner imágenes junto al texto de una desviación sin convertir los campos en un editor de texto enriquecido (opción B) y con una hoja de figuras al final del Anexo III.

- **Dónde:** en los apartados C (Descripción del evento), D (Acción inmediata), E (Investigación), F-G (Causa raíz), I (Impacto) y K-L (Conclusión y cierre) del formulario de edición. En el alta no: se añaden una vez creada la desviación.
- **Cómo:** se pega una imagen (Ctrl+V) en cualquier punto del apartado, se arrastra o se elige un archivo; se describe («Qué muestra la figura») y se guarda con **«Adjuntar figura»**. Es una acción explícita aparte del botón Guardar: no guarda el resto del formulario ni se pierde lo escrito.
- **Qué se guarda:** cada figura es una **evidencia** del expediente (D-096): inalterable, con SHA-256, sin sustituir ni borrar, en el historial y en la pestaña Evidencias, con el apartado al que ilustra. Mismo permiso que adjuntar evidencias.
- **Privacidad:** el navegador vuelve a dibujar la imagen antes de enviarla: respeta la orientación, la limita a 2400 px de lado y quita los metadatos (ubicación, cámara…). Las capturas quedan en PNG y las fotos en JPEG. Si la imagen original es prueba por sí misma, se adjunta además en Evidencias, que la conserva tal cual.
- **Numeración:** «Figura 1, 2…» por orden de alta en todo el expediente; no cambia porque las evidencias no se borran. En el texto se puede citar («ver figura 2»).
- **Ficha:** cada apartado de la pestaña «Desviación» muestra sus figuras en miniatura; cada una abre la imagen.
- **Anexo III:** las casillas de la plantilla no llevan imágenes. Tras la última página se añade una hoja **«Figuras del expediente …»** con cada figura ajustada a la página y su pie («Figura N. Apartado: descripción»). La plantilla no se modifica: la hoja va después de su contenido y conserva la cabecera y el pie. El anexo de una versión congelada incluye solo las figuras que existían entonces. Comprobado con la plantilla v06.
- No hay cambios de base de datos: el apartado va en los metadatos de la evidencia.
- Solo Desviaciones. Otros módulos, si se piden, en una PR propia.

## D-126 — Viñetas en los textos largos de Desviaciones y Controles de cambios (2026-10-30)

Decisión del responsable de Calidad: poder escribir listas de puntos en los textos largos (por ejemplo, los hechos de una investigación). Es la primera parte de la propuesta de tablas (opción B, tablas dentro de la casilla del anexo), que irá en una PR propia.

- **Dónde:** todos los campos de texto largo de Desviaciones (descripción del evento, investigación, causa raíz, recurrencia, detalle de impacto, conclusión, disposición, observaciones…) y de Controles de cambios (descripción, justificación, documentos aportados, evaluación, observaciones del dictamen…).
- **Cómo:** el botón **«• Viñetas»**, junto a la etiqueta del campo, pone o quita la viñeta en las líneas seleccionadas (o en la del cursor). Intro dentro de una viñeta crea la siguiente; Intro en una viñeta vacía termina la lista; Mayúsculas+Intro hace un salto de línea normal. Se puede deshacer con Ctrl+Z.
- **Qué se guarda:** texto normal, con «• » al principio de cada viñeta. No hay cambios de base de datos y el buscador, el historial de modificaciones y las versiones funcionan igual. Los textos existentes no cambian: una línea que empieza por «-» se queda como está.
- **Ficha:** las viñetas se muestran como lista; un texto sin viñetas se ve igual que antes.
- **Anexos Word:** cada viñeta es un párrafo con sangría francesa (el texto que pasa de línea queda alineado bajo el texto, no bajo el punto), en Arial 11 como el resto de datos. Se aplica en el escritor común de las casillas, así que cualquier línea que empiece por «• » sale igual en todos los anexos. La plantilla no cambia. Comprobado con el Anexo III v06.

