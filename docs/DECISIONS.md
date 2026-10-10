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
