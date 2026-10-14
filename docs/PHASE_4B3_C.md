# Fase 4B3-C — consolidación técnica y verificación

Rama única: `feature/phase4b3-b2-qms-audit-integration`, checkout existente. Checkpoints conservados: B2 `49bfe41718fb6bbc0870ecb5a086e166f82106bc`, consolidación interrumpida `a4745755238ba8d3aff7996ddd68b2ae9f6225ca`, corrección de corte/exportación `f590b275e40668ca4b8ed45fbba8ddf6cc8d88c0`. Referencias de diseño: [4B3-A](PHASE_4B3_A.md), [B2](PHASE_4B3_B2.md), D-082 en [DECISIONS](DECISIONS.md).

## Alcance implementado

Los siete expedientes conservan sus pantallas y ciclos funcionales y añaden la pestaña Audit Trail. La consulta agrupa operaciones únicas por transacción, muestra actor autenticado, UTC, correlación, secuencia, motivo, OLD/NEW tipado y referencias a versiones/documentos. El historial operativo legado y las versiones se consultan aparte; no se reconstruye identidad histórica ni se fabrican eventos retrospectivos.

Los paneles Server Component anidados recuperan la sesión validada mediante la frontera de autenticación existente cuando ya no está disponible el contexto de identidad de la construcción de la página. Esto conserva los mismos permisos/ámbitos y evita el error de renderizado 401 demostrado por la prueba real de interfaz.

La tarjeta de registro de revisión mantiene el flujo normal de página: se eliminó su posición sticky al comprobar que tapaba las casillas de selección en Chromium. Se conserva el diseño existente y la prueba exige interacción real, sin clicks forzados.

La bandeja transversal `/audit-trail` tiene paginación en servidor y filtros por módulo, expediente, actor, fecha, operación, criticidad técnica, motivo y revisión. El stream ordinario QMS/PNT conserva consulta global para usuarios activos/admitidos. Administración/seguridad exige un permiso explícito separado. Los objetivos adicionales no duplican operaciones; los eventos se filtran por la raíz visible.

`SYSTEM/ALL` reserva permisos independientes `AUDIT_TRAIL_REVIEW`, `AUDIT_TRAIL_EXPORT` y `AUDIT_TRAIL_SENSITIVE_READ`. La administración técnica no los obtiene automáticamente. Las pruebas QA los conceden únicamente en fixtures sintéticos; no se han asignado permisos corporativos ni aceptado una matriz real.

La revisión crea un recibo append-only con identidad, resultado técnico neutral, observaciones, corte y listas exactas de operaciones/eventos. Una rectificación enlaza otro recibo, conservando el anterior. No cambia eventos, aprobaciones, cierres ni firmas. La selección y PostgreSQL cotejan el límite `(occurredAt, UUID)`. El servidor resuelve los microsegundos del timestamp inmutable mediante su UUID y verifica los milisegundos enviados por el formulario: no redondea ni amplía el corte.

La exportación CSV UTF-8 conserva bytes, SHA-256 calculado por PostgreSQL, manifest, filtros, versiones de política/esquema/release y eventos exactos. Las celdas se escapan frente a fórmulas. El RPC recibe `row_count::integer`. Los reintentos del mismo comando reutilizan el recibo y archivo originales; cambiar filtros con la misma petición produce conflicto. La descarga requiere permiso explícito y, para un manifest sensible, permiso adicional; usa `private, no-store`.

## Protección y recuperación

El contrato C añade cinco tablas y diez triggers de inmutabilidad/no-TRUNCATE al contrato B2 sin modificar contratos ni migraciones publicados. Contrasta propietario, cuerpos/firmas de funciones, `SECURITY DEFINER`, `search_path`, ausencia de EXECUTE público y triggers habilitados. El rol de aplicación no puede insertar, modificar, borrar ni truncar recibos; solo SELECT y RPC controlados. Cada escritura de revisión/exportación verifica la protección y el rol operativo dentro de su transacción.

Backup selecciona el contrato C por el esquema instalado y falla de forma cerrada si una migración registrada ha perdido su tabla. La restauración conserva recibos, vínculos, manifest y bytes; restablece ACL seguros tras `--no-acl` y coteja protección antes de abrir acceso. El fixture de recuperación contrasta las cinco familias C, hashes, replay y rechazo de modificaciones después de restaurar, además de las pruebas históricas conservadas de 4B2. Continúan las comprobaciones obligatorias de identidad/montaje del almacenamiento. El exportador CSV no sustituye este backup.

El inventario binario contrasta también `AuditTrailExport.contentSha256`; una prueba negativa demostró que la lógica anterior solo reconocía `checksum`/`sha256` y aceptaba una huella C discordante. Se incorporan pruebas positiva/negativa focalizadas y un caso PostgreSQL de corrupción sintética con triggers habilitados antes del backup.

## Evidencia y ejecución

`phase4b3-c:smoke` crea y elimina su propia base, rol operativo y procesos loopback. Ejecuta las cuatro pruebas C conservadas más negativas de protección y reintento desde filtros de revisión; usa Chromium con usuarios sintéticos de consulta, QA e IT para recorrer los siete módulos, consulta transversal, revisión, filtros, descarga y denegación del stream sensible. `--database-only` permite focalizar el diagnóstico sin repetir regresiones de otros bloques.

Se conserva la matriz63: TR09 figura como `DEMONSTRATED_CONTROLLED_REVIEW_EXPORT`, con fuentes, tablas y pruebas C. Las exclusiones/streams de B2 y la aceptación formal pendiente siguen intactos. Inventarios estáticos y contrato JSON se regeneran desde fuentes y se cotejan mediante pruebas, sin atribuirles por sí solos cobertura de SQL.

La evidencia focalizada ya acredita permisos, corte exacto, replay/conflictos, manifest, inmutabilidad y detección de protección debilitada. La comprobación previa con timestamps `.123456`, `.123457`, `.123458` confirmó exclusión de la operación posterior dentro del mismo milisegundo. Los dos defectos ESLint de `trail.ts` se corrigen sin desactivar reglas.

La prueba Chromium de C confirma las siete pestañas, consulta transversal, ausencia de opciones de revisión/exportación para consulta e IT, actor autenticado, interacción QA de revisión, filtro de revisadas, descarga CSV y denegación del stream sensible, sin errores de navegador.

La entrega exige `pnpm quality` y los cinco grupos completos de `.github/ci-suites.json` sobre el SHA final, más el gate de cobertura del mismo SHA. Sus resultados exactos se comunican en la entrega; este documento no sustituye la evidencia ejecutada. El workflow remoto solo se dispara por PR y no hay PR de esta rama: la consolidación puede ejecutar localmente los runners y gate sin crear una PR. No se presenta una ejecución local como GitHub Actions verde.

## Límites y aceptación pendiente

La aplicación conserva el modelo híbrido, campos de responsables y firmantes externos, reglas de los módulos y decisiones GMP. No hay despliegue, merge, activación corporativa ni validación GMP. La clasificación crítica es técnica; QA/DT debe aceptar criticidad, periodicidad/alcance de revisión, observaciones y procedimiento de escalado. IT/QA debe confirmar retención, capacidad, límites de rendimiento con carga corporativa, RPO/RTO, identidad operativa, custodia y liberación. La evidencia sintética no confirma dichos criterios ni protege frente a un DBA privilegiado fuera de los controles organizativos.
