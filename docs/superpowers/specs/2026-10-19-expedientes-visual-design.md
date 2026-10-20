# Mejoras visuales de los expedientes y del inicio — diseño

Fecha: 2026-10-19. Estado: **aprobado por el responsable de Calidad el 2026-10-19** (V4 sin selector de departamento).

Origen: comentario de IT (los expedientes recogen mucha información y está poco señalizada en los resúmenes), propuestas del responsable de Calidad y propuestas de revisión visual acordadas en la conversación del 2026-10-19.

## 1. Objetivo y límites

**Objetivo.** Que un usuario de departamento que consulta un expediente vea de un vistazo **estado y fechas**, y reconozca cada apartado. También debe ver nada más entrar sus tareas vencidas, próximas y pendientes.

**Límites (obligatorios en todas las PR):**
- **Solo presentación.** No se quita ningún dato, campo, pestaña de información, flujo ni permiso. No se añaden funcionalidades, campos, estados ni reglas. Sin migraciones.
- Se mantiene el **lenguaje visual corporativo** (D-070): colores, tipografía, tarjetas, chips y navegación principal. Es una mejora, no un rediseño.
- **Formularios:** el **guardado sigue siendo explícito**. Los campos, su orden y sus validaciones no cambian.
- **Documentos controlados** (anexos, plantillas) sin cambios.
- **Prioridad: escritorio** (1440 px). En móvil (390 px), solo arreglos baratos y que nada se rompa.
- **Separación de contenidos de las desviaciones** (AGENTS.md): descripción, acciones inmediatas, investigación, impacto, causa raíz, CAPA y conclusión siguen siendo bloques distintos con su título.

**Criterio de aceptación común:**
- capturas antes/después a 1440 px (y una a 390 px) de cada módulo afectado;
- las pruebas de navegador de los grupos de CI en verde, ajustando solo selectores de presentación, nunca lo que comprueban;
- sin errores de JavaScript ni de hidratación.

## 2. Entregas

Cuatro PR, en este orden; cada una se puede revisar y fusionar por separado.

| PR | Contenido | Módulos |
|---|---|---|
| **V1** | Cabecera unificada, franja de datos clave en el resumen, estilo de campos común, vacíos atenuados y arreglos baratos de móvil | Los 8 (Desviaciones, CAPA, Cambios, Reclamaciones, Devoluciones, Auditorías, OOS, Documentación controlada) |
| **V2** | Índice lateral de apartados en los formularios de alta y edición | Los 8 formularios principales |
| **V3** | Pestaña única «Desviación» con índice lateral | Desviaciones |
| **V4** | Inicio: «Mis tareas» como primer bloque | Inicio |

## 3. V1 — Cabecera y resumen

### 3.1 Cabecera común

Hoy cada página escribe su cabecera a mano y el orden de los botones varía: Auditorías pone «Editar · Cerrar · Modo revisión». Además, «Anular expediente» va suelto en su propia fila, entre la cabecera y las pestañas.

**Componente nuevo `RecordHeader`** (`src/components/record-header.tsx`). Recibe:
- el enlace de vuelta;
- el título y los chips (estado en color y los demás);
- la línea secundaria;
- las acciones.

Mantiene las clases actuales (`.record-header`, `.eyebrow`, `.record-title-line`, `.record-actions`) para no romper estilos ni pruebas.

**Orden de las acciones, igual en todos los módulos**, de izquierda a derecha:
1. «Anular expediente»: botón de peligro en contorno, separado del resto.
2. «Modo revisión».
3. Acciones propias del módulo, por ejemplo «Cerrar auditoría».
4. Acción principal («Editar…»), destacada, a la derecha.

**Detalles:**
- El modal y los permisos de `QmsAdministrativeStatus` no cambian. El botón pasa al grupo de acciones; el aviso de «expediente anulado» se queda donde está, bajo la cabecera.
- Los avisos de borrador (`.analytics-note`) siguen entre la cabecera y las pestañas.
- **Borradores sin código:** el título deja de ser «Sin codificación» o «CAPA sin código». Muestra el texto descriptivo principal del expediente (el mismo campo que ya usa el buscador), recortado a una línea, y un chip «Borrador · sin código». El texto completo sigue en su pestaña.
- Documentación controlada no tiene «Anular» ni «Modo revisión». Usa el mismo componente con sus acciones actuales.

### 3.2 Franja de datos clave

**Componente nuevo `RecordKeyFacts`.** Es la primera tarjeta de la pestaña Resumen o Información: una fila de 4 a 6 datos con etiqueta pequeña y valor grande en negrita.

**Reglas de presentación:**
- El **estado** se muestra con su chip de color: el mismo de la cabecera, con la misma función de color de cada módulo.
- Las **fechas** van en negrita. El **plazo o próximo seguimiento** se colorea con la misma regla que el panel de inicio (`classifyDue`):
  - rojo + «Vencido» si la fecha ya pasó;
  - ámbar + «Próximo» si vence en los próximos 30 días;
  - sin color en otro caso.

  Con el expediente cerrado no se colorea.
- Un dato vacío se muestra atenuado («—»), nunca se oculta.
- Todos los datos de la franja **siguen también donde están ahora**. La franja los repite arriba, no los mueve.

**Datos por módulo** (todos existen hoy):

| Módulo | Datos clave |
|---|---|
| Desviaciones | Estado · Apertura · Plazo (`deadlineLabel`) · Clasificación · Departamento · Cierre |
| CAPA | Estado · Eficacia · Apertura · Próximo seguimiento · Cierre operativo / efectivo · Departamento |
| Controles de cambios | Estado funcional · Solicitud · Implantación prevista · Dictamen · Responsable del seguimiento · Cierre |
| Reclamaciones | Situación · Apertura · Próximo seguimiento · Respuesta · Cierre |
| Devoluciones | Estado · Comunicación · Recepción · Decisión · Cierre |
| OOS | Estado · Fecha del OOS · Apertura · Detectado por · Cierre |
| Auditorías | Estado · Situación · Fecha prevista · Fecha realizada · Escenario · Cierre |
| Documentación controlada | Estado · Revisión vigente · Vigente desde · Próxima revisión · Departamento |

La franja de Auditorías no cambia sus fechas ni su situación: muestra lo que ya calculan `auditSituation` y la cabecera.

### 3.3 Estilo común de campos y vacíos

- **Auditorías** pasa del estilo «caja con borde por campo» (`.audit-info-field`) al de rejilla etiqueta/valor de los demás módulos (`.info-grid`). Se conservan los mismos grupos y el mismo orden: Información, Alcance y referencias, Entidades y áreas, Fechas y control, Equipo y participantes.
- **Valores vacíos:** el «—» y los textos de vacío («Sin clasificar», «No informada»…) no cambian. El «—» se envuelve en una clase atenuada (`.empty-value`, en el color de texto secundario), de modo que un vacío ya no pesa visualmente como un dato.
- Títulos de tarjeta y separaciones iguales en los 8 módulos, sin cambiar los textos.

### 3.4 Móvil (arreglos baratos)

- Pestañas en una sola fila con desplazamiento horizontal por debajo de 760 px, en lugar de varias filas.
- Menú principal desplazable con un degradado al borde que indica que hay más.
- La franja de datos clave pasa a 2 columnas.

## 4. V2 — Índice lateral en los formularios

**Componente cliente nuevo `SectionIndex`.**
- **Qué hace:** al cargar, recorre los títulos de apartado del formulario y construye un índice.
- **Qué lee:**
  - `section.form-section > h2` en Desviaciones, CAPA, Cambios, Devoluciones, OOS y Documentación controlada;
  - el título de cada apartado de Reclamaciones, que va dentro de `.section-title-row` o tras un `p.eyebrow`;
  - `section.card > h2` en Auditorías.
- **Anclas:** si un apartado no tiene `id`, se le asigna uno estable a partir del título, por ejemplo `apartado-e-investigacion`.

**Disposición:**
- **1200 px o más:** columna izquierda de unos 220 px, fija al desplazarse (`position: sticky`, por debajo de la barra superior). El formulario va a la derecha con su ancho actual.
- **Menos de 1200 px:** sin índice. El formulario queda como hoy.

**Comportamiento:**
- Al pulsar un apartado, la página baja hasta él (desplazamiento suave, respetando la barra superior fija).
- El índice marca el apartado visible (`IntersectionObserver`) con el estilo de pestaña activa.
- Es un `nav` con `aria-label="Apartados del formulario"`, con enlaces normales, usables con teclado.
- **No toca el formulario:** ni campos, ni orden, ni guardado, ni validaciones, ni el aviso de cambios sin guardar. La barra inferior fija de guardar (`.form-footer`) sigue igual.

**Dónde se usa:** en las páginas de alta y edición de los 8 módulos, dentro de un contenedor nuevo `.form-with-index`, sin modificar los componentes de formulario.

## 5. V3 — Pestaña única «Desviación»

**Pestañas de Desviaciones:**
- **Antes:** Resumen · Descripción · Investigación · Acciones · Conclusión · Relaciones · Versiones · Documentos · Evidencias · Revisión · Cronología · Audit Trail.
- **Después:** Resumen · **Desviación** · Relaciones · Versiones · Documentos · Evidencias · Revisión · Cronología · Audit Trail.

**Contenido de «Desviación».** Las cuatro pestañas sustituidas, en su orden y con sus mismas tarjetas y datos, cada una bajo una cabecera de apartado bien marcada:

| Apartado (ancla) | Tarjetas que contiene (las de hoy, sin cambios) |
|---|---|
| **Descripción** (`#desviacion-descripcion`) | Descripción del evento |
| **Investigación** (`#desviacion-investigacion`) | Investigación · Causa raíz (con desviaciones similares) · Evaluación de impacto |
| **Acciones** (`#desviacion-acciones`) | Acciones inmediatas · CAPA propuestas |
| **Conclusión** (`#desviacion-conclusion`) | Conclusión y disposición |

**Cabecera de apartado.** Una banda con el nombre del apartado en tamaño de título, una línea de acento corporativa a la izquierda y separación clara respecto al apartado anterior. Las tarjetas internas mantienen sus títulos, de modo que descripción, investigación, causa raíz, impacto, acciones y conclusión siguen siendo bloques separados.

**Índice lateral** (`SectionIndex` de V2) con los cuatro apartados y sus tarjetas, a 1200 px o más.

**Compatibilidad:**
- `?tab=description`, `investigation`, `actions` y `conclusion` llevan a `?tab=deviation` con el ancla del apartado (redirección del servidor con fragmento). Así siguen funcionando los enlaces guardados, los del panel (`assigned-query.ts`, hoy `?tab=actions`) y los de comentarios de revisión.
- En el código, los destinos de revisión de Desviaciones (`src/lib/qms/review/targets/deviations.ts`) pasan a `tabKey: "deviation"`, y sus anclas de campo no cambian.
- La lista de pestañas válidas para volver tras editar (`list-return-navigation.ts`) incluye `deviation` y acepta las antiguas como alias.
- Se actualizan las pruebas que usan las claves antiguas:
  - `deviations.test.ts`;
  - `smoke-review-comments-r2b1.ts`, que debe seguir abriendo el comentario sobre la causa raíz.

## 6. V4 — Inicio

**Hoy:** las tareas asignadas solo aparecen como lista si se pulsa la tarjeta «asignadas a mí» (`?tasks=mine`).

**Después:**
- **«Mis tareas»** es el primer bloque bajo el título del panel, siempre visible. Muestra la misma tabla de hoy (Fecha prevista · Expediente · Acción · Estado), las vencidas primero y después las próximas y las pendientes, 15 por página.
  - Sin tareas: «No tienes tareas asignadas».
  - La tarjeta «asignadas a mí» sigue en la fila de indicadores y enlaza a este bloque.
- **Filtros:** no cambian. Siguen en «Filtros» y se aplican como hoy, también a «Mis tareas».
- **Sin selector de departamento** fuera de «Filtros»: descartado en la revisión de este documento.
- El resto del panel no cambia y queda debajo.

## 7. Pruebas por PR

- **Unitarias:**
  - el cálculo del tono de los datos clave (vencido, próximo, ninguno, cerrado);
  - el mapeo de las claves antiguas de Desviaciones a la nueva pestaña y su ancla;
  - la generación de anclas del índice.
- **Navegador**, en las suites existentes:
  - cabecera y franja visibles en los 8 módulos;
  - el índice lleva al apartado pulsado;
  - `?tab=investigation` acaba en la pestaña «Desviación», en el apartado Investigación;
  - el inicio muestra «Mis tareas» sin pulsar nada.
- **Capturas antes/después** a 1440 px y 390 px, adjuntas a cada PR.

## 8. Fuera de alcance

- Cambios en formularios: campos, orden, textos de ayuda, validaciones o guardado.
- Unificar pestañas de otros módulos. Se puede proponer después con el mismo patrón si «Desviación» funciona bien.
- Nuevos indicadores, avisos o notificaciones.
- Rediseño de colores, tipografía o marca.
