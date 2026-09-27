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
