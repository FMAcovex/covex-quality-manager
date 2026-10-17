# Indicadores de Desviaciones

## Fuente

La fuente operativa de los KPI es PostgreSQL. El Excel histórico deja de ser un segundo origen de cálculo una vez importado.

## Cohortes

### Año de apertura
Se utiliza para:
- total de desviaciones;
- área;
- clasificación;
- origen;
- recurrencia;
- afectación a producto terminado;
- CAPA asociada;
- abiertas actualmente;
- completitud KPI.

### Año de cierre
Se utiliza para:
- porcentaje de cierres en ≤30 días;
- mediana de días de cierre.

Una desviación abierta en 2025 y cerrada en 2026 pertenece al volumen 2025 y a las métricas de cierre 2026.

## Definiciones

### Recurrencia
Numerador: registros con recurrencia = Sí.
Denominador: registros evaluados como Sí o No.
N/A/no informado no se convierte en No.

### Afectación a producto terminado
Numerador: registros con afectación = Sí.
Denominador: registros evaluados como Sí o No.

### Cierre en ≤30 días
Numerador: desviaciones con diferencia apertura-cierre entre 0 y 30 días naturales.
Denominador: desviaciones cerradas en el año con ambas fechas válidas.

### Mediana de cierre
Mediana de días naturales entre apertura y cierre sobre la misma población evaluable del indicador anterior.

### CAPA
Una desviación se considera con CAPA cuando:
- capaRequired=true; o
- existe al menos una acción CAPA estructurada.

### Completitud KPI
Para el indicador de calidad del dato se consideran necesarios:
- fecha de apertura;
- clasificación;
- recurrencia Sí/No;
- afectación a producto terminado Sí/No;
- procedencia/origen.

No equivale a decir que el Anexo III esté completo.

## Inclusión/exclusión

includeInKpi=false excluye el registro de todos los indicadores.
El motivo se conserva en kpiExclusionReason.

## Origen

Para históricos:
1. usar ORIGEN NORMALIZADO KPI conservado durante la importación;
2. si no existe, usar procedencia/origen.

Para registros nativos de la aplicación se utiliza la procedencia/origen registrada hasta que exista un catálogo normalizado específico.

## Cobertura temporal

Un año no cargado en PostgreSQL debe mostrarse como sin datos.
No debe representarse como valor cero porque cero significa una cohorte conocida sin desviaciones.

La tendencia mantiene cinco posiciones temporales, pero interrumpe la línea cuando falta cobertura.

## Antigüedad de las desviaciones abiertas (piloto, 2026-10-17)

Foto de lo pendiente hoy, no de un año concreto.

- **Población:** desviaciones abiertas (`status = OPEN`), activas y con `includeInKpi = true`, sea cual sea su año de apertura. Se aplican los filtros de departamento, clasificación, procedencia y CAPA; el año analizado y el estado actual no se aplican.
- **Antigüedad:** días naturales desde la fecha de apertura (`issueDate`) hasta hoy. Las desviaciones sin fecha de apertura se cuentan aparte, no en un tramo.
- **Tramos:** 0–30, 31–60, 61–90 y más de 90 días, con los límites incluidos en el tramo inferior. Son descriptivos: no son plazos del PNT ni objetivos aprobados.
- **Para cada tramo:** número, porcentaje sobre las que tienen fecha, críticas y mayores.
- **Mediana de antigüedad:** sobre las que tienen fecha.
- **Marcadas fuera de plazo:** abiertas con «En plazo» = No (`deadlineStatus = OUT_OF_TIME`), tal como se registra en el expediente.
- **Con seguimiento vencido:** el próximo seguimiento del último registro de seguimiento es hoy o anterior. Es el mismo criterio que el contador del listado.
- **Las más antiguas:** las cinco con más días abiertas, con enlace al expediente.

## Tendencias (piloto, 2026-10-17)

Sustituyen al gráfico «Aperturas por mes» (año analizado frente al anterior) y a las tarjetas de distribución por área, clasificación y origen. Usan la misma población y los mismos filtros que el resto de la pestaña. Son descriptivas: no hay objetivos, límites de control ni plazos aprobados.

- **Aperturas por mes · últimos 36 meses:** número de desviaciones por mes de la fecha de apertura (`issueDate`). La serie termina en el mes en curso si se analiza el año actual (mes marcado como parcial) o en diciembre si el año ya terminó. Los meses de años sin datos cargados se muestran como hueco «Sin datos cargados», nunca como cero.
- **Media móvil de 12 meses:** media de las aperturas de los 12 meses que terminan en cada mes, redondeada a un decimal. Solo se calcula si los 12 meses tienen datos y ninguno es el mes en curso. Comparte unidad con las barras (desviaciones al mes), por eso va en el mismo eje.
- **Acumulado del año:** del 1 de enero al día de hoy del año analizado frente al mismo intervalo del año anterior (el 29 de febrero se acota al último día de febrero). Si el año analizado ya terminó, compara años completos. Indicadores: aperturas, críticas y mayores (por fecha de apertura), cierres y % de cierre en ≤30 días (por fecha de cierre). Las desviaciones del año sin fecha de apertura no entran en el acumulado y se indica su número.
- **Pareto:** aperturas del año analizado agrupadas por área, origen, clasificación o causa raíz (6M, D-092; se cuentan menciones porque se puede marcar más de una), ordenadas de mayor a menor, con porcentaje y porcentaje acumulado. Se resaltan las categorías que, acumuladas, alcanzan el 80 % (incluida la que cruza el 80 %). Con más de 10 categorías, la cola se agrupa en «Otras (n)». El acumulado se muestra como texto, sin segundo eje.
- **Sin objetivos ni gráfico de control:** Calidad valora los indicadores a final de año, fuera de la aplicación (D-090).

