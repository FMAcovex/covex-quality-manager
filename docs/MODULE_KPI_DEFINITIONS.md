# Indicadores de los módulos — reglas comunes, Controles de cambios, Reclamaciones y Devoluciones

Desviaciones y CAPA tienen su propio documento ([DEVIATION_KPI_DEFINITIONS.md](DEVIATION_KPI_DEFINITIONS.md), [CAPA_KPI_DEFINITIONS.md](CAPA_KPI_DEFINITIONS.md)). Aquí se recogen las reglas comunes de las piezas añadidas el 2026-10-17 y las definiciones de los otros tres módulos.

Todos los indicadores son **descriptivos**. No hay objetivos, límites de control (±2σ/3σ) ni plazos aprobados: quedan pendientes de decisión de Calidad. No se muestran colores de «bien» o «mal» sobre las variaciones.

## Reglas comunes

Implementadas una sola vez en `src/lib/qms/analytics/trends.ts` (cálculo) y `src/components/analytics/trend-charts.tsx` (presentación).

- **Población:** expedientes activos, con `includeInKpi = true` y fuera de borrador, con los filtros de la pestaña.
- **Años sin datos cargados:** se muestran como «Sin datos», nunca como cero.
- **Pendientes hoy:** expedientes abiertos a fecha de hoy, sea cual sea su año. Se aplican los filtros de la pestaña salvo el año analizado y el estado. La antigüedad se cuenta en días naturales desde la fecha de inicio del módulo. Los tramos son 0–30, 31–60, 61–90 y más de 90 días, con el límite incluido en el tramo inferior; son descriptivos, no plazos del PNT. Los expedientes sin fecha de inicio se cuentan aparte.
- **Seguimiento vencido:** mismo criterio que el contador del listado de cada módulo.
- **Mensual de 36 meses:** recuento por mes de la fecha de inicio. Termina en el mes en curso (marcado como parcial) o en diciembre si el año ya terminó. La media móvil de 12 meses solo se calcula con 12 meses completos y con datos.
- **Acumulado del año:** del 1 de enero al día de hoy frente al mismo intervalo del año anterior (el 29 de febrero se acota a fin de mes). Si el año analizado ya terminó, compara años completos. Cada fila usa su propia fecha (apertura, cierre, decisión…), indicada en la tarjeta.
- **Pareto:** expedientes abiertos en el año, ordenados de mayor a menor con % y % acumulado. Se resaltan las categorías que llegan al 80 % (incluida la que lo cruza). Con más de 10 categorías, la cola se agrupa en «Otras (n)». Cuando un expediente admite varias categorías (alcance, categoría, origen, tipo de producto), se cuentan menciones y el porcentaje es sobre el total de menciones.

## Controles de cambios

- **Fecha de inicio:** fecha de solicitud.
- **Abiertos hoy:** estado final Abierto.
  - **Prevista superada:** sin ejecutar y con la fecha prevista global (la más tardía entre la implantación y las acciones del Dictamen) anterior a hoy.
  - **Eficacia pendiente:** ejecutados con eficacia Pendiente.
  - **Seguimiento vencido:** próximo seguimiento del último registro hoy o antes.
- **Acumulado del año:** solicitudes y mayores (por solicitud), ejecutados y ejecución en plazo (por ejecución), eficacias evaluadas y eficacia aceptable (por cierre de eficacia).
- **Pareto:** departamento, alcance (varios por control) y clasificación.

## Reclamaciones

- **Fecha de inicio:** fecha de apertura.
- **Nuevo indicador — mediana recepción→respuesta:** días naturales entre la recepción y la respuesta al cliente o proveedor, de las respuestas emitidas en el año. También en el resumen anual. Es el tiempo de respuesta habitual en reclamaciones GMP. El plazo aplicable no está documentado, así que no se muestra % en plazo.
- **Abiertas hoy:** columnas de críticas y mayores. Contadores con el criterio del listado:
  - seguimiento vencido: próximo seguimiento anterior a hoy;
  - pendientes de decidir Parte II: con conclusión y sin decisión;
  - eficacia pendiente: Parte II requerida y eficacia Pendiente.
- **Acumulado del año:**
  - recibidas, críticas y mayores (por apertura);
  - cierres (por fecha de cierre);
  - % recurrentes (sobre las evaluadas);
  - mediana recepción→respuesta (por fecha de respuesta).
- **Pareto:** categoría/motivo y origen/fuente (varios por reclamación), clasificación y departamento.
- **Pendiente:** tasa de reclamaciones por unidades o lotes distribuidos. Necesita el volumen distribuido, que la aplicación no tiene.

## Devoluciones

- **Fecha de inicio:** fecha de comunicación.
- **Nuevo indicador — mediana comunicación→decisión:** días naturales entre la comunicación y la decisión de Calidad (aceptada o rechazada), de las decisiones tomadas en el año. También en el resumen anual. Se añade «Cerradas en el año» de la cohorte del año, como en Reclamaciones.
- **Abiertas hoy:** columna «Decisión pendiente». Seguimiento vencido: próximo seguimiento del último registro hoy o antes.
- **Acumulado del año:**
  - devoluciones (por comunicación);
  - aceptadas y rechazadas (por fecha de decisión);
  - cierres (por fecha de cierre);
  - mediana comunicación→decisión.
- **Pareto:** tipo, tipo de producto (varios por devolución) y área.
