# Indicadores CAPA

## Cohorte de apertura
Se utiliza para:
- total;
- correctivas/preventivas;
- abiertas actualmente;
- canceladas;
- distribución por departamento;
- distribución por origen.

## Ejecución
La ejecución corresponde al cierre operativo.

Cuando una CAPA contiene varias acciones, la fecha prevista global es la fecha prevista más tardía de sus acciones.

Ejecución en plazo:
- numerador: CAPA cerradas operativamente en el año cuya fecha de cierre operativo es igual o anterior a la fecha prevista global;
- denominador: CAPA cerradas operativamente con fecha prevista evaluable.

La mediana apertura → ejecución usa días naturales entre apertura y cierre operativo.

## Eficacia
La eficacia se calcula únicamente sobre resultados Conforme/No conforme.
Pendiente y N/A histórico quedan fuera del denominador.

La mediana ejecución → eficacia usa días naturales entre cierre operativo y cierre efectivo/verificación final.

## Cobertura temporal
Los años no cargados en PostgreSQL deben mostrarse como sin datos, no como cero.

## Pendientes hoy y tendencias (2026-10-17)

Mismas piezas que en Desviaciones (reglas comunes en [MODULE_KPI_DEFINITIONS.md](MODULE_KPI_DEFINITIONS.md)). Son descriptivas: sin objetivos ni plazos del PNT.

- **Antigüedad de las CAPA abiertas:** CAPA abiertas, activas y con `includeInKpi = true`, sea cual sea su año. Se aplican departamento, tipo y origen; no el año ni el estado. Días naturales desde la apertura.
  - **Fecha prevista superada:** la fecha prevista global (la más tardía de las acciones) es anterior a hoy.
  - **Sin fecha prevista:** ninguna acción tiene fecha prevista.
  - **Seguimiento vencido:** próximo seguimiento hoy o antes (mismo criterio que el listado).
- **CAPA ejecutadas pendientes de verificar eficacia:** cerradas operativamente con eficacia Pendiente y sin cierre de eficacia (mismo criterio que el contador del listado). Días naturales desde el cierre operativo.
- **Aperturas por mes · 36 meses** con media móvil de 12 meses, por fecha de apertura.
- **Acumulado del año** frente al mismo periodo del año anterior: aperturas, correctivas y preventivas (por apertura), ejecutadas y ejecución en plazo (por cierre operativo), eficacias evaluadas y eficacia conforme (por cierre de eficacia).
- **Pareto** del año por departamento, origen o tipo.
