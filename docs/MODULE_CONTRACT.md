# Contrato de módulo QMS — diseño (PR 1, solo documentación)

**Estado:** diseño aprobado (D-083, 2026-10-16); implementación pendiente por PR. **Fecha:** 2026-10-16. **Base:** main `a1d61d8` (#143).

Este documento **no implementa nada** y no modifica código, schema, migraciones, plantillas, permisos, estados, relaciones ni datos. Desarrolla la línea ya aprobada en D-072 y en [QMS_TARGET_ARCHITECTURE.md](QMS_TARGET_ARCHITECTURE.md) («Extender módulos de forma segura»). Cada paso de implementación descrito en el plan de migración requiere aprobación de alcance propia.

No introduce flujos de aprobación, firma electrónica ni motor genérico. La V1 se mantiene como gestor de registros y expedientes (D-073, D-074).

## 1. Objetivo

Que un módulo QMS declare en **un único lugar** qué es y qué admite. Los servicios transversales (navegación, permisos, relaciones, audit trail, dashboard, revisión, documentos) leerán esas declaraciones en lugar de mantener listas propias.

Resultados esperados:

1. Añadir un módulo futuro (Proveedores, OOS/OOT, Riesgos…) no obliga a editar decenas de ficheros transversales.
2. Ampliar o restringir una relación entre módulos es un cambio localizado, revisable y con prueba propia.
3. Las reglas específicas de cada módulo salen del código común y vuelven a su módulo.
4. Base estable para, en el futuro y tras decisión expresa, describir ciclos de vida de forma declarativa (prerrequisito de cualquier flujo versionado).

## 2. Situación actual (evidencia del código)

El núcleo común existe (`QmsRecord`, `QmsRelation`, `QmsRecordVersion`) y funciona. Lo que falta es una **identidad de módulo única**: la lista de módulos y sus propiedades está repetida en muchos puntos. Unos **53 ficheros no de test** de `src/` contienen literales de tipo de módulo.

| Conocimiento de módulo | Dónde está hoy |
| --- | --- |
| Tipos de expediente QMS (6; sin PNT) | `prisma/schema.prisma:10` enum `QmsRecordType` |
| Módulos de autorización (7 + SYSTEM) | `src/lib/auth/context.ts:3` `accessModules` |
| Operaciones y permisos (73 entradas) | `src/lib/auth/operation-inventory.json` |
| Módulos con configuración propia | `src/lib/auth/action-guard.ts` `configurationModule` (lista literal) |
| Módulos del audit trail | `src/lib/audit/trail.ts:8` `auditTrailModules` |
| Menú principal | `src/components/app-shell.tsx:10-19` |
| Tarjetas del dashboard | `src/modules/dashboard/domain.ts` |
| Etiquetas visibles por tipo | `src/lib/qms/record-links.ts` `qmsRecordTypeLabel` |
| Codificación de negocio por tipo | `src/lib/qms/business-code.ts` (ramas por tipo) |
| Versionado transversal | `src/lib/qms/versioning.ts` (ramas por tipo) |
| Objetivos de Review | `src/lib/qms/review/targets/*` |
| Matriz de relaciones | `src/lib/qms/relation-rules.ts:31` `allowedRelations` |
| Precondiciones de relación por módulo | `src/lib/qms/relation-service.ts:154-175` (ramas AUDIT, COMPLAINT, RETURN) |

Consecuencia: incorporar un módulo exige localizar y modificar todos esos puntos sin que nada avise si se olvida uno. Las listas pueden divergir; por ejemplo, PNT está en `accessModules` y `auditTrailModules`, pero no en `QmsRecordType`.

## 3. Principios

1. **Composición, no tabla universal.** El contrato describe el módulo. No obliga a PNT, Auditorías o Devoluciones a compartir estados o tablas ajenas (D-071, D-072).
2. **Código tipado, no configuración en base de datos.** El contrato es un objeto TypeScript versionado en el repositorio, revisado por PR y cubierto por tests. No se crean tablas nuevas por previsión (D-072).
3. **Declarar antes que comportarse.** La primera versión solo traslada lo que ya existe. Cualquier cambio de comportamiento va en una PR separada con su decisión.
4. **Equivalencia demostrable.** Cada paso de migración incluye un test que compara lo derivado del registro con la lista literal que sustituye, antes de retirarla.
5. **Sin migración de datos.** `QmsRecord`, `QmsRelation`, versiones, snapshots, documentos, audit trail e históricos no se tocan.
6. **El servidor sigue mandando.** El contrato alimenta las validaciones de servidor existentes (`authorizedAction`, `createQmsRelation`); no las sustituye por comprobaciones de cliente.

## 4. Contenido del contrato (v1)

Esquema orientativo; los nombres definitivos se fijarán en la PR de implementación.

```ts
// src/modules/contract.ts (propuesto)
export type QmsModuleContract = {
  contractVersion: 1;
  key: AccessModule;                     // "DEVIATION", "CAPA", …, "PNT"
  recordType: QmsRecordType | null;      // null si no participa en QmsRecord (PNT hoy)
  labels: { singular: string; plural: string };
  navigation: { href: string; order: number; indicatorsHref?: string };
  access: { permissions: readonly AccessPermission[] };   // permisos que el módulo admite
  auditTrail: { participates: boolean };
  dashboard?: { card: boolean };
  relations?: { outgoing: readonly RelationRule[] };      // solo dirección canónica
  // Fases posteriores (no en v1): lifecycle, documents, kpi, review targets.
};

export type RelationRule = {
  target: QmsRecordType;
  type: QmsRelationType;                 // hoy solo GENERATES
  label: string;                         // "Desviación → CAPA"
  // Precondiciones propias del módulo, ejecutadas dentro de la transacción
  // de createQmsRelation. Trasladan las ramas actuales sin cambiarlas.
  guard?: (ctx: RelationGuardContext) => Promise<void>;
};
```

```ts
// src/modules/registry.ts (propuesto)
export const qmsModules = [deviationModule, capaModule, changeControlModule,
  complaintModule, returnModule, auditModule, pntModule] as const;
```

Los consumidores derivan sus listas del registro: `accessModules`, `auditTrailModules`, menú, tarjetas del dashboard, etiquetas y matriz de relaciones.

**Implementado en PR 2 (2026-10-16).** Al trasladar el código real se ajusta el esquema anterior:

- `src/modules/contract.ts` define `QmsModuleContract` v1 con `key`, `recordType`, `labels`, `href` y `relations.outgoing`. Es **solo datos**, importable desde cualquier capa. El resto de campos se añadirá en sus PR (3–5).
- Cada módulo declara su contrato en `src/modules/<módulo>/contract.ts`. El registro está en `src/modules/registry.ts`.
- La lógica de servidor no va en un `guard` por regla, sino en **hooks por módulo y papel** (`ModuleRelationHooks`: `asSource` / `asTarget`, con `beforeCreate`, `afterCreate`, `beforeDeactivate` y `afterDeactivate`). El código existente lo exige: Devoluciones actúa como **destino**, y Reclamaciones y Devoluciones refrescan snapshots **después** de escribir y también al desvincular.
- Los hooks viven en `src/modules/<módulo>/relation-hooks.ts` y se registran en `src/modules/relation-hooks-registry.ts`, separado del registro declarativo para que los contratos no arrastren dependencias de servidor. El servicio común ejecuta primero los del origen y después los del destino, el mismo orden que el código anterior.

**Invariantes comprobadas por test:**
- claves y `recordType` únicos;
- todo destino de relación es un módulo registrado con `recordType`;
- no hay relaciones duplicadas `(origen, destino, tipo)`;
- cada permiso declarado existe en `permissions`;
- cada operación de `operation-inventory.json` pertenece a un módulo registrado o a SYSTEM/QMS;
- la matriz derivada es idéntica a la vigente mientras no haya decisión que la cambie.

## 5. Relaciones entre módulos

### 5.1 Matriz vigente (no cambia con este diseño)

| Origen | Tipo | Destino | Decisión |
| --- | --- | --- | --- |
| Desviación | GENERATES | CAPA | D-018 |
| Reclamación | GENERATES | CAPA | D-018 |
| Reclamación | GENERATES | Devolución | D-018 |
| Auditoría | GENERATES | Desviación | D-065 |
| Auditoría | GENERATES | CAPA | D-065 |

Control de Cambios no participa en relaciones operativas en V1 (D-018, D-047). PNT no es `QmsRecord` y no puede relacionarse.

### 5.2 Cómo quedaría con el contrato

- Cada relación se declara **en el módulo de origen** (`relations.outgoing`), conservando la dirección canónica única (D-018, D-046). La vista inversa sigue derivándose.
- `relation-rules.ts` deja de tener la lista literal y la construye desde el registro. Sus funciones públicas (`canRelate`, `allowedOutgoingRelationTypes`, `allowedIncomingRelationTypes`, `validateQmsRelation`, `operationalRelationLabel`) conservan firma y comportamiento.
- Las ramas por módulo de `createQmsRelation` y `deactivateQmsRelation` (auditoría operativa y activa; bloqueo de versión de reclamación; devolución operativa y reclamación activa; refresco de snapshots) se trasladan a los hooks de cada módulo **sin cambiar su lógica ni el orden de bloqueos** (ver sección 4, «Implementado en PR 2»).
- La tabla `QmsRelation`, las relaciones existentes, la desvinculación/reactivación (D-046, D-047) y el audit trail de relaciones no cambian.
- Los tests actuales de `relation-rules.test.ts` y `relation-service.test.ts` (incluidos los casos bloqueados) deben pasar sin modificación.

### 4.1 Implementado en PR 3 (2026-10-16)

- Los contratos son **solo datos con imports de tipos**, sin enums de Prisma en tiempo de ejecución, para poder usarlos en componentes de cliente. Se añaden `indicatorsHref` y `recordType: null` para módulos sin `QmsRecord`.
- **PNT** entra en el registro (`src/modules/controlled-documents/contract.ts`) sin `recordType` ni relaciones (MC-3). `qmsRecordModules` y `qmsRecordTypes` agrupan solo los módulos con expediente.
- Se derivan del registro:
  - el menú principal (`src/components/app-shell.tsx`);
  - las tarjetas y opciones del dashboard (`DASHBOARD_MODULES`, `DASHBOARD_ALL_MODULES`);
  - la lista de módulos del audit trail (`auditTrailModules`);
  - las etiquetas de tipo (`qmsRecordTypeLabel`);
  - las dos listas literales de `src/lib/auth/action-guard.ts`.
- `accessModules` (`src/lib/auth/context.ts`) **se mantiene literal**, porque es la fuente del tipo `AccessModule` y del propio tipo de clave del contrato. Un test exige que coincida con el registro más `SYSTEM`.
- La página del audit trail conservaba sus etiquetas propias («Controles de Cambios», «PNT»). **Unificado después (2026-10-16):** su filtro de módulo usa `labels.plural` del registro, igual que el menú y el dashboard. Los títulos internos de las páginas de Control de Cambios mantienen «Controles de Cambios».

### 4.2 Implementado en PR 4 (2026-10-16)

- Cada contrato declara `permissions`: los permisos que el módulo admite. `systemPermissions` (registro) declara los de `SYSTEM` (configuración, usuarios y audit trail). `permissionsForModule(module)` los expone.
- `src/modules/permissions.test.ts` obtiene **de forma estática** los pares módulo/permiso que el código comprueba:
  - inventario de Server Actions y rutas; `QMS` cuenta para todos los módulos con expediente;
  - operaciones de ciclo de vida PNT de `route-guard.ts`;
  - `PermissionGate` en páginas y componentes de cada módulo, respetando `module="…"`;
  - llamadas literales a `assertPermission` y `canPresent`.
- El test exige que cada permiso comprobado esté declarado por su módulo, que los permisos específicos (`PNT_*`, `AUDIT_ISSUE_*`, `AUDIT_TRAIL_*`) solo pertenezcan a su módulo y que todo permiso de `permissions` tenga al menos un módulo. Se comprobó por mutación: quitar `GENERATE_DOCUMENT` de CAPA o `PNT_ACTIVATE` de PNT hace fallar el test.
- El mapa de segmentos de ruta de `page-guard.ts` se deriva del `href` de cada contrato (`qmsModuleByPathSegment`).
- **No cambia** la matriz de roles ni la validación del editor de roles, que sigue aceptando cualquier combinación módulo/permiso. Restringirla a `permissionsForModule` sería un cambio de comportamiento que requiere decisión propia.

### 4.3 Implementado en PR 5 (2026-10-16)

- Cada contrato declara `lifecycle`: el campo de estado principal, sus estados (los del enum Prisma, comprobado por test), las transiciones vigentes por operación y notas. Es **descriptivo**: documenta lo que el código admite hoy en servidor; no controla ni cambia ninguna transición.
- Las comprobaciones de estado que las acciones hacían en línea pasan a funciones puras, con el mismo resultado y los mismos mensajes:
  - `src/modules/lifecycle.ts`: `keepsOperationalStatus` (un expediente operativo no vuelve a Borrador; Desviaciones, CAPA, Controles de cambios, Reclamaciones y Devoluciones) y `acceptsFollowup` (seguimientos de CAPA y Controles de cambios);
  - `src/modules/audits/lifecycle.ts`: `auditStatusChangeError` y `auditAlreadyClosed`;
  - `src/modules/change-control/lifecycle.ts`: `followupFinalStatus`;
  - PNT: `revisionStatusAfter` (estado tras cada decisión) y `newRevisionStatus` (alta y registro histórico). La tabla de orígenes `assertTransition` y `validateManualChange` ya eran puras.
  - Se exportan `capaFollowupStatuses` y los mapeos de estado de las importaciones históricas de Desviaciones y CAPA.
- `src/modules/lifecycle.test.ts` compara, para **todas** las combinaciones origen → destino, la declaración de cada operación con su regla. Se comprobó por mutación: cambiar una regla, la tabla de PNT o una declaración hace fallar el test. Solo la importación de PNT queda sin regla pura (estado literal en el importador, cubierto por su smoke PostgreSQL).
- Única diferencia observable: en Auditorías, si un mismo guardado intenta volver a Borrador **y** llega con el formulario desactualizado, el mensaje que se muestra es el de Borrador. Antes era el de formulario desactualizado. En ambos casos se rechaza sin escribir.
- Hallazgos del mapeo que la declaración **documenta tal cual**, sin cambiarlos (cualquier cambio requiere decisión propia):
  - el servidor admite dar de alta directamente en Cerrada en Desviaciones, CAPA (también Cancelada), Controles de cambios, Reclamaciones y Devoluciones; Auditorías lo impide;
  - Cerrada → Abierta: CAPA, Controles de cambios y Devoluciones no crean versión de reapertura; Desviaciones y Reclamaciones solo si se guarda como nueva versión; Auditorías no reabre;
  - CAPA Cancelada → Abierta o Cerrada está admitido, y cancelar desde la ficha no exige motivo (el seguimiento sí, pero su formulario no está enlazado en la interfaz);
  - en servidor, Desviaciones, CAPA, Controles de cambios y Reclamaciones admiten editar un expediente anulado (ni la página de edición ni la acción lo comprueban); Devoluciones y Auditorías lo impiden.
- **Corrección de seguridad incluida:** la comprobación de permiso de cierre del servidor solo miraba el campo `status`, y Reclamaciones envía el estado en `saveStatus`. Un usuario con permiso de edición sin permiso de cierre podía cerrar una reclamación con una petición directa. `action-guard.ts` comprueba ahora también `saveStatus`, con su test.

### 5.3 Ampliar una relación en el futuro

Requiere una decisión en `DECISIONS.md` y una PR que añada una línea en el contrato del módulo de origen, su `guard` si procede y sus tests positivos y negativos. No requiere migración ni tocar el servicio común.

### 5.4 Incoherencia detectada (corregida en la PR 2-bis)

La ficha de Control de Cambios muestra la pestaña Relaciones con un formulario de alta (`src/app/changes/[id]/page.tsx`, `addChangeControlRelationAction` en `src/modules/change-control/actions.ts:1129`). El formulario ofrece los cuatro tipos (`RELATED_TO` por defecto, `GENERATES`, `IMPLEMENTED_BY`, `ASSOCIATED_WITH`), pero como la matriz no admite ninguna relación de Control de Cambios, **cualquier intento termina en error** «Relación no permitida». No había riesgo de datos, pero sí confusión de uso. **Corregido en la PR 2-bis (2026-10-16):** se retiran el formulario, `addChangeControlRelationAction` y su entrada en `operation-inventory.json` y en `action-boundary.ts`. La pestaña conserva la consulta de relaciones existentes y una nota de que Control de Cambios no admite relaciones operativas en V1.

## 6. Plan de migración propuesto

Cada paso es una PR independiente, sin cambio visible, con lint, tests, Prisma validate, build y la batería CI completa.

| PR | Alcance | Criterio de aceptación |
| --- | --- | --- |
| **1 (esta)** | Diseño y decisiones MC-1 a MC-4 | Aprobado en D-083 |
| **2 (implementada)** | `contract.ts` + `registry.ts` con identidad, etiquetas y **relaciones** de los 6 módulos `QmsRecord`; `relation-rules.ts` y el servicio de relaciones derivan del registro y de los hooks de módulo | Test de equivalencia de matriz; tests existentes de relaciones sin cambios; smoke de relaciones PostgreSQL verde |
| **2-bis (implementada)** | MC-2 y MC-4 etapa 1: retirar el formulario de alta de relaciones de Control de Cambios y los tipos sin uso del código de aplicación | Consulta de relaciones conservada; test de que la acción ya no existe en el inventario; regresión de Control de Cambios verde |
| **3 (implementada)** | Menú, tarjetas del dashboard, etiquetas, `accessModules` y `auditTrailModules` derivados del registro; PNT registrado con `recordType: null` | Tests de equivalencia de listas; regresión UI Chromium sin diferencias visuales |
| **4 (implementada)** | Permisos admitidos por módulo y comprobación cruzada con `operation-inventory.json` | Test de inventario ampliado; sin cambios en la matriz de roles |
| **5 (implementada)** | Ciclo de vida **descriptivo**: estados y transiciones vigentes declarados, verificados contra el comportamiento actual por test, sin pasar aún a controlarlos | Test que recorre las transiciones reales y las compara con la declaración |
| **MC-4 etapa 2 (implementada)** | Retirar tipos del enum Prisma con migración protegida | Migración falla si hay filas con esos tipos; fixtures y pruebas de audit trail adaptadas |
| Posterior | Documentos/plantillas, KPI, objetivos de Review; después, módulos nuevos sobre el contrato | Según decisión y alcance aprobados |

**Reversión:** cada PR de migración mantiene la lista literal sustituida hasta que su test de equivalencia pasa en CI; revertir la PR restaura el estado anterior sin efecto en datos.

### Qué seguirá necesitando un módulo nuevo

Aun con contrato: su búsqueda para el buscador global (`src/modules/<módulo>/search.ts`, registrada en `src/modules/search-registry.ts`; un test exige que exista para cada módulo registrado), modelo Prisma y migración propios, nuevo valor en `QmsRecordType` si participa en relaciones, sus pantallas, acciones de servidor, entradas en `operation-inventory.json`, registro en la captura de audit trail y pruebas. El contrato elimina la edición dispersa de listas transversales, no el trabajo de dominio ni la validación proporcional del cambio.

## 7. Fuera de alcance

- Flujos de aprobación, motor de workflow, firma electrónica (D-073, D-074).
- Cambiar estados, cierres, editabilidad o reglas de cualquier PNT/módulo.
- Ampliar o reducir la matriz de relaciones.
- Configuración de módulos desde la interfaz o en base de datos.
- Convertir PNT en `QmsRecord` (ver MC-3).
- Cualquier cambio de datos, migración o activación productiva.

## 8. Riesgos y mitigaciones

| Riesgo | Mitigación |
| --- | --- |
| Cambiar sin querer la matriz de relaciones o un permiso | Tests de equivalencia contra las listas literales antes de retirarlas |
| Alterar el orden de bloqueos en `createQmsRelation` | Trasladar los guards sin reescribirlos; tests de concurrencia y smoke PostgreSQL existentes |
| Abstracción prematura | v1 limitada a identidad, navegación y relaciones; el resto, por fases y solo con necesidad demostrada |
| Ciclos de import entre módulos y registro | Contratos sin dependencias de UI; guards cargados de forma diferida como hoy |
| Impacto en audit trail | Sin cambios en escrituras ni en el inventario de escritores; las relaciones se siguen creando por el mismo servicio |

## 9. Decisiones del responsable del proyecto (D-083, 2026-10-16)

- **MC-1 — Aprobado.** Diseño y plan de PR 2–5. Cada PR mantiene su propia aprobación de alcance.
- **MC-2 — Control de Cambios sin relaciones.** Se mantiene fuera de las relaciones operativas (D-018, D-047). Se retirará el formulario de alta de la pestaña Relaciones en una PR acotada, conservando la consulta de relaciones existentes y sin borrar datos.
- **MC-3 — PNT: necesidad futura.** No se incorpora PNT a `QmsRecord` ni se amplía la matriz por ahora. El contrato ya admite `recordType: null` para PNT, de modo que la incorporación futura sea un cambio localizado con su decisión e impacto propios.
- **MC-4 — Retirar los tipos sin uso, por etapas.**
  1. Junto con MC-2: quitar `RELATED_TO`, `IMPLEMENTED_BY` y `ASSOCIATED_WITH` de la interfaz y del código de aplicación (`src/app/changes/[id]/page.tsx`, `addChangeControlRelationAction`, `src/lib/qms/relations.ts`). **Hecho en la PR 2-bis:** `relations.ts` era código sin uso fuera de su propio test y se elimina junto con él. Los tipos siguen en el enum Prisma hasta la etapa 2.
  2. PR propia posterior: retirarlos del enum Prisma con una migración que se detenga si existe alguna fila que los use. Antes hay que adaptar las fixtures y pruebas que hoy los escriben directamente: `scripts/phase3b1-fixtures.ts:69`, `scripts/smoke-phase4b3-b2-capture.ts` (operación DV08) y `scripts/audit-fixtures/operational-actions-capture.test.ts:428-438`. **Hecho:** migración `20261016000200_retire_unused_relation_types`, que aborta sin cambios si alguna relación (activa o inactiva) usa los tipos retirados y deja `GENERATES` como único valor. Las fixtures usan `GENERATES`; la prueba de `operational-actions-capture` ya se había adaptado en la PR 2-bis.
