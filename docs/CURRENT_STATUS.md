# Estado actual

Fecha: 2026-09-27.

## Hitos completados
- Hito 0 — Especificación y arquitectura.
- Hito 1 — Núcleo técnico y base de datos.
- Hito 2 — Desviaciones completas.
- Hito 3 — Documentos y exportaciones.
- Hito 4 — Importación histórica 2025–2026.
- Hito 5 — Indicadores de Desviaciones.

## Hito 5 — Indicadores
Estado: **COMPLETADO Y VALIDADO**.

### Implementado
- pestaña Indicadores integrada dentro de Desviaciones;
- fuente única PostgreSQL;
- filtros por año, departamento, clasificación, procedencia/origen, CAPA y estado;
- tarjetas KPI con comparación frente al año anterior;
- total abierto en el año;
- cierre en ≤30 días;
- mediana de días de cierre;
- recurrencia;
- afectación a producto terminado;
- críticas y mayores;
- abiertas actualmente;
- desviaciones con CAPA;
- control de completitud KPI;
- aperturas mensuales frente al año anterior;
- distribuciones por área, clasificación y origen;
- tendencias de 5 años;
- tabla resumen anual de 5 años.

### Reglas de cómputo
- volumen, área, clasificación, origen, recurrencia, afectación y CAPA: año de apertura;
- cumplimiento de cierre y mediana: año de cierre;
- recurrencia y afectación: solo Sí/No en el denominador; los no evaluados quedan visibles mediante cobertura;
- CAPA: capaRequired=true o al menos una CAPA estructurada;
- origen: para históricos se utiliza primero ORIGEN NORMALIZADO KPI conservado durante la migración y, si no existe, la procedencia/origen del expediente;
- registros con includeInKpi=false quedan fuera de indicadores;
- años no cargados en PostgreSQL se muestran como sin datos, nunca como cero desviaciones.

### Compatibilidad con históricos
Se añadieron los campos:
- includeInKpi;
- kpiExclusionReason.

El importador 2025/2026 conserva ahora INCLUIR EN KPI y el motivo de exclusión cuando existe. En la fuente revisada actual todos los expedientes 2025/2026 están incluidos, por lo que esto no altera los resultados actuales.

### Validación final
- PostgreSQL 16 real;
- esquema y seed;
- smoke test base QMS;
- smoke test de importación histórica;
- smoke test específico de indicadores;
- comprobación de año de apertura frente a año de cierre;
- comprobación de denominadores Sí/No;
- comprobación de CAPA histórica sin fila estructurada;
- Prisma validate/generate;
- lint;
- tests;
- build Next.js de producción.

## Fuera de alcance todavía
- módulo CAPA completo;
- indicadores CAPA;
- enriquecimiento histórico leyendo cada Anexo III individual;
- Entra;
- SharePoint automático;
- alertas.

## Próximo paso
Hito 6 — CAPA: módulo operativo completo, listados/filtros, expediente, seguimientos, eficacia, cierre, relaciones N:N e indicadores CAPA.
