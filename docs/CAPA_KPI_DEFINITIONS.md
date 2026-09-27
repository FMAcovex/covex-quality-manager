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
