# Fase 4B3-B2 — integración transversal, trabajo en curso

Base verificada: main `70d6a1348a93a9dd51d9beb75a32e2014f375ed3`, B1 / #142 integrado. Rama única `feature/phase4b3-b2-qms-audit-integration`; checkout existente, sin worktrees. Referencias: [4B3-A](PHASE_4B3_A.md), [B1](PHASE_4B3_B1.md), [4B2](PHASE_4B2.md), [4B1](PHASE_4B1.md), [DECISIONS](DECISIONS.md) e inventario de autorización 4B1.

**Estado de este corte: preparación e integración inicial, no entrega B2 completa.** No hay captura SQL B2 ni política activada. No se ha demostrado cobertura de las 63 operaciones. No abrir la PR de entrega hasta cumplir los criterios solicitados y comprobar CI integral sobre su SHA final. Los commits internos no implican aprobación productiva.

## 1. Integración inicial

Se reconcilia el inventario estático con la base integrada y se corrige la separación entre modificaciones de configuración e historial. Las acciones de configuración utilizan una sola transacción, incluidas activaciones que retiran otras versiones; los helpers internos reutilizan la transacción. No se cambian estados, reglas de validación, codificación, permisos ni interpretación GMP de formularios.

## 2. Criterios funcionales confirmados por el proyecto

D01 modelo híbrido; D02 cobertura de cambios persistidos relevantes, incluidos borradores; D03 **opción B**, sin motivo adicional en todos los guardados y con uno por operación cuando corresponda; D04 sin reconstrucción ni retroatribución; D05 **opción A**, distinguir Word de trabajo de documentos formales y conservar originales sustituidos; D07 atomicidad de negocio/historial/auditoría/evidencia; D08 reutilizar protección B1 y declarar límite DBA. Estos criterios fueron autorizados para el diseño B2, no constituyen una URS ni aceptación regulatoria.

## 3. Aceptación QA/DT/IT

Formalización del uso previsto, clasificación y riesgo residual, custodia externa/checkpoints, retención, responsabilidades, corte y liberación siguen pendientes de QA/DT/IT. No se registran aprobaciones ficticias, firmas ni permisos reales. No se requiere aprobación de cada commit interno dentro del alcance autorizado.

## 4. Arquitectura inicial aplicada

`transaction-context.ts` proporciona composición exclusiva del servidor mediante AsyncLocalStorage. `db.ts` conserva el cliente y extensión de autoría 4B1; durante la composición dirige delegates/SQL a la transacción existente. Fuera del contexto conserva el cliente original. El contexto no procede de FormData ni headers y no concede permisos. `withDatabaseTransaction` reutiliza una transacción ya abierta; los tres bloques internos de configuración se adaptan expresamente para evitar commits independientes. No es todavía el motor de audit trail B2 ni sustituye triggers.

## 5. Inventario y matriz de operaciones

`scripts/audit-writer-inventory.ts` inspecciona código estático, nunca ejecuta escrituras ni consulta bases. En la base B1 identifica **279 llamadas explícitas en 49 archivos**, frente a 277/48 de 4B3-A: las dos llamadas del adaptador piloto B1 y su archivo adicional explican esa diferencia. Añade 12 escrituras anidadas visibles, 42 candidatos SQL —incluidos SELECT con efectos posibles— y seis lugares con clientes independientes. Excluye tests, smokes, fixtures, benchmarks y seed demo.

`writer-inventory.json` conserva localizador/función/delegate/método, claves estructurales, nested writes visibles y hashes de fuente. No contiene valores, sentencias SQL, archivos de entrada ni datos personales. Los argumentos dinámicos, alias y escrituras detrás de helpers siguen requiriendo revisión manual; AST no acredita cobertura ni atomicidad.

`scripts/audit-policy-catalog.ts` reconcilia los 63 IDs y W01–W22 de A con fuentes/escritores reales. `policy-catalog.json` contiene candidatos y criticidad **propuesta**, no campos aprobados ni catálogo SQL activo. Los campos candidatos se normalizan por modelo; bytes, campos de secretos y modelos de sesión/login/journal quedan fuera. Los índices de writers referencian el inventario versionado. Cada fila mantiene `NOT_DEMONSTRATED`, campos auditados/captura/evidencias vacíos hasta su integración y prueba real.

Hay 58 filas de escritura de negocio, dos de canal técnico separado (PN07/TR06), una de mantenimiento dependiente de IT (TR08), una de consulta sin nueva emisión (PN08) y una diferida a C (TR09). Clasificar una fila no demuestra su cobertura. La matriz individual sigue a continuación.

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
| TR02 | Catálogos/departamentos/parámetros/alertas | W17 | BUSINESS_WRITE; no demostrada |
| TR03 | FormVersion/FormFieldConfig: clonar/editar/activar/retirar | W17 | BUSINESS_WRITE; no demostrada |
| TR04 | Plantillas: registro/instalación/activación/retirada | W17, W21 | BUSINESS_WRITE; no demostrada |
| TR05 | Admisión/baja/roles/ámbitos/política y aceptación administrativa existente | W18 | BUSINESS_WRITE; no demostrada |
| TR06 | Login/logout/denegaciones/caducidad | W19 | TECHNICAL_SEPARATE_STREAM; no demostrada |
| TR07 | Importar históricos / backfill controlado | W20 | BUSINESS_WRITE; no demostrada |
| TR08 | Cambio directo DB / mantenimiento / restauración | W22 | CONTROLLED_MAINTENANCE_IT_DEPENDENCY; no demostrada |
| TR09 | Archivo/exportación/revisión del futuro journal | C, sin writer B2 | DEFERRED_C; no demostrada |

## 6. Motivos

Pendiente de integración: aplicar D03 por cambio real/estado, distinguir primera incorporación de rectificación y mantener un motivo por guardado. No añadir textos genéricos ni hacer obligatorio el motivo de todos los borradores, seguimientos o cambios administrativos. La clasificación de campos deberá contrastarse con los modelos y reglas actuales antes de programar exigencias.

## 7. Borradores

La cobertura futura incluye creación y edición de borradores con sus OLD/NEW reales, sin añadir motivo salvo regla vigente. El trabajo inicial no modifica formularios ni ciclos de borrador/apertura.

## 8. Custodia híbrida

Pendiente de integración: conservar PDFs originales/supersesión para todos los módulos donde `RecordVersionDocument.upsert.update` reemplaza bytes. Preservar PNT y programas/informes oficiales existentes; no crear una emisión oficial por cada descarga de Word de trabajo ni presentar regeneraciones como originales perdidos.

## 9. Modelos y migraciones

No se añaden migraciones en este corte ni se altera B1. La extensión aditiva del catálogo, activación y custodia documental queda pendiente. No se aplica ninguna migración a la base habitual/corporativa.

## 10. PostgreSQL

La captura/cobertura diferida B1 conserva su piloto aislado. Pendiente: extender contextos, raíces administrativas, captura obligatoria INSERT/UPDATE/DELETE/bulk/nested, motivos, evidencias y garantías de commit a las políticas B2. El helper transaccional inicial no demuestra que una escritura incluida no pueda eludir auditoría.

## 11. Identidad y autorización

Entra, sesión, roles, matriz, consulta global y guardas 4B1 permanecen intactos. La prueba inicial de configuración usa sesiones reales del proveedor sintético y las acciones autorizadas; el actor manipulado del formulario no sustituye al UUID/nombre autenticado. Pendiente: revalidación concurrente de autorizaciones dentro del sobre B2 y su prueba negativa específica.

## 12. Integración por módulo

Desviaciones, CAPA, Cambios, Reclamaciones, Devoluciones, Auditorías y PNT: todavía pendientes de captura B2. Se conservarán reglas específicas, historial, snapshots y versiones. Los candidatos por operación/tablas/servicio están en la matriz; ninguna fila se marca demostrada por invocar un helper.

## 13. Administración

Corregida la atomicidad de configuración: todos los cambios y `ConfigurationChange` comparten transacción, incluida lectura anterior y retirada simultánea de versiones. Prueba PostgreSQL fuerza un fallo del INSERT de historial y coteja exactamente departamento/fechas/estados de todas las versiones anteriores. Captura B2, motivos según clasificación y autorización administrativa concurrente siguen pendientes.

## 14. Importaciones e históricos

Identificado el cliente Prisma independiente de importación PNT y la caducidad de staging desde GET/listado. Pendiente adaptar sin perder SERIALIZABLE/idempotencia ni atomicidad por fila en importadores con lotes parciales. Mantener procedencia histórica y ejecutor actual separados. Scripts privilegiados con etiquetas de consola no acreditan identidad corporativa; su uso regulado debe permanecer bloqueado hasta disponer de procedencia técnica controlada.

## 15. Negativas ejecutadas en este corte

Pruebas del analizador detectan nested/bulk, SQL tagged y cliente independiente sin publicar literales. El contexto transaccional verifica rollback y aislamiento entre solicitudes concurrentes. PostgreSQL real verifica fallo de historial tras cambio de departamento y tras activación/retirada multi-versión: datos e historial intactos. **No se han ejecutado todavía las 15 negativas de captura B2 solicitadas.**

## 16. Concurrencia e idempotencia

Se prueba aislamiento de contextos concurrentes y reutilización de transacción; no se afirma resolución B2 completa de locks, before autoritativo, CAS, reintentos postcommit y revocación concurrente. Las pruebas B1 siguen operativas y no se modifican para hacerlas pasar.

## 17. Recuperación 4B2

No se modifican almacenamiento aprobado, backup, restore ni hashes en este corte. Pendiente extender recuperación para políticas/objetos B2, documentos sustituidos y continuidad de secuencia con protección/grants correctos. Los controles B1 no se presentan como prueba del esquema B2 todavía no implementado.

## 18. Pruebas y CI

Focalizadas iniciales: seis pruebas Vitest (inventario, matriz, contexto); tipos/lint afectados; smoke B1; `pnpm phase4b3-b2:configuration:smoke` prueba acciones reales de configuración en PostgreSQL y base propia `covex_phase4b1_test_b2_configuration_*`, eliminada al terminar. Solo se sustituye la invalidación de cache de Next en ese fixture; autenticación, autorización, Prisma y PostgreSQL son reales. Suite unitaria completa: **707 tests en99 archivos** correctos. No se ha ejecutado quality ni CI integral B2: se harán cuando la integración esté terminada, sobre su último commit, sin reducir suites ni modificar el gate.

## 19. Riesgos y límites

La matriz es inventario inicial; faltan política/captura/evidencias, custodia, cobertura de writers dinámicos/SQL/scripts y prueba completa de permisos concurrentes. El alcance del proyecto está autorizado, pero aceptación GMP/IT y riesgo privilegiado continúan separados. No se inventan credenciales, rutas corporativas, identidades técnicas ni checkpoints. No se declara la aplicación validada o el audit trail B2 operativo.

## 20. Activación y C

Pendiente mecanismo durable de requisito/aprobación/activación: instalación, arranque o merge no activarán una política. Una vez requerido el uso regulado, escrituras incluidas deben denegarse si falta su política o captura; ningún flag HTTP puede desactivarla silenciosamente. Pruebas aisladas se conservan. C (consulta/revisión/exportación) no se implementa en esta rama. La PR final se entregará únicamente con cobertura real, custodia/recuperación y CI integral demostradas.
