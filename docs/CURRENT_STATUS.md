# Estado actual

Fecha: 2026-09-27.

## Hitos completados
- Hito 0 — Especificación y arquitectura.
- Hito 1 — Núcleo técnico y base de datos.
- Hito 2 — Desviaciones completas.
- Hito 3 — Documentos y exportaciones.
- Hito 4 — Importación histórica 2025–2026.

## Hito 5 — Indicadores
Estado: **EN DESARROLLO** en `feature/hito-05-indicators`.

### Definiciones alineadas con el dashboard KPI vigente
- volumen, área, clasificación, origen, recurrencia, afectación a producto y CAPA: año de apertura;
- cierre ≤30 días: año de cierre y desviaciones con apertura/cierre válidos;
- mediana de cierre: misma población que el cumplimiento de cierre;
- recurrencia: Sí / (Sí + No), sin convertir no evaluados en No;
- afectación a producto terminado: Sí / (Sí + No);
- abiertas actualmente: fotografía actual de la cohorte del año de apertura;
- completitud KPI: apertura, clasificación, recurrencia Sí/No, afectación Sí/No y procedencia/origen informados.

### Implementado en la rama
- pestaña Indicadores integrada en Desviaciones;
- filtros por año, departamento, clasificación, procedencia/origen, CAPA y estado;
- tarjetas KPI con comparación frente al año anterior;
- cobertura explícita en recurrencia y afectación;
- total, cierre ≤30 días, mediana, recurrencia, afectación PT;
- críticas, mayores, abiertas actualmente, con CAPA y datos a revisar;
- aperturas mensuales frente al año anterior;
- distribuciones por área, clasificación y origen;
- tendencias de 5 años;
- resumen anual de 5 años;
- cálculos desde PostgreSQL sin Excel KPI paralelo;
- tests unitarios de las reglas de cómputo;
- coherencia de CAPA entre listado e indicadores.

### Pendiente antes del merge
- smoke test PostgreSQL de indicadores;
- CI completo;
- revisión de interfaz y merge.

## Próximo paso
Finalizar y validar Hito 5 antes de iniciar el módulo CAPA.
