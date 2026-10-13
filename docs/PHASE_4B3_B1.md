# Fase 4B3-B1 — Motor transversal y piloto sintético

Fecha: 2026-10-13. Base: main `25c5fd7a2bbacdb85af3bfbeda65c3706f4007e0`, diseño [PHASE_4B3_A.md](PHASE_4B3_A.md), PR #141. Rama `feature/phase4b3-b1-audit-engine`; una PR para revisión, sin merge ni despliegue. Evidencia final vinculada al SHA y Checks de esa PR.

## Alcance real

Se implementa infraestructura transaccional, captura PostgreSQL y protección del journal. Únicamente se registra la política técnica `SYNTHETIC_PILOT_V1`, operación `PILOT_SET_VALUE`, origen `SYNTHETIC_PILOT`. No existe ruta, Server Action, formulario ni activación de captura en operaciones ordinarias de los siete módulos. El piloto cambia un entero aislado asociado a una desviación ficticia; no modifica campos del proceso de desviaciones.

La escritura requiere entorno sintético admitido y base cuyo nombre cumple `covex_phase4b1_test_[a-z0-9_]+`. El administrador de una base corporativa no obtiene por ello un piloto utilizable. La infraestructura no es un audit trail GMP operativo ni validado. No se integra B2 ni consulta/revisión/exportación C; no se crean firmas electrónicas ni históricos retrospectivos.

## Arquitectura y datos

Migración aditiva `20261013000100_audit_engine_b1`; no se alteran migraciones anteriores ni datos históricos. Las claves de raíces existentes son TEXT; `AuthUser` y las operaciones usan UUID. FKs Restrict conservan asociaciones.

| Modelo | Función |
| --- | --- |
| AuditOperation | UUID, actor local estable y nombre observado, origen, operación, motivo, requestId/digest, política/esquema, principal SQL y hora PostgreSQL |
| AuditAggregateCursor | Raíz QmsRecord, ControlledDocument o AuditAnnualPlan mediante FK real y CHECK excluyente; contador BIGINT |
| AuditOperationTarget | Relaciona operación/raíz, secuencia única por raíz y correlación multientidad |
| AuditEvent | Entidad/campo, ordinal por operación, old/new JSON tipados, hora SQL y referencias opcionales a versión/documento/checksum |
| AuditRuntimeContext | Lease privada y transitoria ligada a transacción, backend y principal SQL; no permanece tras commit |
| AuditPilotRecord | Entero, revisión y fecha del fixture sintético; no contiene datos GMP |

La estructura admite raíces PNT/plan, pero no captura todavía sus escrituras. Los valores distinguen ABSENT, NULL, STRING, BOOLEAN, INTEGER, DECIMAL, DATE e INSTANT. Enteros/decimales se conservan como texto para evitar pérdida de precisión. PostgreSQL comprueba formato/tipo, fechas reales y ausencia de atributos ambiguos. Las referencias documentales, cuando existan, se comprueban contra la raíz y checksum almacenado. El piloto no crea versiones ni documentos adicionales.

## Contrato del servicio

`src/lib/audit/service.ts` expone `withAuditedOperation` como composición exclusiva del servidor: comando estricto, callback confiable, transacción Prisma y receipt tras commit. En B1 solo acepta la política piloto registrada; no es una API genérica de políticas GMP. `updateAuditPilot` añade un adaptador que conserva un `ChangeHistory` operativo de la misma actuación y transacción, sin convertirlo en evidencia GMP validada.

El DTO solo admite requestId UUID, motivo, entre una y cuatro raíces únicas y valores/revisión esperada. Actor, nombre, origen, política, token y fecha no se reciben del cliente. `requireUser` utiliza la sesión autenticada; cada raíz exige el permiso existente DEVIATION/EDIT con su ámbito. SQL vuelve a comprobar admisión, usuario activo y permisos/ámbitos vigentes. Bloqueos compartidos de usuario/roles ordenan la comprobación respecto a cambios administrativos ordinarios. No se altera la matriz 4B1 ni la consulta global.

El digest canónico incluye contenido, motivo y política, con raíces ordenadas. La repetición del mismo requestId/actor/origen y contenido devuelve la misma operación sin repetir callback; contenido distinto produce conflicto. Se reautoriza antes de devolver un receipt. Las raíces se bloquean en orden; el cursor serializa sus secuencias y una revisión esperada permite compare-and-swap. Fallos SQL se convierten en un error genérico, sin exponer valores ni mensajes internos.

## Controles PostgreSQL

Nueve funciones y once triggers forman el contrato verificable `ops/backup/audit-contract.json`:

- `covex_audit_begin` es el único punto SQL de apertura admitido para la aplicación: verifica entorno, identidad/ámbito, rol mínimo, política, idempotencia y raíces; reserva secuencias y crea operación, targets y lease en la misma transacción.
- La lease combina txid, PID, session_user y GUC local. Un GUC aislado, UUID anterior o callback fuera de contexto no autoriza escritura. La aplicación no lee ni escribe `AuditRuntimeContext`.
- BEFORE UPDATE del piloto exige contexto/target y fija revisión y hora; AFTER UPDATE captura valores OLD/NEW reales en dos eventos, valor y revisión. Un helper omitido no elude los triggers.
- La restricción diferida exige cobertura al commit: exactamente dos eventos por target piloto, campos/entidad correctos y ordinales continuos; elimina la lease. Operaciones vacías o parcialmente cubiertas no pueden confirmarse. Esta cardinalidad es exclusivamente del piloto, no una política general GMP.
- UPDATE/DELETE y TRUNCATE del journal son rechazados por triggers; INSERT directo se rechaza por privilegios. Las funciones privadas no son ejecutables por PUBLIC. Las fechas son `clock_timestamp()` del servidor en TIMESTAMPTZ, no una fecha suministrada por el navegador.
- La comprobación de catálogo verifica tablas/propietario, funciones/código/search_path, privilegios PUBLIC y triggers activos, diferimiento y función asociada. La aplicación rechaza roles propietarios, superusuarios, CREATEROLE, CREATE de schema o DML directo sobre las tablas protegidas.

### Separación de roles

El ensayo PostgreSQL crea propietario NOLOGIN/NOSUPERUSER, migrador independiente miembro del propietario y aplicación sin pertenencia al propietario. Se demuestra que esta última no puede modificar el journal ni deshabilitar triggers. Los roles y secretos de ensayo son efímeros; nunca se provisionan identidades reales.

La migración puede transferir las seis tablas y nueve funciones al rol de `covex.audit_owner_role` configurado en la base, o al candidato `covex_audit_owner` si existe. Sin rol preparado conserva el propietario de migración para compatibilidad de desarrollo/CI: **ese fallback no prueba segregación corporativa**. `ops/postgres/audit-owner.sql` y `audit-grants.sql` son procedimientos candidatos para revisión IT, no scripts ejecutados en el entorno real. Aplicar las excepciones B1 después de los grants generales 4B2; no conceder UPDATE del piloto a la aplicación productiva.

## Pruebas y evidencia de rollback

`pnpm phase4b3-b1:smoke` usa PostgreSQL16 real, base efímera propia y sesiones del proveedor sintético existente. No modifica la base habitual. `src/lib/audit/domain.test.ts` comprueba contrato/DTO/digest; el smoke verifica comportamiento real del servidor y de SQL.

| Referencia 4B3-A | Evidencia B1 |
| --- | --- |
| T02 | Fallo de captura, callback vacío y transacción incompleta revierten conjuntamente datos, eventos, targets, cursores e historial |
| T03 | Identidad de sesión en operación/historial; DTO con actor/fecha rechazado; usuario de consulta, usuario inactivo y sesión revocada rechazados |
| T15/T16 | DML/TRUNCATE/INSERT y ALTER TRIGGER denegados al rol app; fake GUC/contexto rechazado; propietario distinto y límite DBA demostrado |
| T08 | Seis escrituras concurrentes, cuatro solicitudes duplicadas, conflicto de contenido y CAS con exactamente un ganador; secuencia y cadena old/new continuas |
| T18, parte B1 | Backup/restore real, journal/targets/relaciones intactos, rechazo de protección deshabilitada y nueva escritura correlacionada tras recuperación |
| T22, parte B1 | Contrato verificable de las funciones/triggers de la única política piloto; escritor sin contexto o cobertura rechazado. Inventario/activación de escritores GMP pendiente de B2 |
| T23, parte B1 | OLD/NEW real, tiempo SQL, distinción NULL/ABSENT y precisión de entero/decimal; fechas inválidas rechazadas. Monitorización NTP corporativa pendiente de IT |

Además se termina expresamente un backend perteneciente solo a la base/rol efímeros durante una transacción. Se comparan antes/después todos los estados piloto, revisión, operaciones/eventos e historial: ningún cambio parcial permanece. La misma comparación verifica fallos del callback multi-raíz y de una CHECK temporal de captura. Una operación válida multi-raíz produce dos targets y cuatro eventos con el mismo UUID.

No se atribuye a B1 la cobertura documental, importaciones, permisos administrativos o todas las operaciones de T18/T22/T23 que requieren B2. No se reduce ninguna regresión anterior.

## Recuperación y compatibilidad 4B2

El backup verifica el contrato antes de generar y antes de publicar. Reconoce bases anteriores a B1; rechaza ausencia total del journal cuando la migración B1 figura aplicada, protección incompleta, código/triggers alterados, lease persistente o grants de tabla peligrosos a roles ajenos al propietario. Se preserva el guard obligatorio de almacenamiento aprobado, cifrado, autenticación del manifiesto, snapshot consistente e inventario completo.

El restore utiliza destino nuevo, inicialmente sin CONNECT de PUBLIC, y no fabrica eventos históricos. `pg_restore --no-owner --no-acl` carga los datos y reinstala triggers; como restaura permisos por defecto de funciones, el procedimiento revoca explícitamente PUBLIC y grants peligrosos heredados sobre las nuevas tablas antes de validar protección. No reactiva un trigger debilitado para ocultar una restauración defectuosa. El propietario de recuperación sustituye temporalmente al original; IT debe restablecer propietario NOLOGIN, migrador/aplicación y grants mínimos antes de apertura corporativa.

El ensayo ampliado 4B2 conserva copia independiente con origen/almacenamiento original indisponibles, hashes/binarios/snapshots, siete módulos y revocación de sesiones. Compara exactamente operaciones, eventos y targets antes/después; comprueba lease vacía y una escritura nueva con secuencia siguiente, sin eventos de recuperación inventados. Una restauración con trigger deliberadamente deshabilitado falla y queda pendiente de reconciliación, sin declararse válida.

La imagen de backup incluye el contrato JSON. El ensayo Docker de almacenamiento aprobado se conserva. No se cambian Entra, modelos de autorización, ámbitos, códigos de negocio, históricos, documentos ni reglas de cierre/revisión de los módulos.

## Límites y decisiones pendientes

Los controles protegen frente al rol de aplicación y fallos ordinarios, no frente a un DBA/propietario capaz de deshabilitar triggers o alterar funciones/datos. El ensayo demuestra una modificación privilegiada tras deshabilitar protección y su detección mientras está debilitada. Un DBA puede volver a habilitar los triggers después de manipular datos: el cotejo de catálogo no demuestra integridad histórica frente a ese atacante.

Los hashes del contrato identifican **código SQL**, no encadenan eventos ni constituyen checkpoint externo o prueba criptográfica de autenticidad del journal. D08/custodia/monitorización independiente siguen pendientes. PostgreSQL confía en el servidor para vincular sesión a UUID: unas credenciales de aplicación comprometidas pueden invocar SQL con otro actor admitido; SQL no verifica MFA ni un token Entra. La aplicación no acepta ese UUID desde el cliente, pero esta frontera de confianza requiere operación segura y aceptación IT.

D01–D12 de 4B3-A siguen siendo propuestas pendientes de QA/DT/IT. B1 no decide criticidad, campos GMP incluidos/excluidos, motivos obligatorios por operación, firmas, retención, revisión periódica, reconciliación ni liberación productiva. No fue necesaria una nueva regla GMP para implementar la infraestructura sintética autorizada. Cualquier dependencia de esas decisiones en B2 exige aprobación previa.

## Integración posterior B2

1. Cerrar alcance/URS, clasificación y motivos con QA/DT, y roles/custodia/recuperación con IT. Inventariar escritores existentes y todas sus vías, incluidas administración, importaciones y documentos; asignar raíces y operaciones/versiones de política.
2. Añadir migraciones y políticas SQL aprobadas, adaptadores transaccionales y cobertura obligatoria por operación. No quitar el guard de base sintética ni reutilizar la cardinalidad de dos eventos como activación global. Preservar reglas específicas por módulo, ChangeHistory, snapshots y hashes; no reconstruir periodos anteriores a activación.
3. Probar cada vía incluida, referencias documentales, autorización real, fallos parciales, concurrencia y recuperación con roles finales. Definir observabilidad, activación controlada, fecha de corte y rollback con QA/IT antes de operación regulada. B1 termina aquí.

## Verificación y rollback técnico

Pruebas focalizadas: dominio (11), contratos CI (6), backup Python (26), smoke B1 y recuperación PostgreSQL4B2 ampliada. Calidad local: 701 tests en 96 archivos, Prisma/lint/build correctos; tres advertencias de lint preexistentes. La CI completa y su SHA final son la evidencia de aceptación técnica en la PR, no una validación GMP.

Para un fallo de ensayo se eliminan solo bases/roles y archivos efímeros propios. En producción no aplicar un DROP inverso improvisado: preservar backup y journal, bloquear nuevas escrituras incluidas, evaluar compatibilidad con release anterior y reconciliar con IT/QA. B1 es aditivo y ningún escritor ordinario de negocio depende de él; la retirada de código no autoriza borrar evidencia. Ensayar recuperación en destino nuevo y restablecer grants antes de abrir acceso.
