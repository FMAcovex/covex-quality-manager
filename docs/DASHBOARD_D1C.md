# D1C — Rediseño visual del Dashboard

Base: D1B integrado en main `5a53949` (#133). Rama: `feature/dashboard-d1c-visual-redesign`.

## Presentación

- Cabecera compacta con el aviso de Versión piloto visible e integrado.
- Filtros GET existentes, controles alineados y acciones Aplicar/Limpiar diferenciadas.
- Los cinco KPI mantienen sus expresiones y datos originales; la cifra principal gana jerarquía. Abiertos usa azul corporativo y vencimientos un ámbar moderado.
- Siete módulos: tarjetas con total, desglose agrupado y acceso integrado. PNT conserva su población documental y la excepción del filtro de año.
- Bandeja de tareas con resumen de vencidas/próximas, código destacado, módulo, motivo, fecha y estado. En móvil cada fila se presenta en un bloque legible; se mantienen tabla semántica, enlaces y paginación.
- Tendencia existente de cinco años con barras discretas, cobertura explícita y enlaces a indicadores. Auditorías y PNT conservan la explicación sin gráfico histórico.
- Estilos limitados a `.dashboard-home` en `src/app/dashboard.css`. Sin dependencias adicionales ni cambios en navegación global.

## Validación y evidencias

Se mantienen `dashboard-d1b:smoke` y `dashboard-d1b:ui:smoke`: contratos de datos, recuentos independientes contra Prisma, filtros y navegación. El smoke `dashboard-d1c:ui:smoke` comprueba geometría a 1440/768/390, conservación de KPI/módulos/tareas entre resoluciones, usabilidad de filtros, ausencia de scroll horizontal en la bandeja, foco por teclado, plazos, drill-down, paginación y Limpiar.

La prueba D1C exige `APP_ENV=test` y una base de pruebas. Crea 17 auditorías ficticias para ejercitar ambos estados de plazo y varias páginas; las limpia en `finally`. No debe ejecutarse contra datos reales.

Ejemplo con un servidor local conectado a PostgreSQL de pruebas:

```sh
APP_ENV=test D1C_UI_BASE_URL=http://127.0.0.1:3000 \
  D1C_SCREENSHOT_DIR=/tmp/d1c-dashboard-captures pnpm dashboard-d1c:ui:smoke
```

Si el entorno dispone de Chromium del sistema, se puede seleccionar mediante `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`; por defecto se utiliza el navegador instalado por Playwright. No se cambia la configuración de navegador de CI.

La CI completa conserva todas las regresiones existentes e incorpora D1C. Publica las capturas reales `dashboard-1440.png`, `dashboard-768.png` y `dashboard-390.png` en el artifact `d1c-dashboard-captures`. El resultado del commit final y su ejecución quedan enlazados en la PR única.

Sin cambios de consultas, cálculos funcionales, modelos Prisma, migraciones, seed, reglas GMP ni documentos oficiales. La validación local y las capturas usan exclusivamente PostgreSQL aislado y datos ficticios.
