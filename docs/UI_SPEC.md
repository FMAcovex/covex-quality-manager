# Especificación de interfaz

## Lenguaje visual

Aplicación corporativa clara, sobria y orientada a gestión de expedientes.

Preferencias:
- fondo claro;
- navegación consistente;
- acento azul;
- estados mediante badges discretos;
- alta densidad informativa sin aspecto de hoja Excel;
- tablas legibles;
- diseño adaptable a escritorio como prioridad.

La referencia visual aprobada conceptualmente es el prototipo mostrado durante definición del proyecto.

## Navegación global

Menú principal:
- Desviaciones.
- CAPA.
- Controles de cambios.
- Reclamaciones.
- Devoluciones.
- Indicadores o acceso integrado según evolución.

Los módulos no implementados pueden ocultarse o aparecer deshabilitados; no simular funcionalidad inexistente.

## Inicio — Panel de Calidad

**Panel con menos ruido visual (2026-10-17, aceptado por el responsable del proyecto):** mismos datos y estilo, con lo urgente primero.
- Filtros (área, departamento, año de apertura, estado y plazos) plegados tras el botón «Filtros», con etiquetas de los filtros aplicados, como en los listados.
- Franja «Requiere atención»: plazos vencidos (rojo si hay alguno), vencen en 30 días y eficacia pendiente (ámbar si hay alguno), y borradores sin abrir. Los plazos llevan a la bandeja de plazos de la misma página; la eficacia pendiente, a los listados de CAPA y de controles de cambios filtrados.
- Expedientes por módulo en una tabla (total, abiertos, cerrados, borradores y enlace al listado), con fila de totales; los módulos sin expedientes se atenúan. Documentación controlada en una línea propia. En móvil cada módulo es una fila compacta.
- Se retiran la fila de cinco tarjetas de totales (sus datos están en la tabla) y «Accesos a los módulos» (duplicaba el menú).
- Textos de negocio: «Año de apertura» en lugar de «Año de cohorte» y «Plazos vencidos y próximos» en lugar de «Tareas del sistema» u «obligaciones». El tiempo de consulta pasa a un título emergente al pie.
- Sin gráfico de evolución en el inicio (decisión del responsable del proyecto, 17/10/2026): el histórico se consulta en la pestaña Indicadores de cada módulo, enlazada desde su fila de la tabla. La bandeja de plazos ocupa todo el ancho.

## Desviaciones — página de entrada

Cabecera:
- título Desviaciones;
- pestañas `Expedientes | Indicadores`;
- `+ Nueva desviación`;
- `Exportar`.

### Filtros
En una franja horizontal por encima del buscador:
- Año.
- Departamento.
- Estado.
- Clasificación.
- Procedencia.
- Medidas.
- CAPA.
- En plazo.
- Más filtros.

### Buscador
Debajo de filtros y encima del listado.

**Listados con menos ruido visual (2026-10-17, aceptado por el responsable del proyecto tras el piloto en Desviaciones):**
- buscador, «Buscar», botón «Filtros» con el número de filtros aplicados y vistas guardadas en una sola fila;
- panel de filtros plegado; abierto o plegado se recuerda en el navegador de cada usuario;
- filtros aplicados como etiquetas con «×» para quitarlos y «Limpiar filtros»;
- contadores en una línea, con los mismos datos que las tarjetas anteriores;
- «Recordatorios por correo» aparece solo al seleccionar expedientes;
- todos los filtros con etiqueta encima y casilla de la misma altura.

No se quita ningún filtro, opción ni exportación. Se aplica a Desviaciones, CAPA, Controles de cambios, Reclamaciones, Devoluciones, Auditorías y OOS. Documentación controlada ya tenía los filtros avanzados plegados y filtros rápidos propios: conserva esa estructura, con los contadores en una línea y los filtros rápidos en la fila de acciones.

### Tabla
Tabla horizontal amplia. Permitir scroll horizontal cuando sea necesario.
Considerar columnas sticky para Código y/o Estado.

Columnas funcionales hasta Observaciones según SPECIFICATION.

Funciones:
- ordenación;
- filtros combinables;
- paginación;
- búsqueda;
- apertura de expediente al seleccionar fila.

No priorizar gráficos en esta pantalla.

Puede mostrarse un resumen operativo pequeño:
- total;
- abiertas;
- fuera de plazo;
- pendientes relevantes.
No convertirlo en un segundo dashboard.

## Expediente — pantalla completa

Cabecera persistente:
- volver;
- código;
- clasificación;
- estado;
- departamento;
- fecha apertura;
- acciones principales.

Pestañas:
1. Resumen.
2. Investigación.
3. Acciones.
4. Seguimientos.
5. Documentos.
6. Cronología: modificaciones, versiones, documentos y relaciones (D-089).

### Resumen
Debe permitir comprender el caso sin navegar por todas las pestañas:
- descripción;
- origen;
- material/proceso;
- clasificación;
- causa raíz resumida;
- impacto;
- estado/fechas;
- CAPA relacionadas;
- observaciones internas.

## Nueva desviación / Editar

Formulario de una sola experiencia con navegación por secciones.

Bloques:
1. Identificación y origen.
2. Documentación.
3. Descripción.
4. Acción inmediata.
5. Investigación.
6. Causa raíz.
7. Clasificación e impacto.
8. CAPA.
9. Conclusión/cierre.

Usar:
- tarjetas/secciones claras;
- labels explicativos;
- campos de texto largo donde corresponda;
- selectores Si/No/N.A.;
- tablas dinámicas para acciones múltiples;
- guardado sin exigir completar cierre.

No copiar la maquetación del Word.

## CAPA relacionadas

En expediente de desviación:
- sección `CAPA relacionadas`;
- mostrar código, estado, responsable/fecha si aplica;
- acción para abrir expediente CAPA;
- acción futura `Crear CAPA`.

## Seguimientos

Presentar cronológicamente, preferentemente timeline o lista estructurada.
Cada entrada debe conservar su autor, fecha y contenido.

## Indicadores

Pestaña separada dentro del contexto de gestión.
Reutilizar lenguaje visual del dashboard GMP ya definido:
- filtros;
- tarjetas KPI;
- comparativa anual;
- gráficos;
- tendencias 5 años.

Debe consultar la misma BD que Expedientes.

## Revisión transversal — piloto Reclamaciones

La cabecera del expediente ofrece `Modo revisión`. Al activarlo mediante `?review=1`, los objetivos catalogados muestran un marcador discreto con `+ comentario` o con el total activo (`PENDING + ACCEPTED`). El parámetro se mantiene al cambiar de pestaña.

El panel lateral común muestra el objetivo, pestaña/sección, versión funcional, snapshot, conversación, autores, fechas y estado. Permite las acciones definidas por el ciclo de vida; un hilo resuelto se presenta en solo lectura.

La pestaña `Revisión (N)` agrupa Pendientes, Aceptados y Resueltos. `Ir al campo` abre la pestaña de origen, reactiva el modo de revisión, enfoca un anchor estable y abre el hilo seleccionado. R2A integra exclusivamente Reclamaciones sin modificar sus pestañas existentes ni sus reglas funcionales.


## Auditorías R3A

Menú único Auditorías; /audits con filtros SQL, búsqueda completa, paginación de 25 y ColumnSelector. Control del dato es independiente de Revisión, que muestra — sin hilos/targets/filtro ficticio. Alta/edición: Identificación, Alcance y entidad, Planificación y realización, Equipo y participantes, Control/observaciones. Campos condicionales conservan valores al cambiar escenario. Datos y filas se mantienen tras errores, con foco y scroll al primer campo. Detalle ofrece Información e Historial; cierre deshabilitado. Sin pestañas vacías. Vista adaptable a 1440/768/390px.

## Auditorías R3B — workspace

Pestañas Información, Hallazgos, Seguimiento, Relaciones, Informe y cierre, Documentos, Versiones, Revisión, Cronología (con los valores registrados de cada cambio; sustituye a Historial desde R5A, D-110) y Audit Trail. Tarjetas compactas con detalle editable, acciones persistentes, criticidad española, vinculador transversal y acceso a seguimiento. Retirados ocultos por defecto y consultables. Relaciones muestran estados vivos y hallazgos atribuidos; CAPA/Desviación enlazan Auditoría/OBS/Rk por UUID. Timeline general/hallazgo más reciente arriba. Nuevas columnas opcionales mediante ColumnSelector y filtros SQL, manteniendo las columnas esenciales R3A. Anchors preparados por UUID; sin Review ni pestañas documentales ficticias. Formularios conservan datos tras errores y se adaptan a 1440/768/390.

## Auditorías R3C — workspace documental

Añade Informe y cierre, Documentos, Versiones y Revisión al workspace R3B. Formularios con valores preservados tras error; navegación nativa después del resultado de Server Action como R3B. 00/01+ descendentes, contenido histórico, descarga y PDF por versión; plan actual rotulado aparte. Condiciones/avisos de cierre calculados, excepción proveedor explícita; firma externa/manual.

Review reutiliza drawer/estados/contadores, seis targets estáticos y UUID de hijos; pestaña y versión histórica, deep links y retirados. Columnas opcionales versión/fecha/PDF/parcial, filtros informe/situación/PDF último/Review. Integridad derivada separada de Review. Responsive 1440/768/390. Detalle en AUDITS_R3C.md.


## Devoluciones R4B

R4B incorpora solo UX funcional: destino/aplicabilidad, criterios condicionados, datos existentes de declaración/destrucción, planificación, descargas históricas, paginación/filtros. Sin versiones funcionales Return ni rediseño de pestañas. Pulido visual global agrupado como Revisión UX/UI transversal final.
