# Auditorías R5 — CAPA plan con versiones, hallazgos y aspecto (diseño)

Estado: **diseño aprobado el 2026-10-19 (D-110). R5 completa: R5A, R5B1, R5B2, R5C1, R5C2 y R5D implantadas.**

Origen: revisión del módulo por el responsable de Calidad (2026-10-19), once observaciones sobre auditorías internas y externas. Este documento recoge lo acordado y lo divide en cuatro PR (R5A–R5D). Se respeta D-070: no se rediseña la aplicación; el módulo se alinea con la maquetación de los demás.

## 1. Decisiones del responsable de Calidad (2026-10-19)

| Tema | Decisión |
|---|---|
| Versiones del CAPA plan | Numeración propia 00, 01, 02…, independiente del informe. 00 al establecer el CAPA plan; **cada seguimiento genera la versión siguiente**. |
| Cierre de la auditoría | Basta con tener **cerradas todas las acciones** (o no aplicables) con evidencia o justificación, y cada hallazgo tratado. Las Desviaciones y CAPA vinculadas siguen su propio ciclo y no bloquean. |
| Cliente e inspección | **Solo CAPA plan.** El informe recibido se adjunta; no se rellenan textos ni se emite informe COVEX. |

Se registrarán como **D-110**. D-110 sustituye de D-066 la regla «solo se versiona al emitir el informe; seguimientos y cambios del CAPA plan no versionan» y los requisitos de cierre de las acciones. El resto de D-064/D-065/D-066 sigue vigente: codificación, escenarios, referencias OBS/Rk, plantilla A4.03 como CAPA Plan oficial y versiones del informe.

## 2. Situación de partida (resumen)

- **Hallazgos (`AuditFinding`):**
  - se guardan con solo tipo y descripción;
  - cada uno tiene acciones locales (`AuditFindingAction`) y atribuciones a Desviaciones o CAPA (`AuditFindingRelation` → `QmsRelation`);
  - la vinculación solo admite expedientes existentes y no borradores, y no funciona con la auditoría en borrador (`relation-hooks.ts`).
- **Interfaz de hallazgos:** cada uno es una tarjeta con hasta tres niveles de `<details>`, para editar, retirar, añadir acción, vincular y seguimiento.
- **CAPA plan:**
  - no tiene modelo propio; son los hallazgos activos, sus acciones y las fechas `capaPlanDate` y `capaPlanEstablishedAt`;
  - solo se congela dentro de la foto de cada versión del informe;
  - el «estado actual» A4.03 se descarga desde Documentos, pero no con la auditoría en borrador;
  - los errores llegan como JSON 409.
- **Seguimientos (`AuditFollowup`):** son por hallazgo o generales. No actualizan acciones ni crean versiones, y un `nextReviewDate` pendiente bloquea el cierre.
- **Cierre (`closure-policy.ts`):**
  - siempre: informe emitido y conclusión;
  - por acción: verificación (`verificationResult`, `verifiedAt`, `verifiedBy`);
  - CAPA atribuidas cerradas y eficaces;
  - sin seguimientos pendientes;
  - reglas propias de cada escenario.
- **Cliente e inspección:** el informe se adjunta (`AUDIT_RECEIVED`), pero se siguen exigiendo conclusión, fecha del informe y evidencia de cierre para versionar y cerrar.
- **Aspecto:**
  - clases propias `audit-*`, con bordes azules y el resumen de «Vincular» en azul;
  - «Historial» como pestaña aparte, cuando los demás módulos lo integraron en Cronología (D-089);
  - los formularios de programas anuales pierden lo escrito si hay un error (React 19 reinicia los campos no controlados y las acciones no devuelven los valores).

## 3. R5A — Aspecto, documentos y programas anuales (implantada)

Sin cambios de base de datos. Añadido a petición del responsable de Calidad: el estado del listado con colores, como en Desviaciones.

**Expediente de auditoría**
- **Cabecera** igual que Desviaciones y CAPA: el enlace de retorno dentro de la línea superior (`eyebrow`), el título y las acciones.
- **Secciones:** se sustituyen los estilos propios con bordes azules (`audit-info-primary`, `audit-finding-card`, `audit-followup-entry`, `audit-link-editor > summary`) por `card` con `section-title-row`, igual que el resto. Los chips de estado conservan sus colores semánticos.
- **Pestañas:** Información · Hallazgos · Seguimiento · Relaciones · Informe y cierre · Documentos · Versiones · Revisión · Cronología · Audit Trail. El historial de modificaciones pasa a Cronología, igual que en los demás módulos (D-089). Las direcciones antiguas `?tab=history` abren Cronología.

**Documentos**
- Lista todo lo descargable en un solo sitio:
  - CAPA plan · estado actual;
  - CAPA plan por versión (desde R5C);
  - informe por versión y PDF firmado;
  - plan externo (proveedor);
  - documentos recibidos o adjuntos.
- Se mantiene el registro de adjuntos.

**CAPA plan · estado actual**
- Se puede descargar siempre, también con la auditoría en borrador o con hallazgos incompletos. Las celdas vacías quedan en blanco.
- Hay un botón también en la pestaña Hallazgos.
- Sigue siendo un documento de trabajo sin valor de versión (`currentState:true`).

**Errores de descarga**
- La página muestra un aviso legible, por ejemplo: «La plantilla A4.03 no está instalada: instálala en Configuración → Versiones».
- Ya no aparece el JSON 409.

**Programas anuales**
- Afecta a: alta del plan, alta y edición de auditorías del programa, aprobadores, emisión y retirada.
- Usan `preserveFormState` y `submittedDefaults` (`src/lib/forms/preserved-state.ts`) con `key={formRevision}`, como el resto de formularios. Ante cualquier error se conserva lo escrito y el error se muestra en el formulario, sin la pantalla de error.
- Los campos se agrupan en secciones con la maquetación de `record-form`: identificación, planificación y responsables.

## 4. R5B — Hallazgos (R5B1: ficha, justificación y vínculos; R5B2: abrir CAPA o Desviación)

**Ficha del hallazgo**, sin desplegables anidados:
- **Cabecera:** referencia (OBS/Rk), tipo, criticidad, estado derivado y botón «Editar».
- **Cuerpo:** descripción, criterio o requisito, evidencia objetiva, y tratamiento o justificación con su referencia de evidencia.
- **Acciones:** tabla con descripción, responsable, fecha objetivo, estado, fecha de cierre y referencia de evidencia. Cada fila tiene «Editar». Debajo, «+ Añadir acción».
- **Vínculos:** códigos (o «Borrador») de las Desviaciones y CAPA vinculadas, con su estado, y los botones «Abrir desviación», «Abrir CAPA», «Vincular existente» y «Justificar y cerrar».

**Edición**
- Un único elemento en edición cada vez, indicado en la dirección (`?tab=findings&edit=finding:<id>` o `action:<id>`).
- Guardar o cancelar vuelve a la ficha.
- Se mantiene el guardado explícito, el control de concurrencia (`expectedUpdatedAt`) y el motivo de cambio.
- Retirar un hallazgo o una acción queda dentro de su formulario de edición, con motivo.

**Registro incompleto**
- Mínimo: tipo y descripción.
- Se puede registrar y editar en cualquier estado de la auditoría salvo anulada, incluido el borrador.

**Abrir Desviación o CAPA desde un hallazgo** (decisión del 2026-10-19; se implanta en R5B2)
- «Abrir CAPA» / «Abrir desviación» llevan al **formulario de nueva CAPA o Desviación ya rellenado**, con el mismo patrón que «Crear CAPA» desde una desviación:
  - departamento = departamento de codificación de la auditoría (o el primero auditado si no lo hay);
  - descripción = descripción del hallazgo;
  - origen = la auditoría y la referencia del hallazgo.
- Al guardar, como borrador o abierta, el expediente queda vinculado al hallazgo: relación global AUDIT GENERATES y atribución.
- Requiere el permiso de crear en el módulo de destino y el de editar la auditoría.
- Se descartó crear el borrador con un clic desde la auditoría: el audit trail asigna cada operación a un único módulo, y ninguna acción crea expedientes de otro módulo.

**Vincular existente**
- Igual que hoy, pero admite destinos en borrador y la auditoría en borrador.
- Se ajusta `relation-hooks.ts`: se mantiene que el destino esté activo y sea Desviación o CAPA.

**Justificar y cerrar en el momento**
- Formulario corto: justificación, referencia de evidencia y fecha de cierre.
- Deja el hallazgo con `treatmentStatus=CLOSED` (o `NOT_APPLICABLE`) sin acciones, con las validaciones actuales de tratamiento y evidencia.

## 5. R5C — CAPA plan con versiones, seguimiento y cierre

Se implanta en dos PR:
- **R5C1:** modelo, captura y contrato, versión 00, descargas y pestaña Versiones.
- **R5C2:** seguimiento con versiones 01+, cierre nuevo y seguimientos antiguos en solo lectura.

**Modelo nuevo `AuditCapaPlanVersion`** (patrón de `AuditAnnualProgrammeVersion`):

| Grupo | Campos | Notas |
|---|---|---|
| Identidad | `id`, `auditId` | |
| Secuencia | `sequenceNumber` (0, 1, 2…) | Se muestra como «00», «01»…; único por auditoría |
| Tipo | `kind`: `ESTABLISHED` o `FOLLOWUP` | |
| Seguimiento | `followupDate`, `observations`, `nextReviewDate?` | |
| Idempotencia | `requestId`, `requestHash` | Único por auditoría |
| Foto | `contentFingerprint`, `snapshot` | Foto de hallazgos, acciones y vínculos con su estado |
| Plantilla | `templateVersionId`, `templateChecksum` | La plantilla A4.03 usada |
| Archivo | `fileName`, `mimeType`, `fileData`, `fileSize`, `checksum` | El A4.03 generado y congelado |
| Autoría | `generatedAt`, `generatedBy`, `authenticatedUserId?` | |

- Captura de audit trail B2, inventarios de escritores y política, y contrato de copia de seguridad con el mismo tratamiento que `AuditAnnualProgrammeVersion`.

**Establecer el CAPA plan (versión 00)**
- Botón en Seguimiento, con el permiso que hoy fija `capaPlanEstablishedAt`.
- Admite hallazgos y acciones incompletos: se congela lo que haya.
- Fija `capaPlanEstablishedAt` y `capaPlanDate` y genera el A4.03 con «00» en la celda de versión (K7).
- Ya no exige el informe emitido antes.

**Seguimiento del CAPA plan (versiones 01, 02…)**
- Pantalla con todas las acciones activas en tabla editable: fecha objetivo, estado, fecha de cierre y referencia de evidencia u observación. Además, hallazgos sin acciones con su estado de tratamiento, observaciones generales, fecha del seguimiento y próxima revisión opcional.
- Al guardar, en una transacción:
  1. se actualizan las acciones y hallazgos cambiados, con el historial de modificaciones y las validaciones de cierre de siempre;
  2. se emite la versión siguiente con su foto y su A4.03.
- Si no hay ningún cambio ni observación, no se emite versión.
- Requiere la versión 00.

**Otras reglas**
- Si la plantilla A4.03 no está instalada, no se emite versión y se avisa de cómo instalarla.
- Los seguimientos antiguos (`AuditFollowup`) se muestran como «Seguimientos anteriores» en solo lectura y dejan de bloquear el cierre.
- Pestaña **Versiones:** dos secuencias, «Informe» (internas y proveedor) y «CAPA plan», cada una con su descarga.

**Cierre nuevo** (`closure-policy.ts`), aplicado a todos los escenarios:

| Requisito | Detalle |
|---|---|
| Expediente | Activo y no en borrador |
| Informe | Internas y proveedor: al menos una versión del informe emitida (que ya exige la conclusión). Cliente e inspección: informe recibido adjunto (`AUDIT_RECEIVED`), y la fecha de respuesta si se marcó «requiere respuesta». |
| CAPA plan | Si hay hallazgos activos, establecido (versión 00) |
| Acciones activas | `CLOSED` o `NOT_APPLICABLE`, con evidencia, referencia o justificación |
| Hallazgos activos | Con alguna acción, o tratamiento o justificación en estado terminal con evidencia o referencia |

- **Deja de exigirse:** la verificación de cada acción (los campos siguen disponibles y opcionales), que las CAPA atribuidas estén cerradas y eficaces, `reportSentAt` de proveedor, `closureEvidence` y los seguimientos pendientes.
- **Se mantiene** la excepción de proveedor tal como está.
- **Aviso, no bloqueo:** si la última versión del CAPA plan no refleja el estado actual (huella distinta), se recomienda registrar un seguimiento final antes de cerrar.

## 6. R5D — Cliente e inspección

**Informe y cierre**
- Muestra solo:
  - el informe recibido (adjuntar y ver);
  - «requiere respuesta» y la fecha de respuesta enviada;
  - observaciones internas opcionales;
  - el estado de cierre.
- No hay informe COVEX ni versiones del informe; el botón «Emitir informe» no aparece.

**Hallazgos y CAPA plan**
- Los hallazgos se introducen a mano con los tipos `CLIENT_OBSERVATION` y `AUTHORITY_OBSERVATION`, y además `RECOMMENDATION`.
- El CAPA plan, sus versiones y su A4.03 funcionan igual que en el resto de escenarios.

**Validación**
- Se retiran para estos escenarios los requisitos de conclusión, fecha del informe y evidencia de cierre.
- Las auditorías de cliente o inspección ya existentes con versiones de informe las conservan en solo lectura.
- Un hallazgo ya existente de otro tipo (por ejemplo, tras cambiar el escenario) conserva su tipo; los nuevos y los cambios de tipo se limitan a los del escenario.

## 7. Pruebas y comprobación por PR

- Pruebas unitarias de las reglas puras:
  - política de cierre por escenario;
  - decisión de emitir o no una versión del CAPA plan;
  - huella y foto;
  - validación del seguimiento.
- Pruebas de servicio sobre PostgreSQL:
  - transacción de seguimiento y versión;
  - idempotencia por `requestId`;
  - abrir Desviación o CAPA desde un hallazgo;
  - vincular borradores.
- Pruebas de navegador en las suites de auditorías:
  - registrar un hallazgo incompleto;
  - abrir una CAPA desde un hallazgo;
  - establecer el CAPA plan;
  - registrar un seguimiento;
  - descargar el A4.03 de una versión;
  - cerrar.
- Inventarios de audit trail regenerados y contratos B2 actualizados cuando haya tabla nueva (R5C).
- Ejemplos de la demo (D-109) actualizados para cada cambio: CAPA plan con versiones 00 y 01, y una auditoría de inspección con su informe adjunto ficticio.
- Validación por PR: lint, typecheck, `vitest`, `prisma validate`, build y comprobación visual en la demo.

## 8. Fuera de alcance

- Firma electrónica o aprobación GMP de las versiones del CAPA plan: la «emisión» es un registro operativo, como en D-066.
- Avisos por correo de los seguimientos.
- Cambios en la plantilla A4.03: se cumplimenta, no se rediseña.
- Cerrar automáticamente las Desviaciones o CAPA vinculadas, o exigir su cierre.
