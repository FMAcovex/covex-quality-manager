# D1B — Dashboard global (datos + UX + regresión)

**Base:** D1A integrada en \`main\` mediante PR #131. **Entregable:** una PR con D1B-1, D1B-2 y D1B-3, evitando CI repetida en tres ramas.  
**Alcance:** desarrollo piloto; no validación GMP, ni autenticación, ni envío automático de alertas.

## Reutilización y comportamiento

- \`src/modules/dashboard/domain.ts\`: contrato para filtros de año, departamento, tendencia seleccionada y bandeja; agregación de estados de expediente, «Sin datos» y paginación. 
- \`src/modules/dashboard/queries.ts\`: consultas de PostgreSQL desde servidor. Emplea \`groupBy\` por estado sobre cada tabla de expediente QMS con \`qmsRecord.isActive=true\`; filtra año de \`QmsRecord\`, departamento simple o departamentos múltiples de Auditoría y excluye anulados. **No multiplica registros por productos, hallazgos, relaciones o versiones**. PNT se cuenta por maestro activo; sus revisiones en vigor se cuentan separadamente.
- La vista operativa muestra los seis módulos de expedientes más PNT. «Total» incluye borradores, distinguidos del número abierto. \`CANCELLED\` CAPA se muestra como «otro estado», no como abierto.
- Vencimientos: conserva como origen configurado \`getAlertPreview\` (CAPA/CC/Reclamaciones/Devoluciones), pero comprueba que cada expediente siga activo y responda al departamento/año antes de mostrarlo. Complementa con fechas del **último seguimiento** en Desviaciones, revisión por ámbito en Auditorías y revisión en vigor de PNT. Para estos tres adaptadores adicionales, «Próximos» significa hasta 30 días; «Vencido» fecha anterior a hoy UTC; **hoy no está vencido**. No asigna un plazo cuando falta fecha.
- La fuente configurada \`getAlertPreview\` puede incluir dos obligaciones distintas por expediente, por ejemplo seguimiento y eficacia. La tarjeta «registros afectados» deduplica el expediente; el número «tareas» representa obligaciones, no expedientes. Las reglas de alerta existentes **no se modifican**.
- Tendencia: reutiliza las funciones de analítica existentes de Desviaciones, CAPA, CC, Reclamaciones y Devoluciones; Auditorías usa año de codificación con una auditoría por expediente (planes/hallazgos excluidos). PNT no inventa evolución histórica. Los años sin registros cargados se señalan \`dataAvailable=false\` («Sin datos»); las métricas detalladas existentes no cambian.
- UI: \`src/app/page.tsx\` incorpora \`DashboardPanel\`, preserva estética corporativa, advertencia piloto y enlaces directos a los siete módulos; tarjetas operativas, filtro GET, tabla paginada, enlaces a expedientes y gráficos accesibles a 1440/768/390 px. No hay autosave ni acciones sobre datos desde Home.

## Verificaciones incorporadas

- \`src/modules/dashboard/domain.test.ts\`: saneamiento de filtros, estados, cobertura histórica y paginación.
- \`scripts/smoke-dashboard-d1b.ts\`: fixtures exclusivamente sintéticas en la **BD aislada de CI**, con limpieza de sus propios UUID. Activo/anulado/borrador, Auditoría multiárea, Devolución multiproducto, varias revisiones de un PNT, fechas vencidas, filtro de departamento y recuento independiente de la paginación.
- \`scripts/smoke-dashboard-d1b-ui.ts\`: navegador a Home, siete tarjetas, filtros, año 2025, PNT sin series inventadas, navegación y responsive. Captura errores de cliente/hidratación.
- \`.github/workflows/ci.yml\`: **primero** pruebas D1B afectadas, **después** pruebas existentes; ningún test o job eliminado. Se conserva el gate temprano de lint/tipos antes de PostgreSQL.
- La aceptación exige CI completa verde en **último commit**, pruebas focalizadas pasando y verificación visual por usuario antes de integrar. Los registros reales de Codespaces no se tocan.

## Límites transparentes y criterios pendientes

- El filtro anual de PNT no aplica; el maestro PNT se cuenta como estado actual. La vigencia de revisiones sigue dependiendo de la documentación disponible, que no se presume verificada.
- Los indicadores de cohortes no sustituyen los informes detallados de cierre/eficacia. Cifras de tasas y medianas se consultan en los indicadores específicos del módulo.
- La bandeja representa **fechas registradas y reglas activas**, no el universo de todas las obligaciones GMP. No incluye tareas personales sin identidad/roles ni deduce plazos no registrados.
- La fuente CAPA/Reclamación de alertas configuradas puede diferir del campo de próximo seguimiento del encabezado. No se reescriben registros ni se homologan arbitrariamente los dos significados.
- Antes de uso GMP seguirán pendientes URS, aceptación QA, permisos, audit trail, prueba de restauración, infraestructura, carga histórica y revisión documental.
