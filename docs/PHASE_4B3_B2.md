# Fase 4B3-B2 — integración transversal, trabajo en curso

Base verificada: main `70d6a1348a93a9dd51d9beb75a32e2014f375ed3`, B1 / #142 integrado. Rama única `feature/phase4b3-b2-qms-audit-integration`; checkout existente, sin worktrees. Referencias: [4B3-A](PHASE_4B3_A.md), [B1](PHASE_4B3_B1.md), [4B2](PHASE_4B2.md), [4B1](PHASE_4B1.md), [DECISIONS](DECISIONS.md) e inventario de autorización 4B1.

**Estado de este corte: motor SQL, configuración y alta/edición en borrador mediante las acciones originales de los siete módulos; no entrega B2 completa.** Se conserva el requisito durable. OLD/NEW, testigo independiente, cobertura diferida, 13 acciones reales de configuración y las acciones originales de alta/edición se prueban en PostgreSQL aislado. El RPC sigue limitado a bases efímeras; ninguna política corporativa está preparada/activada. Faltan otros escenarios de negocio, transversales, custodia D05 y regresión integral. No se ha demostrado cobertura completa de las 63 operaciones ni se abre la PR de entrega. El nuevo encargo autoriza terminar B2 y C conjuntamente, en esta rama y una única PR final, tras un checkpoint técnico interno satisfactorio de B2 (D-082).

## 1. Integración inicial

Se conserva la atomicidad probada de configuración e historial y se añade un sobre SQL a sus 13 acciones cuando existe requisito durable. Una instalación sin requisito mantiene la composición anterior; con requisito no existe fallback si falla captura/protección. Las activaciones incluyen las retiradas anteriores y el historial en una sola transacción. No se cambian ciclos, codificación ni matriz de permisos.

### Continuación desde `3982220`: composición de acciones

La migración aditiva `20261013000400_b2_command_composition` conserva las publicadas. Añade `AuditCommandResult`, inmutable y sin escritura directa del rol operativo, y resultado/permisos transitorios en el contexto privado. Las respuestas exitosas y redirecciones locales se conservan para reintentos; no se almacenan formularios enviados, credenciales ni bytes en esos recibos. Un resultado de error de la acción aborta la transacción, conservando el estado de formulario; una redirección Next se emite después del commit. Las transacciones nativas por callback se componen **solo** en el sobre explícito B2: arrays anidados o aislamiento incompatible se rechazan; Auditorías/PNT usan un sobre SERIALIZABLE. El API ordinario permanece intacto fuera de esa composición.

Las autorizaciones adicionales efectivamente comprobadas por 4B1 se conservan como claims de servidor y se revalidan en PostgreSQL al finalizar y al recuperar un recibo. Se bloquean las filas observadas de autorización, sin nuevos permisos para el rol de aplicación. BEFORE comprueba el ámbito anterior real antes de cambios de departamento/relación, además del ámbito final y el testigo diferido. Sigue pendiente ampliar escenarios y probar las rutas/servicios transversales originales.

Las pruebas focalizadas pasan **183 casos / 13 archivos**, TypeScript sin errores, lint focalizado y **26 pruebas operativas de backup**. El smoke PostgreSQL conserva todas las negativas del motor y B1; añade **11 casos de acciones originales**, incluidos alta/edición en borrador de los siete módulos, consulta sin modificación para lector, identidad, OLD/NEW, FKs a historial, recibos y rollback completo de padres/hijos/versiones/journal ante fallo de historial **o de persistencia de eventos capturados**. Se demuestra conservación íntegra de motivos mayores de500 caracteres: B2 admite hasta20000 sin truncarlos; el piloto B1 conserva su límite500. La consulta mutable de hilos Review se recarga después del commit, sin copiarla completa al recibo. Pasa también la regresión HTTP/OIDC completa4B1 con instancia local y DB nuevas. Estos casos no acreditan todavía todos los ciclos de cada módulo ni el checkpoint completo B2. Evidencias locales: `/tmp/covex-b2-compose-verified-focal.log`, `/tmp/covex-b2-compose-verified-types.log`, `/tmp/covex-b2-compose-backup-tests.log`, `/tmp/covex-b2-compose-pg11.log`, `/tmp/covex-b2-compose-auth.log`.

Defecto previo demostrado por la acción original: actualización de Controles de Cambios ejecutaba `redirect` dentro del `try` de persistencia; el `catch` absorbía la señal y devolvía error después del guardado. Se mueve la navegación fuera del bloque, manteniendo su destino y reglas. Los motivos SQL de rectificación crítica se traducen a error inline sin imprimir diagnósticos. Los formularios hidratados conservan nonce de envío explícito para un mismo contenido y generan uno nuevo al cambiarlo; antes de hidratación el servidor conserva su fallback por petición, sin prometer idempotencia de red de ese caso.

El contrato `audit-contract-b2-integration.json` añade protección del recibo y funciones nuevas; preflight y backup reconocen el release y rechazan pérdida de su tabla cuando la migración consta instalada. Docker/grants candidatos incluyen el nuevo contrato. La prueba Docker/recuperación completa debe repetirse sobre el checkpoint B2 y SHA final; no se hereda como evidencia la del contenedor construido sobre `3982220`.

### Continuación transversal desde `ee3644f`

Se componen los servicios originales `administerUser`/`configureRole`, las acciones Review y las rutas JSON/multipart originales de anulación/reactivación QMS, documentación PNT, lifecycle y estado manual. Las rutas devuelven su respuesta después del commit; respuestas de fallo revierten y los recibos conservan status/headers/body JSON, sin cookies ni documentos binarios. No se envuelve indiscriminadamente importación, descarga ni caducidad técnica: conservan una integración pendiente propia.

El smoke PostgreSQL incluye **15 casos de acciones/rutas originales**: los11 anteriores más admisión/propuesta de política, Review completo, anulación/reactivación por API y PNT documental/estado manual por API. Se prueban el lector, actor UUID, eventos/evidencia reales, reintentos, bloqueo tras resolver un hilo y rollback de la autorización si falla su historial. Una propuesta de política permanece sin aceptación; Review no concede aprobación GMP. PNT conserva PDF original y usa la composición SERIALIZABLE de sus servicios. `lifecycle` completo, importaciones y los demás escenarios de la matriz siguen pendientes.

Las comprobaciones opcionales de capacidades visuales no se convierten en permisos obligatorios de la operación. Los guards y `requireDocumentWrite`/`requireLifecyclePermission` registran las autorizaciones utilizadas; las sondas de presentación solamente devuelven capacidades. La matriz y lectura global4B1 se conservan. Pasan **189 pruebas focalizadas / 14 archivos**, TypeScript y lint focalizado; evidencia `/tmp/covex-b2-transversal-verified-{unit,types,lint}.log` y `/tmp/covex-b2-routes-pg.log`. La política del release SQL publicado se lee desde su migración inmutable, evitando que nuevas columnas Prisma reescriban retrospectivamente su hash/SQL; pruebas de reconciliación B1/B2 preservadas.

## 2. Criterios funcionales confirmados por el proyecto

D01 modelo híbrido; D02 cobertura de cambios persistidos relevantes, incluidos borradores; D03 **opción B**, sin motivo adicional en todos los guardados y con uno por operación cuando corresponda; D04 sin reconstrucción ni retroatribución; D05 **opción A**, distinguir Word de trabajo de documentos formales y conservar originales sustituidos; D07 atomicidad de negocio/historial/auditoría/evidencia; D08 reutilizar protección B1 y declarar límite DBA. Estos criterios fueron autorizados para el diseño B2, no constituyen una URS ni aceptación regulatoria.

## 3. Aceptación QA/DT/IT

Formalización del uso previsto, clasificación y riesgo residual, custodia externa/checkpoints, retención, responsabilidades, corte y liberación siguen pendientes de QA/DT/IT. No se registran aprobaciones ficticias, firmas ni permisos reales. No se requiere aprobación de cada commit interno dentro del alcance autorizado.

## 4. Arquitectura inicial aplicada

`transaction-context.ts` conserva AsyncLocalStorage. `inDatabaseTransaction` vincula el sobre B2 y rechaza una transacción independiente anidada. Los tres bloques internos de configuración reutilizan `withDatabaseTransaction`. La continuación §1 añade `inBusinessTransaction` para componer explícitamente callbacks nativos bajo B2, con control del aislamiento y rechazo de arrays anidados. Fuera del sobre no se intercepta ese API. Los clientes independientes y las importaciones por fila siguen requiriendo adaptación. La captura ocurre en PostgreSQL, independientemente de delegates Prisma.

La migración aditiva `20261013000300_b2_sql_capture` incorpora políticas fijas de tablas/campos, contexto privado, testigos transitorios y raíces administrativas tipadas. Un cambio de relación produce un evento por campo y enlaces a ambas raíces. Los cinco historiales operativos se enlazan mediante `AuditOperationEvidence` con FKs específicas; no se copian sus snapshots al journal ni se emite un evento de negocio por el mero INSERT del historial. Los originales binarios siguen fuera de los eventos.

## 5. Inventario y matriz de operaciones

`scripts/audit-writer-inventory.ts` inspecciona código estático, nunca ejecuta escrituras ni consulta bases. En la base B1 identifica **279 llamadas explícitas en 49 archivos**, frente a 277/48 de 4B3-A: las dos llamadas del adaptador piloto B1 y su archivo adicional explican esa diferencia. Añade 12 escrituras anidadas visibles, 42 candidatos SQL —incluidos SELECT con efectos posibles— y seis lugares con clientes independientes. Excluye tests, smokes, fixtures, benchmarks y seed demo.

`writer-inventory.json` conserva localizador/función/delegate/método, claves estructurales, nested writes visibles y hashes de fuente. Tras incorporar el estado/protección del requisito existen46 candidatos SQL; las llamadas de negocio siguen siendo279/49. No contiene valores, sentencias SQL, archivos de entrada ni datos personales. Los argumentos dinámicos, alias y escrituras detrás de helpers siguen requiriendo revisión manual; AST no acredita cobertura ni atomicidad.

`scripts/audit-policy-catalog.ts` reconcilia los 63 IDs y W01–W22 de A con fuentes/escritores reales. `policy-catalog.json` contiene candidatos y criticidad **propuesta**, no campos aprobados ni catálogo SQL activo. Los campos candidatos se normalizan por modelo; bytes, campos de secretos y modelos de sesión/login/journal quedan fuera. Los índices de writers referencian el inventario versionado. Cada fila mantiene `NOT_DEMONSTRATED`, campos auditados/captura/evidencias vacíos hasta su integración y prueba real.

Hay 58 filas de escritura de negocio, dos de canal técnico separado (PN07/TR06), una de mantenimiento dependiente de IT (TR08), una de consulta sin nueva emisión (PN08) y una diferida a C (TR09). El inventario actual mantiene279 llamadas/49 archivos, 50 candidatos SQL y seis clientes independientes. Las políticas SQL compiladas no sustituyen la demostración por writer/operación. La matriz continúa con `NOT_DEMONSTRATED` hasta completar sus escenarios y dependencias, aunque configuración ya tiene pruebas parciales reales.

| ID | Operación de referencia | Writers candidatos | Captura SQL B2 / prueba |
| --- | --- | --- | --- |
| DV01 | Alta / apertura | W01, W14 | BUSINESS_WRITE; no demostrada |
| DV02 | Campos de evento, producto, lote, fechas y responsables | W01 | BUSINESS_WRITE; no demostrada |
| DV03 | Investigación, causa raíz e impacto | W01 | BUSINESS_WRITE; no demostrada |
| DV04 | Clasificación / decisión CAPA / planes e inmediatas | W01 | BUSINESS_WRITE; no demostrada |
| DV05 | Seguimiento | W01 | BUSINESS_WRITE; no demostrada |
| DV06 | Cierre / reapertura existente / nueva versión | W01, W14 | BUSINESS_WRITE; no demostrada |
| DV07 | Anulación / reactivación administrativa | W01, W12 | BUSINESS_WRITE; no demostrada |
| DV08 | Relaciones, anexos y PDF recibido/sustituido | W01, W12, W15, W16 | BUSINESS_WRITE; no demostrada |
| CA01 | Alta / apertura / procedencia | W02, W12, W14 | BUSINESS_WRITE; no demostrada |
| CA02 | Defecto, causa raíz, alcance y clasificación | W02 | BUSINESS_WRITE; no demostrada |
| CA03 | Acciones/responsables/plazos y retirada de hijos | W02 | BUSINESS_WRITE; no demostrada |
| CA04 | Seguimiento / ejecución / evidencia | W02 | BUSINESS_WRITE; no demostrada |
| CA05 | Criterios, evaluación, resultado de eficacia | W02 | BUSINESS_WRITE; no demostrada |
| CA06 | Cierre operativo/efectivo y cambios posteriores permitidos | W02, W14 | BUSINESS_WRITE; no demostrada |
| CA07 | Anulación/reactivación y relaciones/orígenes | W02, W12 | BUSINESS_WRITE; no demostrada |
| CA08 | Anexo / PDF recibido o sustituido | W02, W15, W16 | BUSINESS_WRITE; no demostrada |
| CC01 | Alta/apertura | W03, W14 | BUSINESS_WRITE; no demostrada |
| CC02 | Solicitud, clasificación, impacto, investigación y dictamen | W03 | BUSINESS_WRITE; no demostrada |
| CC03 | Tareas / responsables / fechas | W03 | BUSINESS_WRITE; no demostrada |
| CC04 | Alta/edición de seguimiento y estados de tareas | W03 | BUSINESS_WRITE; no demostrada |
| CC05 | Cierre / estado derivado por seguimiento permitido | W03 | BUSINESS_WRITE; no demostrada |
| CC06 | Anulación/reactivación / relaciones | W03, W12 | BUSINESS_WRITE; no demostrada |
| CC07 | Emisión/revisión anexos III/IV/V y PDF | W03, W14, W15, W16 | BUSINESS_WRITE; no demostrada |
| RC01 | Alta/apertura/tipo y producto-lote | W04, W14 | BUSINESS_WRITE; no demostrada |
| RC02 | Investigación, causa, clasificación, impacto y resolución | W04 | BUSINESS_WRITE; no demostrada |
| RC03 | Acciones derivadas / planes CAPA | W04 | BUSINESS_WRITE; no demostrada |
| RC04 | Seguimiento | W04 | BUSINESS_WRITE; no demostrada |
| RC05 | Cierre/reapertura/nueva versión existentes | W04, W14 | BUSINESS_WRITE; no demostrada |
| RC06 | Anulación/reactivación / vínculos a devolución/CAPA | W04, W12 | BUSINESS_WRITE; no demostrada |
| RC07 | Anexos III/IV y PDF sustituido | W04, W15, W16 | BUSINESS_WRITE; no demostrada |
| DE01 | Alta/apertura/tipo | W05, W14 | BUSINESS_WRITE; no demostrada |
| DE02 | Producto, lote, cantidades, análisis y disposición | W05 | BUSINESS_WRITE; no demostrada |
| DE03 | Clasificación y evaluación/investigación existentes | W05 | BUSINESS_WRITE; no demostrada |
| DE04 | Seguimiento | W05 | BUSINESS_WRITE; no demostrada |
| DE05 | Estado/cierre y modificaciones posteriores hoy permitidas | W05, W14 | BUSINESS_WRITE; no demostrada |
| DE06 | Anulación/reactivación / reclamación vinculada | W05, W12 | BUSINESS_WRITE; no demostrada |
| DE07 | Anexos por producto y PDF/archivo previo | W05, W15, W16 | BUSINESS_WRITE; no demostrada |
| AU01 | Alta/apertura/tipo/escenario/áreas/equipo | W06 | BUSINESS_WRITE; no demostrada |
| AU02 | Hallazgos, criticidad, evidencia, tratamiento | W06 | BUSINESS_WRITE; no demostrada |
| AU03 | Acciones, verificación y retirada de hallazgo/acción | W06 | BUSINESS_WRITE; no demostrada |
| AU04 | Seguimientos generales/hallazgo, edición existente | W06 | BUSINESS_WRITE; no demostrada |
| AU05 | Relaciones y atribución a hallazgos | W06, W12 | BUSINESS_WRITE; no demostrada |
| AU06 | Emisión/revisión informe / documentos / acta externa | W06, W14, W16 | BUSINESS_WRITE; no demostrada |
| AU07 | Cierre normal/excepción existente / anulación-reactivación | W06, W12, W14 | BUSINESS_WRITE; no demostrada |
| AU08 | Plan anual y entradas / responsables nominales | W06, W07 | BUSINESS_WRITE; no demostrada |
| AU09 | Programa anual / emisión 00/01+ | W06, W07 | BUSINESS_WRITE; no demostrada |
| PN01 | Maestro / registro y edición de revisión permitida | W08 | BUSINESS_WRITE; no demostrada |
| PN02 | Verificación y evidencia externa / contraste existente | W08, W09 | BUSINESS_WRITE; no demostrada |
| PN03 | Activación explícita / retirada automática anterior | W08, W09 | BUSINESS_WRITE; no demostrada |
| PN04 | Retirada/anulación / rectificación / estado manual | W08, W09 | BUSINESS_WRITE; no demostrada |
| PN05 | Incorporación/sustitución documental | W08, W10 | BUSINESS_WRITE; no demostrada |
| PN06 | Importación de índice, conciliación, confirmación | W08, W11 | BUSINESS_WRITE; no demostrada |
| PN07 | Caducidad de staging / borrado pendiente desde lectura | W08, W11 | TECHNICAL_SEPARATE_STREAM; no demostrada |
| PN08 | Descarga de objeto histórico | W08, W10 | READ_NO_BUSINESS_EVENT; no demostrada |
| TR01 | Review: alta, respuesta, aceptación/resolución | W13 | BUSINESS_WRITE; no demostrada |
| TR02 | Catálogos/departamentos/parámetros/alertas | W17 | BUSINESS_WRITE; acciones reales probadas, matriz completa pendiente |
| TR03 | FormVersion/FormFieldConfig: clonar/editar/activar/retirar | W17 | BUSINESS_WRITE; clonación/campos/activación y retiradas probadas, matriz completa pendiente |
| TR04 | Plantillas: registro/instalación/activación/retirada | W17, W21 | BUSINESS_WRITE; registro/activación probados; scripts/custodia pendientes |
| TR05 | Admisión/baja/roles/ámbitos/política y aceptación administrativa existente | W18 | BUSINESS_WRITE; no demostrada |
| TR06 | Login/logout/denegaciones/caducidad | W19 | TECHNICAL_SEPARATE_STREAM; no demostrada |
| TR07 | Importar históricos / backfill controlado | W20 | BUSINESS_WRITE; no demostrada |
| TR08 | Cambio directo DB / mantenimiento / restauración | W22 | CONTROLLED_MAINTENANCE_IT_DEPENDENCY; no demostrada |
| TR09 | Archivo/exportación/revisión del futuro journal | C, sin writer B2 | DEFERRED_C; no demostrada |

## 6. Motivos

La preparación SQL distingue primera incorporación de contenido crítico, rectificación de contenido establecido y borradores. Se prueba investigación de Desviación: primera incorporación sin motivo, corrección posterior rechazada sin motivo y aceptada con justificación; borrador sin obligación adicional. Configuración conserva su campo `reason`: cambios administrativos de etiquetas/formato/alertas no añaden obligación genérica; activación/retirada oficial y cambio del parámetro existente `ALLOW_CLOSED_RECORD_EDIT` exigen motivo. La política completa de los demás campos, decisiones, borrados/recreación de hijos equivalentes y motivos/errores inline de módulos sigue pendiente. No hay motivos autogenerados nuevos.

## 7. Borradores

Se prueba creación de expediente/niños anidados y edición de contenido previamente persistido en borrador sin motivo adicional. Los escenarios completos de borrador/apertura y sus escritores originales todavía necesitan integración; no se modifican sus reglas funcionales.

## 8. Custodia híbrida

Pendiente de integración: conservar PDFs originales/supersesión para todos los módulos donde `RecordVersionDocument.upsert.update` reemplaza bytes. Preservar PNT y programas/informes existentes y la distinción Word de trabajo/emisión formal. En contextos de ensayo requeridos se valida checksum contra bytes reales y se bloquea sobrescribir un original hasta disponer de custodia D05; una instalación sin requisito no cambia el comportamiento anterior. Esta denegación provisional no se presenta como custodia terminada. No se regeneran originales perdidos ni se reconstruyen históricos.

## 9. Modelos y migraciones

Se conserva intacta `20261013000200_b2_audit_requirement`. La siguiente migración aditiva añade siete objetos de captura/correlación y enlaces tipados a evidencias operativas, manteniendo las anteriores. `AuditOperation` admite motivo NULL para D03, schemaVersion2 para B2 y la identidad del módulo/permiso seleccionado; B1 conserva schemaVersion1 y su motivo obligatorio. El cursor incorpora una FK administrativa con CHECK excluyente. **No se inserta aprobación, requisito ni activación por instalar.** Solo se migra en bases efímeras propias.

## 10. PostgreSQL

La captura/cobertura diferida B1 conserva su piloto aislado. La preparación B2 instala guardas INSERT/UPDATE/DELETE y de TRUNCATE en66 tablas. Cuando el propietario/migrador controlado registra el requisito mediante `covex_b2_require_policy`, se deniegan esas escrituras porque todavía no existe política preparada/activa. El rol operativo no ejecuta ese RPC ni inserta, modifica, elimina o trunca el requisito; un GUC de desactivación no lo sustituye. Incluso el propietario encuentra triggers contra su retirada ordinaria, manteniendo el límite DBA de poder alterar protección.

Los perfiles Entra de usuarios aún no admitidos y refrescos sin cambio de autorización siguen siendo técnicos; sesiones/intentos no están en esta política. Un marcador PNT ERROR solo admite la categoría reducida existente, sin payload adicional. En bases sintéticas, el historial del piloto B1 exige su lease/operación/raíz reales, no basta el nombre del campo. No se inventan eventos GMP para esos controles.

El contrato anterior B1 y el de requisito B2 siguen disponibles. `audit-contract-b2-capture.json` añade el contrato de captura: **15 tablas protegidas, 26 funciones y290 triggers**, con hash de políticas/campos además de body/search_path/owner/PUBLIC/tipo/diferimiento. Los roles operativos tampoco leen las leases privadas.

BEFORE guarda identidad/raíces y un testigo independiente; AFTER captura OLD/NEW reales y otro AFTER calcula la expectativa. Al commit se cotejan exactamente campos, valores, entidades y raíces de cada mutación: omitir captura o testigo, falsear OLD o perder contexto revierte todo. Los valores DATE/INSTANT/JSON/enteros conservan tipo; snapshots/procedencia JSON se referencian por hash, bytes/secretos no se copian. El contexto se elimina al commit y se exige vacío en backup. Captura sin cambio relevante no crea operación/secuencia; historial operativo de noop se conserva sin un falso evento de negocio.

`covex_b2_begin` continúa limitado a `covex_phase4b1_test_*`: no constituye activación corporativa. La guarda previa mantiene su denegación en bases corporativas requeridas. No hay flag de aplicación/HTTP/GUC que la desactive.

## 11. Identidad y autorización

Entra, sesiones, roles y matriz no cambian. El actor procede de `requireUser` y del perfil admitido observado por PostgreSQL; no se toma de DTO/FormData. Las pruebas usan sesiones del proveedor sintético y tres deberes DB separados. Un usuario de consulta mantiene lectura global y no ejecuta escrituras. Se demuestra que la revocación de EDIT, confirmada por otra transacción administrativa mientras una escritura está pendiente, provoca rollback al commit. La integración debe todavía enumerar/revalidar todos los permisos adicionales de cada operación (cierre/anulación/orígenes) y resolver los importadores SERIALIZABLE sin depender de snapshots obsoletos.

Defecto previo demostrado y corregido en metadatos del inventario 4B1: `createCatalogAction.resourceArg` era0 y trataba el FormData como ID; pasa a-1. `createCatalogItemAction.resourceArg` era-1 y omitía el catálogo padre; pasa a0. Módulo, permiso, matriz y reglas del guard no cambian. Las acciones reales y la regresión 4B1 verifican esta corrección; el registro de plantillas ya tenía el índice correcto.

## 12. Integración por módulo

La evidencia inicial sobre tablas reales se amplía con **alta y edición en borrador de los siete módulos mediante sus acciones originales** (§1). Se prueban actor, OLD/NEW, historial, recibo y rechazo del lector. Siguen pendientes ciclos operativos completos, documentos y servicios transversales. Ninguna fila de la matriz63 se acredita solo por instalar un trigger o invocar un helper; el catálogo conserva el estado incompleto hasta reconciliar todos sus escenarios.

## 13. Administración

Los 13 writers W17 están compuestos con el sobre SQL y se ejercitan desde sus acciones autorizadas originales: departamentos, catálogos/hijos, clonación/edición/activación de formularios, registro/activación de plantillas, parámetros y alertas. Se comprueban actor, OLD/NEW, FKs a `ConfigurationChange`, rollback de historial y noop sin evento nuevo. Los formularios de settings incluyen UUID de petición en el HTML inicial; un reintento con la misma clave/contenido devuelve el recibo sin duplicar historial. La configuración sin requisito conserva la prueba PostgreSQL anterior. CLI de instalación y administración de usuarios aún requieren integración propia.

## 14. Importaciones e históricos

Identificado el cliente Prisma independiente de importación PNT y la caducidad de staging desde GET/listado. Pendiente adaptar sin perder SERIALIZABLE/idempotencia ni atomicidad por fila en importadores con lotes parciales. Mantener procedencia histórica y ejecutor actual separados. Scripts privilegiados con etiquetas de consola no acreditan identidad corporativa; su uso regulado debe permanecer bloqueado hasta disponer de procedencia técnica controlada.

## 15. Negativas ejecutadas en este corte

El smoke de captura prueba consulta sin permiso de edición, SQL/cliente independiente sin lease, GUC falso, motivo ausente para rectificación, captura omitida, testigo omitido, OLD falseado, fallo tras escritura padre/niño, ambos ámbitos de una relación, revocación concurrente, petición repetida con contenido/permiso diferente y checksum binario falso. Se cotejan filas, operaciones, eventos, targets y cursores tras rollback. No se afirma haber completado las 15 negativas sobre todos los writers: supersesión D05, servicios/rutas directas de los módulos, restauración de eventos B2 y otros escenarios siguen pendientes.

## 16. Concurrencia e idempotencia

Se prueban contextos separados, cadena OLD/NEW de tres writers simultáneos, secuencias continuas, retry postcommit sin callback repetido, conflicto de digest/permiso y revocación concurrente de grant. Los locks de filas/cursores serializan esa cadena; operaciones multirraíz pueden requerir tratamiento explícito de deadlock y orden de locks en los adapters. Recibos tipados de formularios/redirects/documentos y CAS de servicios originales siguen pendientes. El piloto B1 y sus pruebas no se reducen.

## 17. Recuperación 4B2

Backup/restore reconocen B1, requisito B2 y fundación de captura por objetos/migraciones verificables. El contrato nuevo también coteja políticas y ausencia de filas privadas; revoca SELECT indebido de leases tras `--no-acl`. El rol que ejecuta el snapshot puede leer esas tablas vacías solo si carece de DML en todas las tablas públicas; aplicación y terceros no reciben esa excepción. El smoke comprueba negativas al conceder SELECT de lease a la app y al conceder UPDATE de columna al backup, además del positivo read-only. La imagen incorpora el tercer contrato. Se conservan cifrado, almacenamiento aprobado, cuarentena y revocación de sesiones. La recuperación 4B2 comprueba instalación/esquema/contrato completo y journal B1; **todavía falta enriquecer su dataset con operaciones/eventos/enlaces y originales/supersesiones B2**, sin presentar la prueba actual como recuperación de B2 terminada.

## 18. Pruebas y CI

Focalizadas iniciales: inventario, matriz y contexto; tipos/lint afectados; smoke B1; `pnpm phase4b3-b2:configuration:smoke` prueba acciones reales de configuración en PostgreSQL y base propia `covex_phase4b1_test_b2_configuration_*`, eliminada al terminar. Solo se sustituye la invalidación de cache de Next en ese fixture; autenticación, autorización, Prisma y PostgreSQL son reales. Suite unitaria completa previa al requisito:707 tests/99 archivos.

`pnpm phase4b3-b2:requirement:smoke` crea otra base propia y tres deberes DB separados. Verifica instalación inactiva, requisito SQL durable, bloqueo directo/bulk/TRUNCATE, RPC/grants, ausencia de bypass por GUC, consultas globales, falta de falsos eventos, B1 con historial autenticado y detección de guarda deshabilitada. Focalizadas actuales:19 tests/5 archivos; suite unitaria actual709 tests/100 archivos; backup Python26 tests, tipos y lint correctos. No se ejecuta quality/CI integral B2 hasta completar la integración, sobre su último commit, sin reducir suites ni modificar el gate.

Imagen `covex4b3-backup:b2` construida y prueba Docker de almacenamiento aprobada: UID10001, montaje ficticio válido y negativas de ausencia/desmontaje/sustitución correctas. No se despliega ni se provisiona almacenamiento corporativo. El checkout queda en la misma rama para continuar captura SQL, integración de módulos, custodia, negativas pendientes y regresión final.

Evidencia del motor/W17 actual: `phase4b3-b2:capture:smoke` — PostgreSQL16, propietario/migrador/aplicación separados, siete tablas de módulo, bulk/niños/cascade, tipos nativos incluyendo arrays, noops sujetos a ámbito, concurrencia y negativas; dos tests PostgreSQL adicionales recorren las 13 acciones originales de configuración. Suite unitaria711 tests/101 archivos; focalizada audit/auth/context175 tests/10 archivos; tipos y Prisma validate correctos, lint sin errores (tres avisos previos). Python backup26 tests y runtime13 conservados. B1/requisito/atomicidad legacy B2 y recuperación4B2 pasan.

`phase4b3-b2:auth:smoke` ejecuta íntegramente el smoke HTTP/OIDC4B1 sobre otra base propia y una app Next actual temporal en loopback, con proveedor sintético firmado. El runtime temporal copia fuentes del checkout, sin Git checkout/worktree ni `.env`; mantiene intacto el standalone existente y elimina procesos/directorio/base al terminar. Verifica siete módulos, lectura global, ámbitos, revocación, CSRF y snapshots. No utiliza la base habitual ni un proveedor corporativo. No se ejecutan quality/CI final ni QMS final gate B2 hasta completar el alcance restante.

La imagen actual `covex4b3-backup:b2-capture` se construyó (`3c06e7018163b3e9752dd4769c90a10885deee9a0715d29cf7f3c7199f1f46e1`) y supera el smoke Docker de almacenamiento con UID10001. El primer intento no pudo terminar con el disco lleno; después de liberar solo caché de compilación y retirar la imagen B2 de ensayo anterior se repitió con éxito. Se conservaron contenedores PostgreSQL, volúmenes y datos. La imagen B1 sigue disponible y no se desplegó ninguna.

## 19. Riesgos y límites

El motor SQL y W17 tienen evidencia parcial real; la matriz completa sigue abierta. Faltan composición de los siete módulos, review/administración/importaciones/scripts, todos los permisos condicionados, motivos y recibos completos, custodia D05, canal técnico separado y dataset de recuperación B2. No hay protección criptográfica frente a DBA ni aceptación GMP/IT. No se inventan rutas, identidades técnicas, aprobaciones, originales o checkpoints.

## 20. Activación y C

Implementado el requisito durable y verificable; pendientes preparación completa, referencias de aceptación QA/DT/IT y activación. Instalación, arranque o merge no activan una política. Una vez registrado el requisito en una base corporativa, las guardas deniegan escrituras y ningún flag HTTP/GUC lo desactiva silenciosamente. El RPC de captura de esta fundación solo admite bases efímeras de integración; no es una ruta de activación productiva. `auditPolicyState` mantiene prepared/activated/corporateUseAuthorized enfalse. Registrar un requisito no es una aprobación GMP ni una firma. Pruebas aisladas/B1 se conservan. C no se implementa; la PR final exige cobertura real, custodia/recuperación y CI integral demostradas.
