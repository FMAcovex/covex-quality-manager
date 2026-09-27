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
6. Historial.

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
