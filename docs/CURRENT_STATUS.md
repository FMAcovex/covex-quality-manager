# Estado actual

Fecha: 2026-09-27.

## Hitos completados
- Hito 0 — Especificación y arquitectura.
- Hito 1 — Núcleo técnico y base de datos.
- Hito 2 — Desviaciones completas.
- Hito 3 — Documentos y exportaciones.
- Hito 4 — Importación histórica 2025–2026.
- Hito 5 — Indicadores de Desviaciones.
- Hito 6 — CAPA.

## Hito 6 — CAPA
Estado: **COMPLETADO Y VALIDADO**.

### Fuente funcional
- GC-00/030/05, vigencia 02/02/2026.
- Anexo III oficial: Informe y seguimiento de Acción, revisión 05.
- Anexo IV oficial: Listado de seguimiento de CAPAs, revisión 05.
- Listado operativo actual: `02. LISTADO DE CAPAS (2025_).xlsx`.

### Módulo operativo
- listado principal y filtros;
- buscador;
- alta y edición;
- expediente a pantalla completa;
- correctivas/preventivas;
- origen y codificación de origen;
- causa raíz;
- acciones propuestas 1:N;
- seguimientos ilimitados 1:N;
- versión inicial 00 y seguimientos 01+;
- próxima fecha de seguimiento;
- referencia explícita de evidencia;
- estados Abierta/Cerrada/Cancelada;
- cierre operativo separado del cierre efectivo;
- eficacia Conforme/No conforme/Pendiente;
- N/A preservado solo como valor histórico;
- criterio, valoración y evidencia de eficacia;
- historial interno de modificaciones;
- relaciones QMS N:N;
- creación directa de CAPA desde una propuesta CAPA de Desviaciones.

### Reglas de cierre
- una CAPA abierta que continúa abierta requiere motivo y próxima fecha en el seguimiento;
- una CAPA cerrada requiere fecha de cierre operativo y conclusión;
- para cerrar operativamente debe existir referencia explícita de evidencia en un seguimiento;
- una CAPA cancelada requiere motivo;
- el cierre efectivo exige estado Cerrada, eficacia Conforme y valoración documentada;
- implantación y eficacia se mantienen separadas.

### Documentos y exportaciones
- generación del Anexo III DOCX desde la plantilla oficial v05;
- generación del Anexo IV XLSX por año desde la plantilla oficial v05;
- ampliación dinámica del Anexo IV sin truncar al superar las filas visibles de la plantilla;
- listado simple XLSX con las columnas operativas del listado 2026;
- listado simple filtrado;
- control SHA-256 de las plantillas;
- las plantillas se instalan localmente y no se versionan como binarios en Git.

SHA-256:
- Anexo III: `73c3d57ca5ae6f4e9644a4f1cbe416992de6b367973ba98cd67f7f0bd1fea540`.
- Anexo IV: `47f3d757c2c00cbcbdba9e4f7daf2cb4d804ce522a5e1145ab5260efd8147ac3`.

### Históricos CAPA 2025–2026
Fuente revisada:
- archivo: `02. LISTADO DE CAPAS (2025_).xlsx`;
- SHA-256: `a88f5024001b0a7d793b3f1f79c7aeb00b5e278d934297ed731e60e34c93ebfb`;
- 75 CAPA en 2025;
- 54 CAPA en 2026;
- total: 129;
- 108 cerradas;
- 21 abiertas;
- eficacia: 90 Conforme, 38 Pendiente, 1 N/A histórico;
- 51 registros 2026 con información de seguimientos;
- 54 registros 2026 con próxima fecha de seguimiento informada;
- 3 registros 2026 no presentes en Base_KPI, por lo que Base_KPI no se usa como fuente principal de migración.

Incoherencia bloqueante detectada:
- `AC/GC-11/001/2026` aparece dos veces y representa dos acciones diferentes. Ambas filas se rechazan en dry-run por duplicidad hasta revisión manual.

El importador:
- usa las hojas anuales como fuente principal;
- utiliza Base_KPI solo para enriquecer origen/eficacia cuando existe correspondencia;
- no inventa causa raíz ausente del listado;
- preserva el texto histórico y snapshot de cada fila;
- detecta duplicados;
- es dry-run por defecto;
- requiere confirmación explícita para aplicar;
- es idempotente.

### Indicadores CAPA
Desde PostgreSQL:
- total;
- abiertas actualmente;
- correctivas/preventivas;
- ejecución en plazo;
- mediana apertura → ejecución;
- pendientes de eficacia;
- eficacia conforme/no conforme;
- mediana ejecución → eficacia;
- distribución por departamento;
- distribución por origen;
- tendencia de 5 años.

Para CAPA con varias acciones, el plazo global de ejecución se compara contra la última fecha prevista de las acciones.

### Validación
- PostgreSQL 16 real;
- esquema y seed;
- smoke QMS;
- smoke de importación de Desviaciones;
- smoke de indicadores de Desviaciones;
- smoke de importación CAPA e idempotencia;
- smoke del ciclo de vida CAPA;
- validaciones unitarias de apertura/cierre/cancelación/eficacia;
- pruebas de expansión del Anexo IV;
- Prisma validate/generate;
- lint;
- tests;
- build Next.js.

## Punto de control
Los módulos Desviaciones y CAPA ya comparten la plataforma común y están preparados para una revisión de UX/calidad antes de ampliar a Controles de cambios.

## Próximo paso
Hito 7 — Controles de cambios.


## Hito 6.1 — Versionado transversal
Estado: **IMPLEMENTADO Y VALIDADO EN CI**.

Implementación:
- nueva entidad común `QmsRecordVersion`;
- separación entre historial de cambios y versión funcional;
- Desviaciones V00 + V01/V02… por reapertura;
- preservación de fechas de cierre históricas;
- CAPA V00 + una versión por seguimiento;
- próxima fecha, estado, ejecución, eficacia y cierres incluidos en snapshot;
- pestaña Versiones en Desviaciones y CAPA;
- descarga de Anexo III para cualquier snapshot persistido;
- `GeneratedDocument` vinculado a la versión origen;
- backfill idempotente para expedientes existentes sin inventar versiones históricas inexistentes;
- smoke test PostgreSQL específico incluido en CI.

### Regla para históricos 2025–2026
Los expedientes existentes se convierten en un baseline `HISTORICAL_STATE`. Si una CAPA ya dispone de una secuencia de seguimiento conocida, el baseline adopta esa secuencia. No se crean artificialmente V00/V01 intermedias cuando el sistema anterior no conservaba el snapshot necesario para reconstruirlas.

## Próximo paso tras integrar Hito 6.1
Hito 7 — Controles de cambios, reutilizando `QmsRecordVersion` para los seguimientos 00/01/02….


## Hito 7 — Controles de Cambios
Estado: **IMPLEMENTADO EN RAMA Y EN VALIDACIÓN CI**.

Fuente funcional:
- GC-00/003/03, revisión 03 de 06/04/2026.
- Anexo III: Solicitud de cambios.
- Anexo IV: Dictamen de cambios.
- Anexo V: Informe de Seguimiento y Control de un Cambio.
- Anexo VII: Listado de Controles de Cambio.

Implementación:
- módulo activado en navegación;
- listado principal con filtros horizontales, buscador y columnas operativas ampliadas;
- expediente a pantalla completa;
- Solicitud y Dictamen en el mismo expediente;
- plan de ejecución dinámico por departamento;
- bloqueo del baseline del Dictamen tras aprobación;
- seguimientos 00/01/02…;
- snapshot del estado de cada tarea por seguimiento;
- nuevas tareas de seguimiento con origen estructurado y etiqueta NUEVA Sxx;
- persistencia de esas tareas en seguimientos posteriores;
- ejecución, eficacia y cierre efectivo separados;
- cierre sin ejecución soportado con motivo documentado y eficacia No aplica;
- relaciones QMS e historial;
- versionado funcional reutilizando QmsRecordVersion;
- generación Anexo III, IV y V;
- descarga de Anexo V de cualquier versión histórica persistida;
- Anexo VII anual oficial;
- listado simple filtrado;
- pestaña de indicadores;
- configuración de formulario/plantillas v03;
- instalador de plantillas con validación SHA-256;
- smoke test PostgreSQL específico incluido en CI.

Plantillas auditadas:
- Anexo III SHA-256: a436d4aa732209e1aeb9620d5442a154a68899f875d1aa5d0dc437edd751a49f
- Anexo IV SHA-256: 742b1de11e0e0dece4e9c65c97613c112325189e183b9cb02c56ca82cd06cc60
- Anexo V SHA-256: 3012e81b0172c77c59c9c97514d788e10eb332a73e4490b9c0a1c87afa6ad1e4
- Anexo VII fuente SHA-256: bdef034e5de4f314d77696230e07f2796c2d139f4868c055d68688082622ce16

Pendiente para cerrar el hito:
- CI final verde;
- actualizar este estado a COMPLETADO Y VALIDADO;
- integrar la PR en main.
