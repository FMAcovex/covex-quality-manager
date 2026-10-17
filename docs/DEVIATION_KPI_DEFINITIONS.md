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

