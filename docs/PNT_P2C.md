# P2C — Regresión final del módulo PNT

Baseline main `41f082908e87967fb9d355ca54237910dfd23d9e` (P2B fusionada). Rama `feature/pnt-p2c-final-regression`. Regresión conjunta P1A/P1B-1/P1B-2/P2A/P2B; sin funciones nuevas, rediseño, migraciones, firma electrónica ni integración SharePoint.

## Análisis y alcance

Revisados modelos ControlledDocument/ControlledDocumentRevision, staging de importación, objetos documentales y proyecciones/decisiones/enlaces P2B; ocho migraciones, índices de única vigente/en elaboración, FK de misma revisión y triggers inmutables. Revisados servicios, endpoints, Server Actions, validación de familia AB-XX, autorización, consultas y las cinco pestañas. Se mantienen las reglas contrastadas en GC-00/001/03 y GC-00/013/01 documentadas en P2A/P2B; no se añaden interpretaciones regulatorias.

Todas las escrituras de regresión usan fixtures sintéticos en PostgreSQL QA aislado. XLSX/DOCX/PDF se construyen en memoria; no se incorporan binarios corporativos al repositorio. Los nuevos smokes no limpian objetos/decisiones consolidados ni deshabilitan triggers. Los errores deliberados de restricciones SQL son resultados esperados de las pruebas negativas.

## Defectos comprobados y correcciones

1. **Fecha original confundida con vigencia operativa anterior.** En main se bloqueaba la activación de 01 si la fecha prevista original de 00 era posterior, aunque 00 ya tuviera una vigencia operativa verificada coherente. Reproducción: original +30 días, activación operativa hoy, sucesora hoy → error «La nueva vigencia no puede anteceder a la anterior». Se elimina únicamente esa comparación duplicada contra el original. Sigue comprobándose la proyección operativa; para históricos sin proyección, el upsert conserva el fallback original legacy. Prueba negativa adicional: sucesora anterior a la vigencia operativa sigue bloqueada y no retira 00.
2. **Identidad maestro/revisión divergente.** Main permitía cambiar el código de un maestro manual DRAFT después de verificar su revisión mediante P2B. La prueba esperaba rechazo y fallaba. Ahora el código es permanente desde que alguna revisión tiene proyección P2B. Variante también reproducida: código cambiado legítimamente antes de P2B, snapshot de revisión anterior, activación bajo el nuevo código; se bloquea al activar si maestro y código congelado no coinciden. No se reescriben snapshots ni se cambia la edición ordinaria de borradores P1A antes de P2B; la revisión debe contrastarse bajo una identidad coherente.

Cambios productivos limitados a `service.ts` y `lifecycle/service.ts` del módulo. No se modifican estados, fuentes Excel, fechas originales, objetos custodiados, decisiones históricas, esquema ni migraciones.

## Matriz de regresión

| Bloque / escenario | Comprobación | Cobertura y resultado |
| --- | --- | --- |
| P1A maestro y revisiones | Borrador incompleto, registro posterior, 00, UUID estable, familias departamentales, históricos, conflictos, paginación | Unitarios + PostgreSQL/Chromium P1A: OK |
| P1B-1 índice | Solo lectura, GC-00 excluida incluso con XML inválido; GC-00( → GC-00 conservando procedencia; estadísticas y discrepancias | Unitarios + PostgreSQL/Chromium P1B-1 + P2C: OK |
| P1B-2 lote | Persistencia, decisión de procedencia explícita, exclusión de fuente discrepante, una fila pendiente, importación parcial | PostgreSQL/Chromium P1B-2 y recorrido íntegro P2C: OK |
| Importación concurrente | Doble confirmación, lotes simultáneos, reintentos, reimportación sin sobrescribir registros/snapshots/estado | PostgreSQL P1B-2/P2C: OK |
| Documentos | Word de trabajo, PDF documental, PDF firmado externo, evidencia y referencia HTTPS sintética; cinco elementos por UUID de revisión | PostgreSQL/Chromium P2A/P2C: OK; ningún adjunto verifica/aprueba/activa |
| Custodia e históricos | SHA-256, bytes íntegros descargados, ownership, sustitución con motivo/original conservado; documentos enlazados a decisiones, UPDATE/DELETE prohibidos | PostgreSQL/Chromium P2A/P2B/P2C: OK |
| Integridad negativa | Archivo inválido, MIME/extensión/contenido, UUID ajeno, evidencia sustituida entre planificación/activación, corrupción sintética de lectura | Unitarios + PostgreSQL/Chromium P2A/P2B/P2C: OK; rechazo y rollback |
| Verificación y aprobación | Discrepancias pendientes; preparación/revisión/aprobación identificadas y ámbito/autoridad; registro externo distinto de aceptación, insuficiente/rechazado, separación de personas | PostgreSQL/Chromium P2B/P2C: OK |
| Vigencia | Futura sin activación, fechas incoherentes/vencidas rechazadas, activación explícita, 01 retira 00 atómicamente, única vigente | Dominio + PostgreSQL/Chromium P2B/P2C: OK; defectos de fechas/identidad corregidos |
| Snapshots e históricos P1A | Origen Excel/conciliación/identidad y fechas originales intactos; fechas operativas separadas; P1A no edita revisión P2B; legacy sin aprobación retrospectiva | PostgreSQL/Chromium P1A/P1B-2/P2B/P2C: OK |
| Retirada y rectificación | Anulación/retirada explícitas, rectificación enlazada e inmutable, terminales sin reactivación, cadena anterior invalidada antes de vigencia | PostgreSQL P2B/P2C y navegador autenticado P2C: OK |
| Concurrencia/errores P2B | Dos activaciones, versión obsoleta, solicitud idéntica reintentada, UUID reutilizado con otro contenido, errores SQL y rollback de todas las escrituras | PostgreSQL P2B/P2C: OK |
| Seguridad | Anónimo/secret incorrecto/sin read: lectura sensible falla cerrada; read completo sin escritura; write no otorga decisiones; capacidades independientes UI/servidor; legacy-register autentica actor | Unitarios, smokes P2A/P2B y P2C tras reinicio: OK |
| UX/navegación | Registro, índice, conciliación, listado/filtros, cinco pestañas, 01/00 descendentes, guardar/navegar, validaciones conservan datos, escritorio y móvil | Seis smokes Chromium; P2C 1440/390 y P2B 1440/768/390; sin pageerror/hidratación |
| Persistencia/reinicio | Nuevo cliente PostgreSQL y reinicio real Next con gateway sintético; bytes/decisiones sobreviven y acceso se revalida | P2A/P2B/P2C tras reinicio: OK |

La inyección de corrupción P2C altera únicamente los bytes devueltos al servicio por una extensión de cliente QA, no los datos almacenados ni triggers. El servicio rechaza el hash y la transacción no deja efectos. P1B-2 inyecta un error de inserción mediante trigger exclusivamente QA para comprobar rollback transaccional. No se considera cualificación de recuperación ante todos los fallos físicos posibles.

## Pruebas y CI

- Prisma validate/generate y las ocho migraciones aplicadas desde base vacía, después seed sintético.
- `pnpm pnt-p1a:smoke`, `pnt-p1b1:smoke`, `pnt-p1b2:smoke`, `pnt-p2a:smoke`, `pnt-p2b:smoke` y `pnt-p2c:smoke`. El último ejecuta cuatro casos específicos de defectos/límites y la regresión integrada. Se repiten P2B/P2C tras el último guarda de activación.
- Smokes Chromium de los cinco bloques, más `pnpm pnt-p2c:ui:smoke`: flujo de índice completo por UI, flujo manual sin Excel y revisión siguiente, ambos con incorporación real por formulario, descarga y decisiones explícitas.
- Reinicio real en modo trusted-proxy sintético, smokes P2A/P2B y `P2C_VERIFY_RESTART=true pnpm pnt-p2c:ui:smoke`. P2C recorre cada capacidad con cabeceras autenticadas, comprueba opciones de UI por estado/capacidad, rechaza anónimo y read/write antes de cada POST válido, y ejecuta registro histórico autorizado/denegado mediante Server Actions reales. Los unitarios añaden secret incorrecto y conservan el borrador ordinario P1A.
- Tests afectados: **83 tests / 11 archivos**. `pnpm quality` final verde: **429 tests / 78 archivos**, Prisma validate/generate, lint y build. Solo los dos warnings de hooks CAPA/CC preexistentes; no se modifican ni desactivan.
- CI mantiene el selector por rutas y las comprobaciones estrictas existentes, sin ampliar baterías de otros módulos. El job documental incorpora P2C PostgreSQL, Chromium y reinicio; mantiene los cinco bloques y quality. SHA y enlace/conclusión final de CI se registran en la única PR, evitando referencias circulares al SHA de este documento.

Las correcciones del propio smoke se limitaron a fixtures válidos (motivo obligatorio), selección inequívoca del enlace de descarga y sincronización con navegación/renderizado. No se debilitan aserciones, permisos ni tests previos.

## Resultado final y recomendación de cierre P2

Regresión local final **superada: 15/15 bloques de matriz**, seis smokes PostgreSQL (P2C añade cuatro casos específicos e integración), seis Chromium, tres comprobaciones tras reinicio real autenticado, 83 tests focalizados y quality con 429 tests. Migraciones desde base vacía y build correctos. CI se verifica en la PR antes de la entrega; su enlace, conclusión y head exactos se registran allí.

La regresión técnica no constituye validación funcional por el usuario ni cualificación/validación GMP. Con matriz/quality verdes se recomienda el cierre técnico de P2 condicionado a CI verde y revisión de la PR; **validación funcional pendiente del usuario** y **cualificación/validación GMP pendiente**. La PR se deja abierta, sin merge ni squash.

## Riesgos residuales y límites antes de uso GMP

Autenticación corporativa/topología real del proxy, cierre del acceso directo, eliminación de cabeceras cliente, roles/designaciones y ciclo de secretos deben configurarse y cualificarse. QA usa identidad/permisos sintéticos explícitos, no certifica seguridad corporativa. El responsable del formulario no autentica operaciones documentales; legacy-register usa la identidad del proxy, pero el registro ordinario P1A mantiene su contrato anterior.

Custodia PostgreSQL persistente no equivale a validación de almacenamiento, backups/restauración, disponibilidad ni retención. No scanner antivirus corporativo integrado ni prueba de todas las amenazas posibles. Referencias HTTPS no custodian bytes ni acreditan SHA/autenticidad; no hay integración SharePoint/Graph. PDF firmado/evidencia no valida firmas automáticamente, ni el registrador demuestra la identidad real de firmantes por escribirla.

Pendientes cualificación de infraestructura, evaluación de riesgos, validación operativa/funcional, formación, procedimientos de uso, permisos corporativos, firma electrónica si se aprueba otro alcance, distribución/copias/lecturas y revisión periódica. Historial operativo, no audit trail GMP validado. **No se declara la aplicación validada para uso GMP.**
