# Estado actual

Fecha: 2026-09-27.

## Hitos completados
- Hito 0 — Especificación y arquitectura base.
- Hito 1 — Núcleo técnico y base de datos, validado por CI.

## Hito 2 — Desviaciones completas
Estado: **EN DESARROLLO** en `feature/hito-02-deviations`.

### Alcance implementado en la rama
- listado operativo conectado a PostgreSQL;
- filtros horizontales y buscador;
- contadores operativos;
- alta de desviación por bloques;
- edición de expedientes abiertos y cerrados;
- acciones inmediatas 1:N;
- investigación, causa raíz e impacto separados;
- CAPA propuestas 1:N;
- expediente a pantalla completa;
- pestañas Resumen, Investigación, Acciones, Seguimientos, Documentos e Historial;
- seguimientos cronológicos;
- historial interno de cambios;
- observaciones internas;
- control del dato;
- campo de plazo seguro `NOT_EVALUATED` hasta configurar reglas vigentes;
- PostgreSQL local opcional mediante Docker Compose.

### Fuera del Hito 2
- generación Anexo III/V;
- exportación listado simple;
- importación histórica 2025/2026;
- KPI;
- expediente CAPA completo;
- Entra/SharePoint/alertas.

## Validación pendiente
Abrir PR, ejecutar CI y corregir incidencias antes de fusionar.
