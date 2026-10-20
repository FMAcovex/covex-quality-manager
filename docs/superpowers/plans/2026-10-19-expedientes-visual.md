# Mejoras visuales de expedientes e inicio · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que estado, fechas y apartados de cada expediente se reconozcan de un vistazo y que el inicio muestre primero las tareas del usuario, sin cambiar datos, flujos ni funcionalidades.

**Architecture:** cuatro PR independientes (V1–V4) sobre la rama `claude/trusting-rubin-vq424k`; tras fusionar cada una se reinicia la rama desde `main`. Componentes compartidos nuevos en `src/components/`, lógica pura con pruebas en `src/lib/qms/`, y el resto, CSS en `globals.css` y cambios de maquetación en las páginas `src/app/<módulo>/[id]/page.tsx`.

**Tech Stack:** Next.js 15 (App Router, componentes de servidor y cliente), React 19, vitest, pruebas de navegador con tsx y Playwright.

**Spec:** `docs/superpowers/specs/2026-10-19-expedientes-visual-design.md`

## Global Constraints

- Solo presentación: no se quita ningún dato, campo, pestaña de información, flujo ni permiso. Sin migraciones, sin acciones de servidor nuevas y sin cambios en `operation-inventory.json`.
- Lenguaje visual corporativo (D-070): mismos colores, tipografía, tarjetas y chips. Nada de paletas nuevas.
- Formularios: mismos campos, orden, validaciones y guardado explícito.
- Prioridad escritorio (1440 px); en 390 px, nada roto y sin desbordamiento horizontal.
- Desviaciones: descripción, acciones inmediatas, investigación, impacto, causa raíz, CAPA y conclusión siguen siendo bloques con su título.
- Antes de cada commit: `git checkout -- next-env.d.ts`. Antes de cada PR: lint, tsc, vitest, build, inventarios del audit trail regenerados si cambian y los grupos de navegador afectados en una base de pruebas nueva.
- Cada PR lleva capturas antes y después a 1440 y 390 px. Se generan con `tmp-verify/shot-records.ts` contra la demo `covex_demo`, y no se suben al repositorio.

## Review Focus

1. **Expediente anulado:** el banner de anulado sigue visible bajo la cabecera y el botón «Anular» no aparece. Se prueba en V1, Tarea 2.
2. **Usuario sin permiso EDIT o REVIEW:** la cabecera no deja huecos ni separadores sueltos cuando faltan acciones. Se prueba en V1, Tarea 2.
3. **Plazo en expediente cerrado:** no se colorea como vencido. Se prueba en V1, Tarea 1.
4. **Enlace antiguo `?tab=investigation&review=1&thread=…`:** sigue abriendo el hilo de revisión sobre la causa raíz. Se prueba en V3, Tarea 8.
5. **Formulario con un error de validación al guardar:** el índice lateral no se duplica ni pierde las anclas al volver a pintarse. Se prueba en V2, Tarea 6.

---

## V1 — Cabecera y resumen (PR 1)

### Task 1: Datos clave y su tono

**Files:**
- Create: `src/lib/qms/key-facts.ts`, `src/lib/qms/key-facts.test.ts`, `src/components/record-key-facts.tsx`, `src/components/empty-value.tsx`
- Modify: `src/app/globals.css`, en un bloque nuevo «Datos clave del expediente» tras `.info-grid` (línea 226 aprox.)

**Interfaces:**
- Produces:
  - `dueTone(due: Date | null | undefined, today: Date, closed: boolean): "overdue" | "upcoming" | null`. Usa `classifyDue` de `src/modules/dashboard/domain.ts` con su horizonte de 30 días.
  - `type KeyFact = { label: string; value: React.ReactNode; tone?: "overdue" | "upcoming" | null; badgeClass?: string }`
  - `<RecordKeyFacts facts={KeyFact[]} />`: `section.card.record-key-facts` > `dl` > `div.key-fact(.is-overdue|.is-upcoming)` > `dt` + `dd`.
    - Con `badgeClass`, el valor va en `span.badge.<badgeClass>`.
    - Si el tono es vencido o próximo, se añade tras la fecha `small.key-fact-flag` con «Vencido» o «Próximo».
    - Un valor vacío (`null`, `undefined` o `""`) se muestra con `<EmptyValue/>`.
  - `<EmptyValue/>`: `<span className="empty-value">—</span>`.

- [ ] **Step 1: Pruebas que fallan** (`key-facts.test.ts`):
  - `dueTone(new Date("2026-10-18"), new Date("2026-10-19"), false)` es `"overdue"`;
  - `dueTone(new Date("2026-11-10"), new Date("2026-10-19"), false)` es `"upcoming"`;
  - `dueTone(new Date("2026-12-31"), new Date("2026-10-19"), false)` es `null`;
  - `dueTone(new Date("2026-10-01"), new Date("2026-10-19"), true)` es `null` (cerrado);
  - `dueTone(null, …)` es `null`.
- [ ] **Step 2:** `env -i PATH=$PATH HOME=$HOME pnpm exec vitest run src/lib/qms/key-facts.test.ts` falla porque el módulo no existe.
- [ ] **Step 3: Implementar** `dueTone`, `RecordKeyFacts`, `EmptyValue` y el CSS:
  - **Rejilla:** `.record-key-facts dl` con 6 columnas a 1200 px o más, 3 por debajo y 2 por debajo de 760 px.
  - **Texto:** `dt` como las etiquetas de `.info-item`; `dd` en 18 px y peso 700.
  - **Tonos:** con los tokens existentes de rojo y ámbar de `.badge.critical` y `.badge.warning`.
  - **Vacíos:** `.empty-value` en `var(--muted)`, peso normal.
- [ ] **Step 4:** la prueba pasa.
- [ ] **Step 5: Commit** «feat(ux): datos clave del expediente y tono de plazos».

### Task 2: Cabecera común en los 8 módulos

**Files:**
- Create: `src/components/record-header.tsx`, `src/lib/qms/record-title.ts`, `src/lib/qms/record-title.test.ts`
- Modify:
  - `src/components/qms-administrative-status.tsx`;
  - las páginas de detalle de los 8 módulos: `src/app/{deviations,capa,changes,complaints,returns,oos,audits,controlled-documents}/[id]/page.tsx`;
  - `src/app/globals.css`: `.record-actions` y la regla `.record-header + .button.danger` de la línea 1697 aprox., que se retira.

**Interfaces:**
- Produces:
  - `<RecordHeader back={{ href: string; label: string }} title: React.ReactNode chips?: React.ReactNode subtitle?: React.ReactNode annul?: React.ReactNode actions?: React.ReactNode />`. Pinta:
    - `div.record-header`: `p.eyebrow` con el enlace de vuelta, `div.record-title-line` con `h1` y los chips, y `p.muted-note` con la línea secundaria;
    - `div.record-actions` con `annul` y después `actions`, más un separador `span.record-actions-divider` solo si existen los dos.
  - `QmsAdministrativeStatus` gana la prop `part?: "action" | "banner"`. Por defecto pinta ambas partes, como hoy:
    - `"action"`: solo el botón «Anular expediente» y su modal, nada si está anulado;
    - `"banner"`: solo `.annulled-record-banner`, nada si está activo.
  - `draftRecordTitle(text: string | null | undefined, fallback: string): string`: el texto en una línea (espacios colapsados), recortado a 90 caracteres con «…»; si está vacío, `fallback`.
- **Orden en `actions`**, igual en todos los módulos: `ReviewModeToggle` → acciones propias (Auditorías: `AuditCloseNavigation`) → «Editar…» (`button.primary`), siempre la última.
- **Títulos de borrador:**
  - Desviación: `draftRecordTitle(materialProcessAffected || whatHappened, "Sin codificación")`;
  - CAPA: `draftRecordTitle(defectDescription, "CAPA sin código")`.
  - En ambos, `chips` añade `span.badge.neutral` «Borrador · sin código» en lugar del chip «Borrador».

- [ ] **Step 1: Pruebas que fallan** (`record-title.test.ts`):
  - `draftRecordTitle("  Alarma\n de  cámara ", "x")` es `"Alarma de cámara"`;
  - un texto de 120 caracteres da 90 caracteres terminados en «…»;
  - `draftRecordTitle("", "CAPA sin código")` es `"CAPA sin código"`.
- [ ] **Step 2:** la prueba falla.
- [ ] **Step 3: Implementar** `draftRecordTitle`, `RecordHeader` y la prop `part`. Después, sustituir la cabecera escrita a mano de las 8 páginas:
  - `<RecordHeader annul={<QmsAdministrativeStatus … part="action"/>} …/>`, seguido de `<QmsAdministrativeStatus … part="banner"/>`;
  - los avisos de borrador (`.analytics-note`) quedan después del banner;
  - en Documentación controlada no hay `annul`: «Volver al listado» pasa a ser el enlace `back` y sus acciones van en `actions`.
- [ ] **Step 4: CSS.**
  - `.record-actions`: `display:flex; gap:10px; align-items:center; flex-wrap:wrap`.
  - `.record-actions .button.danger`: contorno (fondo transparente, borde y texto del rojo de peligro actual).
  - `.record-actions-divider`: 1 px × 24 px en `var(--border)`.
- [ ] **Step 5: Comprobar** la prueba unitaria, `pnpm exec tsc --noEmit` y las pruebas de navegador que tocan la cabecera, en una base nueva con `run-r5a.sh`: `phase3b1:ui:smoke`, `audits-r3a:ui:smoke`, `phase4b1:permissions:ui:smoke` (el nombre exacto está en `package.json`) y `oos:ui:smoke`.
  - En `smoke-audits-r3a-ui.ts`, añadir: en una auditoría anulada, `.annulled-record-banner` es visible y `getByRole('button',{name:'Anular expediente'})` cuenta 0.
  - En `smoke-phase4b1-permissions-ui.ts`, con el perfil de solo lectura: `.record-actions-divider` cuenta 0.
- [ ] **Step 6: Commit** «feat(ux): cabecera común de expedientes».

### Task 3: Franja de datos clave en los 8 resúmenes

**Files:**
- Modify: las 8 páginas de detalle, como primer elemento de la pestaña Resumen o Información.

**Interfaces:**
- Consumes: `RecordKeyFacts`, `KeyFact`, `dueTone` (Tarea 1).
- **Hoy:** `new Date()` (el día se normaliza en `classifyDue`). `closed` es el estado cerrado o cancelado del módulo.

**Datos por módulo** (el estado reutiliza la función de color de la cabecera de cada módulo):

| Módulo | `facts` (etiqueta → valor) |
|---|---|
| Desviaciones | Estado · Apertura `issueDate` · Plazo `deadlineLabel(deadlineStatus)` · Clasificación · Departamento `departmentCodeSnapshot` · Cierre `closedAt` |
| CAPA | Estado · Eficacia · Apertura `openedAt` · Próximo seguimiento `nextFollowupDate` (tono) · Cierre operativo `operationalClosedAt` · Cierre efectivo `effectiveClosedAt` |
| Cambios | Estado funcional (`functionalStatusTone`) · Solicitud `requestDate` · Implantación prevista `plannedImplementationDate` (tono) · Dictamen `dictamenDate` · Responsable del seguimiento · Cierre |
| Reclamaciones | Situación (`complaintOperationalSituationTone`) · Apertura `openedAt` · Próximo seguimiento `nextFollowupDate` (tono) · Respuesta `responseDate` · Cierre `closedAt` |
| Devoluciones | Estado · Comunicación `communicationDate` · Recepción `receivedAt` · Decisión `decisionDate` · Cierre `closedAt` |
| OOS | Estado (`statusBadge`) · Fecha del OOS `oosDate` · Apertura `issueDate` · Detectado por `detectedBy` · Cierre `closedAt` |
| Auditorías | Estado (`auditStatusBadgeClass`) · Situación `auditSituation(...)` (el mismo valor de la ficha) · Prevista `plannedDate` · Realizada `performedDate` · Escenario · Cierre `closedAt` |
| Documentación controlada | Estado (`DocumentStateBadge`) · Revisión vigente · Vigente desde `effectiveFrom` · Próxima revisión `reviewDueAt` (tono) · Departamento |

Las fechas se formatean con el formateador que ya usa cada página.

- [ ] **Step 1: Prueba de navegador que falla.** En un script nuevo `scripts/smoke-ux-v1-ui.ts` (`pnpm ux-v1:ui:smoke`, añadido al grupo `browser-qms` de `.github/ci-suites.json`), para un expediente sintético de cada uno de los 8 módulos creado con Prisma:
  - `.record-key-facts .key-fact` es al menos 4;
  - el primer `dd` contiene un `.badge`;
  - una CAPA con `nextFollowupDate` de ayer tiene `.key-fact.is-overdue` con el texto «Vencido»;
  - una cerrada con la misma fecha no lo tiene.
- [ ] **Step 2:** la prueba falla (no existe la franja).
- [ ] **Step 3: Implementar** las 8 franjas según la tabla.
- [ ] **Step 4:** pasa `ux-v1:ui:smoke` y siguen pasando los grupos `browser-qms` y `browser-audits` en una base nueva.
- [ ] **Step 5: Commit** «feat(ux): franja de datos clave en los resúmenes».

### Task 4: Campos homogéneos, vacíos atenuados, móvil, documentación y PR

**Files:**
- Modify:
  - `src/app/globals.css`:
    - `.audit-info-field` (línea 2533 aprox.): sin borde ni padding de caja, con el aspecto de `.info-item`;
    - `.audit-detail-grid`: cuatro columnas como `.info-grid`;
    - `.record-tabs`: por debajo de 760 px, `flex-wrap:nowrap; overflow-x:auto`;
    - menú principal: desplazable con degradado al borde por debajo de 760 px.
  - Las 8 páginas de detalle: en Resumen e Información, los `"—"` de vacío pasan a `<EmptyValue/>`. Los textos de vacío con palabras («Sin clasificar», «No informada») no se tocan.
  - Documentación: `docs/DECISIONS.md` (D-111, «Mejoras visuales de expedientes»: decisión, alcance V1–V4 y límites) y `docs/CURRENT_STATUS.md` (entrada V1).

- [ ] **Step 1:** en `smoke-ux-v1-ui.ts`, a 390 px:
  - `document.documentElement.scrollWidth <= innerWidth + 1` en los 8 expedientes;
  - `.record-tabs` con `scrollWidth > clientWidth` en Desviaciones (una sola fila).
- [ ] **Step 2:** la prueba falla (hoy las pestañas ocupan varias filas).
- [ ] **Step 3: Implementar** el CSS y `EmptyValue`.
- [ ] **Step 4: Validación completa:**
  - lint, tsc, vitest y build;
  - en una base nueva: los grupos de navegador `browser-qms` y `browser-audits` y `ux-v1:ui:smoke`;
  - capturas antes/después a 1440 y 390 px de los 8 módulos con `tmp-verify/shot-records.ts`.
- [ ] **Step 5:** revisión final del diff con un subagente, correcciones y commit. Después, PR «Expedientes V1: cabecera y datos clave», suscripción a la PR y comprobación programada.

---

## V2 — Índice lateral en formularios (PR 2)

### Task 5: Anclas e índice

**Files:**
- Create: `src/lib/ui/section-anchor.ts`, `src/lib/ui/section-anchor.test.ts`, `src/components/section-index.tsx` (cliente), `src/components/form-with-index.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Produces:
  - `sectionAnchorId(title: string, used: Set<string>): string`: `apartado-` más el título en minúsculas, sin tildes y con no alfanuméricos → `-`, recortado a 60. Si el id ya está en `used`, añade `-2`, `-3`… y lo registra en `used`.
  - `<SectionIndex targetId: string label?: string />`:
    - **Arranque:** en `useEffect`, toma `document.getElementById(targetId)`, sus `section.form-section, section.card` que no estén dentro de otra sección de esa misma lista, y el primer `h2` de cada una.
    - **Anclas:** a la sección sin `id` le asigna `sectionAnchorId(h2.textContent)`.
    - **Pinta:** `nav.section-index[aria-label=label ?? "Apartados del formulario"]` > `ol` > `li` > `a[href="#id"]`. El activo se marca con `IntersectionObserver` (`rootMargin: "-120px 0px -60% 0px"`) como `aria-current="true"`.
    - **Al pulsar:** `scrollIntoView({behavior:"smooth", block:"start"})` y `history.replaceState` con el ancla.
    - **Repintado:** vuelve a calcular las secciones cuando cambian los hijos del contenedor (`MutationObserver`, `childList` y `subtree`), sin duplicar entradas.
  - `<FormWithIndex id: string children />`: `div.form-with-index` > (`<SectionIndex targetId={id}/>` + `div#{id}.form-with-index-body` con `children`).
- **CSS:**
  - `.form-with-index`: a 1200 px o más, `grid-template-columns: 220px minmax(0,1fr); gap:28px`; por debajo, `display:block` y `.section-index { display:none }`.
  - `.section-index`: `position:sticky; top: calc(var(--topbar-height, 104px) + 16px)`. Si existe la variable de la barra superior fija (`globals.css:45-57`), se usa; si no, el valor fijo de 104 px.
  - Enlaces activos con el estilo de `.record-tabs a.active`.

- [ ] **Step 1: Pruebas que fallan** (`section-anchor.test.ts`):
  - `sectionAnchorId("E. Investigación", new Set())` es `"apartado-e-investigacion"`;
  - con `"apartado-e-investigacion"` ya en `used` da `"apartado-e-investigacion-2"`;
  - `"F-G. Causa raíz"` da `"apartado-f-g-causa-raiz"`.
- [ ] **Step 2:** fallan.
- [ ] **Step 3: Implementar** `sectionAnchorId`, `SectionIndex`, `FormWithIndex` y el CSS.
- [ ] **Step 4:** pasan las pruebas y tsc.
- [ ] **Step 5: Commit** «feat(ux): índice lateral de apartados».

### Task 6: Índice en los 8 formularios, pruebas y PR

**Files:**
- Modify: las páginas de alta (`new/page.tsx`) y edición (`[id]/edit/page.tsx`) de los 8 módulos. El componente de formulario se envuelve en `<FormWithIndex id="record-form-body">`, sin tocar el formulario.
  - En Desviaciones, `.form-page` tiene `max-width:1250px`. Con índice se amplía a `1500px` solo cuando contiene `.form-with-index` (`.form-page:has(.form-with-index)`).
- Modify: `scripts/smoke-ux-v1-ui.ts` (o un nuevo `scripts/smoke-ux-v2-ui.ts` en `browser-qms`). DECISIONS D-111 (V2) y CURRENT_STATUS.

- [ ] **Step 1: Prueba de navegador que falla.** En la edición de una desviación a 1440 px:
  - `nav.section-index a` incluye «E. Investigación»;
  - al pulsarlo, el `h2` «E. Investigación» queda en el viewport (`boundingBox().y` entre 0 y 400);
  - el `nav` sigue visible tras desplazarse.

  Sobre el Review Focus 5:
  - guardar el formulario con un campo obligatorio vacío, para que vuelva con error;
  - comprobar que el número de enlaces del índice no cambia y que los `id` siguen siendo únicos.

  En los otros 7 formularios, `nav.section-index a` es al menos 2 a 1440 px y no existe a 390 px.
- [ ] **Step 2:** falla.
- [ ] **Step 3: Implementar** los envoltorios en las 16 páginas.
- [ ] **Step 4: Validación completa:**
  - en una base nueva, los grupos `browser-qms`, `browser-audits` y `records-r4c` (formularios), y `pnt` para Documentación controlada;
  - capturas de los formularios a 1440 px.
- [ ] **Step 5:** revisión final, PR «Expedientes V2: índice lateral en formularios», suscripción y comprobación programada.

---

## V3 — Pestaña única «Desviación» (PR 3)

### Task 7: Claves de pestaña y compatibilidad

**Files:**
- Create: `src/modules/deviations/detail-tabs.ts`, `src/modules/deviations/detail-tabs.test.ts`
- Modify:
  - `src/lib/qms/list-return-navigation.ts:48`: añadir `deviation`. Las claves antiguas se mapean a `deviation` con `legacyDeviationTab`.
  - `src/lib/qms/review/targets/deviations.ts`: `tabKey` de description, investigation, actions y conclusion → `"deviation"`. Las anclas de campo no cambian.
  - `src/lib/qms/review/targets/deviations.test.ts:26,33`: espera `tabKey: "deviation"`.
  - `src/modules/dashboard/assigned-query.ts:89`: `?tab=deviation#desviacion-acciones`.

**Interfaces:**
- Produces:
  - `deviationPartAnchors = { description: "desviacion-descripcion", investigation: "desviacion-investigacion", actions: "desviacion-acciones", conclusion: "desviacion-conclusion" } as const`
  - `legacyDeviationTab(tab: string | undefined): { tab: "deviation"; anchor: string } | null`: devuelve el ancla de `deviationPartAnchors` para las cuatro claves antiguas y `null` para el resto.

- [ ] **Step 1: Pruebas que fallan:**
  - `legacyDeviationTab("investigation")` es `{ tab:"deviation", anchor:"desviacion-investigacion" }`;
  - `legacyDeviationTab("relations")` es `null`;
  - `deviations.test.ts` con `tabKey: "deviation"`;
  - la vuelta tras editar desde `?tab=actions` lleva a `tab=deviation` (en la prueba de `list-return-navigation`, si existe; si no, una nueva en `list-return-navigation.test.ts`).
- [ ] **Step 2:** fallan.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4:** pasan vitest y tsc.
- [ ] **Step 5: Commit** «feat(desviaciones): claves de la pestaña Desviación».

### Task 8: Pestaña «Desviación», pruebas y PR

**Files:**
- Modify:
  - `src/app/deviations/[id]/page.tsx`:
    - **Pestañas** (`:60-73`): las claves description, investigation, actions y conclusion se sustituyen por `deviation`, con la etiqueta «Desviación», en la segunda posición.
    - **Contenido:** los cuatro bloques actuales (`:414-564`) se pintan juntos, sin cambiar sus tarjetas, dentro de `<FormWithIndex id="deviation-parts" …>`. Si `FormWithIndex` lleva una etiqueta fija, se le añade la prop `label` y se pasa «Apartados de la desviación». Cada bloque va en `section.card-group.deviation-part#<ancla>`, con una cabecera `h2.deviation-part-title` («Descripción», «Investigación», «Acciones», «Conclusión»).
    - **Índice:** `SectionIndex` busca `section.form-section, section.card`. Para que muestre los cuatro apartados, las secciones `.deviation-part` llevan también la clase `form-section` (sin sus estilos de formulario, que se anulan con `.deviation-part.form-section`). Así el índice lista los cuatro apartados, no cada tarjeta.
    - **Redirección:** al principio de la página, si `legacyDeviationTab(tab)` no es nulo, `redirect()` a la misma URL con `tab=deviation`, el resto de parámetros (`review`, `thread`…) y `#` + el ancla.
  - `src/app/globals.css`:
    - `.deviation-part` con margen superior de 36 px;
    - `.deviation-part-title` en 22 px, peso 700, con `border-left: 4px solid var(--primary)` y `padding-left: 12px`.
  - `scripts/smoke-review-comments-r2b1.ts:49,67`: la URL pasa a `?tab=deviation&review=1&thread=…#review-deviation-root-cause`. Se añade otra prueba que abre la URL antigua y espera el mismo hilo.
  - Docs: D-111 (V3) y CURRENT_STATUS.

- [ ] **Step 1: Prueba de navegador que falla** (`scripts/smoke-ux-v3-ui.ts`, en `browser-qms`):
  - la ficha de una desviación tiene 9 pestañas y una se llama «Desviación»;
  - en `?tab=deviation` están los `h2.deviation-part-title` «Descripción», «Investigación», «Acciones», «Conclusión» y los títulos de tarjeta «Descripción del evento», «Causa raíz», «Evaluación de impacto», «Acciones inmediatas», «CAPA propuestas» y «Conclusión y disposición»;
  - `?tab=investigation` termina en `tab=deviation` y `#desviacion-investigacion`;
  - el índice lateral tiene 4 enlaces.
- [ ] **Step 2:** falla.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Validación completa:**
  - en una base nueva, los grupos `browser-qms` (incluidas `review-r2b1`, `phase3b1-ui` y `ux-c3`) y `postgresql`;
  - capturas de la pestaña a 1440 px.
- [ ] **Step 5:** revisión final, PR «Expedientes V3: pestaña Desviación», suscripción y comprobación programada.

---

## V4 — Inicio con «Mis tareas» primero (PR 4)

### Task 9: Bloque «Mis tareas», pruebas y PR

**Files:**
- Modify:
  - `src/app/page.tsx`. Se extrae la tabla de asignadas (hoy dentro del bloque `mine`, `:215-238`) a una sección propia `section#dashboard-my-tasks.dashboard-section`:
    - **Posición:** inmediatamente después de la barra de «Filtros» y antes de la fila «Requiere atención».
    - **Encabezado:** `eyebrow` «Tu trabajo», `h2` «Mis tareas», el resumen de vencidas y próximas, y la misma nota.
    - **Contenido:** la misma tabla, ordenada como ya la devuelve `getAssignedItems` (vencidas, próximas, pendientes) y paginada de 15 en 15 con el paginador actual.
    - **Vacío:** «No tienes tareas asignadas.»
  - La tarjeta «asignadas a mí» enlaza a `#dashboard-my-tasks`, conservando la consulta actual.
  - La sección `#dashboard-tasks` muestra siempre «Plazos vencidos y próximos». El valor `tasks=mine` del filtro sigue siendo válido y ya no sustituye esa lista.
  - CSS: los estilos de tabla actuales; solo el espaciado de la sección nueva.
  - Docs: D-111 (V4) y CURRENT_STATUS.

- [ ] **Step 1: Prueba que falla.** En `scripts/smoke-assigned-d102.ts`, o en un nuevo `scripts/smoke-ux-v4-ui.ts` en `browser-qms` si la anterior no es de navegador, abrir `/` sin parámetros con un usuario con una tarea vencida:
  - `#dashboard-my-tasks` es visible;
  - es el primer `section.dashboard-section` de `main`;
  - contiene la fila de la tarea con el badge «Vencida»;
  - con un usuario sin tareas aparece «No tienes tareas asignadas.»
- [ ] **Step 2:** falla.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Validación completa:**
  - en una base nueva, `browser-qms` y la prueba D-102;
  - capturas del inicio a 1440 y 390 px.
- [ ] **Step 5:** revisión final, PR «Inicio: Mis tareas primero», suscripción y comprobación programada.
