# Estado actual

Fecha: 2026-09-29.

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
Desviaciones, CAPA y Controles de Cambios comparten ya la plataforma común de expedientes, relaciones, documentos, versionado e indicadores.


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

## Continuidad tras Hito 6.1
El mecanismo `QmsRecordVersion` se reutiliza en Controles de Cambios para los seguimientos 00/01/02….


## Hito 7 — Controles de Cambios
Estado: **COMPLETADO Y VALIDADO EN CI**.

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
- Anexo VII fuente SHA-256: b65671cdd652f104f4038c65e07c025b5c7374dee4b683d74fbeef55f12bc8eb

Validación:
- PostgreSQL 16 real;
- esquema y seed;
- smoke QMS existente;
- smoke específico del ciclo de vida de Controles de Cambios;
- versionado de seguimientos;
- Prisma validate/generate;
- lint;
- tests;
- build Next.js de producción.

El hito queda listo para integración en `main`.


## Hito 8 — Reclamaciones y Devoluciones
Estado: **COMPLETADO Y VALIDADO EN CI**.

### Reclamaciones
Fuente:
- GC-00/027/02, vigencia 26/05/2026.
- Anexo III: Informe de la Reclamación.
- Anexo IV: Informe de Respuesta a Reclamación.
- Anexo V: Listado de Reclamaciones.

Implementación:
- listado, filtros y búsqueda;
- alta/edición;
- expediente a pantalla completa;
- reclamación de cliente / a proveedor;
- investigación, impacto y causa raíz;
- Crítica/Mayor/Menor/Sin impacto GMP;
- resolución estructurada;
- CAPA propuestas 1:N y creación de CAPA real;
- comunicación y respuesta;
- eficacia y cierre;
- seguimientos;
- relaciones QMS;
- historial y snapshot V00;
- Anexos III/IV/V;
- listado simple;
- indicadores y tendencia 5 años.

### Devoluciones
Fuente:
- GC-00/028/03, vigencia 26/05/2026.
- Anexo III: Formulario de Devolución.
- Anexo IV: Hoja de Devolución de Producto.
- Anexo V: Declaración del Cliente sobre Conservación.
- Anexo VI: Listado de Devoluciones.

Implementación:
- listado, filtros y búsqueda;
- alta/edición;
- expediente a pantalla completa;
- productos 1:N;
- criterios SI/NO/N.A. para reintegración;
- evaluación específica de termolábiles;
- decisión GC/DT;
- destino final, destrucción y trazabilidad;
- seguimientos;
- relaciones QMS;
- historial y snapshot V00;
- Anexos III/IV/V/VI;
- listado simple;
- indicadores y tendencia 5 años.

Plantillas:
- Reclamaciones SHA-256: f717ae907da9ed8b575f740fbf8b1536d4157174de5b7b4d240220910b570df4
- Devoluciones SHA-256: 191c0e838f06d465bd820450b9130e1209c14fc9cb97559e8ec567819ba07f9a

Validación:
- PostgreSQL 16 real;
- esquema y seed;
- smoke QMS existente;
- smoke específico Reclamaciones + Devoluciones;
- relaciones Reclamación → Devolución y Reclamación → CAPA;
- Prisma validate/generate;
- lint;
- tests;
- build Next.js de producción.

El hito queda listo para integración en `main`.


## Hito 9 — Administración y evolución
Estado: **COMPLETADO Y VALIDADO EN CI**.

Implementación:
- centro de Administración con navegación propia;
- departamentos con vigencia y activación/desactivación;
- catálogos auxiliares y valores 1:N;
- política no destructiva;
- historial `ConfigurationChange`;
- versiones de formulario DRAFT/ACTIVE/RETIRED;
- clonación de versiones conservando configuración de campos;
- edición de metadatos de campos solo en borradores;
- bloqueo de versiones activas;
- activación con retirada automática de la versión anterior;
- registro de versiones de plantilla;
- carga DOCX/XLSX desde Administración;
- almacenamiento de plantilla en PostgreSQL;
- cálculo/verificación SHA-256;
- fallback a plantillas históricas instaladas;
- parámetros tipados;
- reglas de vencimiento configurables;
- bandeja central de próximos y vencidos;
- envío automático desactivado;
- smoke test específico de administración añadido a CI.

Validación:
- PostgreSQL 16 real;
- esquema y seed;
- smoke tests QMS existentes;
- smoke específico de Administración;
- catálogos, parámetros y reglas de vencimiento;
- clonación de formularios y conservación de configuración;
- almacenamiento binario de plantillas y checksum;
- Prisma validate/generate;
- lint;
- tests;
- build Next.js de producción.

El Hito 9 queda listo para integración en `main`.


## Hito 10 — Endurecimiento y demo
Estado: **COMPLETADO Y VALIDADO EN CI**.

Implementación:
- cabeceras HTTP de seguridad comunes para toda la aplicación;
- bloqueo de indexación por robots y cabecera `X-Robots-Tag`;
- health check real contra PostgreSQL con respuesta 503 degradada sin detalle técnico;
- páginas globales de error, recurso no encontrado y estado de carga;
- exportación lógica completa de todos los modelos Prisma;
- serialización explícita de fechas, bytes y bigint;
- checksum SHA-256 del backup;
- verificador de formato, modelos y recuentos;
- carpeta de backups excluida de Git;
- dataset ficticio idempotente con cinco expedientes `DEMO-`;
- relaciones ficticias Desviación → CAPA y Reclamación → Devolución;
- guardas que impiden ejecutar la carga demo sin `ALLOW_DEMO_DATA=true` o con `APP_ENV=production`;
- smoke test específico del Hito 10 integrado en CI.

Límites mantenidos:
- no se incorpora autenticación Entra ID;
- no se crean roles corporativos;
- no se activa envío automático de alertas;
- el backup lógico no se presenta como política corporativa de backup/DR;
- la V1 sigue identificada como herramienta piloto no validada GMP.

Validación final:
- PostgreSQL 16 real;
- seed base + dataset demo;
- smoke tests acumulados de Hitos 1–10;
- pruebas unitarias de cabeceras y serialización de backup;
- Prisma validate/generate;
- lint;
- tests;
- build Next.js de producción.


## Hito 10.2 — Anexos oficiales y adecuación de registros
Estado: **IMPLEMENTADO; PENDIENTE DE VALIDACIÓN FINAL EN CI**.

Objetivo:
- adaptar los generadores a los anexos aportados el 28/09/2026;
- comprobar que los registros estructurados contienen todos los datos necesarios para cumplimentar Word y listados;
- mantener históricos por versión de formulario/plantilla.

Cambios:
- Desviaciones Anexo V adaptado a la plantilla oficial A:F aportada, incluyendo fecha + departamento en una única celda y color ABIERTA/CERRADA según leyenda;
- CAPA Anexo IV mantiene campos combinados y colorea filas según la leyenda oficial;
- Reclamaciones incorpora REC-03 como versión candidata de prueba, manteniendo REC-02 para histórico;
- nuevo registro estructurado de Reclamaciones v03 alineado con Partes I y II del Anexo III;
- Reclamaciones v03 no genera respuesta formal al cliente desde la aplicación;
- Reclamaciones Anexo V anual se genera en XLSX oficial;
- Devoluciones incorpora fechas independientes de recepción/verificación por producto;
- Devoluciones incorpora firmante, puesto, fecha y observaciones de declaración del cliente;
- Anexos IV y V de Devoluciones se gestionan como plantillas independientes extraídas del PNT;
- Devoluciones Anexo VI anual se genera en XLSX oficial;
- matriz de anexos y SHA-256 documentada en `docs/ANNEX_MAPPING.md`.

Nota GMP:
GC-00/027/03 se configura únicamente como versión candidata para esta fase de prueba porque el usuario ha indicado que todavía no está formalmente en vigor. Su activación productiva deberá coincidir con la entrada en vigor documental correspondiente.


## Hito 10.8C3-B1 — Modelo y reglas transversales de relaciones QMS
Estado: **IMPLEMENTADO Y VALIDADO EN CI**.

Infraestructura común:
- matriz direccional única para Desviación → CAPA, Reclamación → CAPA y Reclamación → Devolución;
- validación de ambos extremos como IDs reales de `QmsRecord`;
- creación idempotente mediante la unicidad `(sourceRecordId, targetRecordId, relationType)`;
- reactivación de una relación desactivada sin crear otra fila;
- consultas comunes de relaciones salientes y entrantes para derivar la vista inversa;
- errores funcionales para combinaciones inválidas, autorrelaciones e IDs inexistentes;
- escritura centralizada desde Desviaciones, CAPA, Reclamaciones, Devoluciones y carga DEMO;
- Control de Cambios excluido de las nuevas relaciones operativas.

No se modifica el versionado funcional, anexos, plantillas ni generadores documentales.

Validación:
- PostgreSQL 16, esquema, seed y dataset DEMO;
- auditoría histórica: 0 relaciones incompatibles detectadas en el dataset de CI;
- smoke transversal de relaciones y smoke tests acumulados;
- Prisma validate/generate;
- 75 tests unitarios;
- lint sin avisos;
- build Next.js de producción.

## Hito 10.8C3-B2.1 — Flujo canónico Desviación → CAPA
Estado: **COMPLETADO, VALIDADO Y FUSIONADO EN MAIN (PR #39)**.

Cambios limitados a backend:
- una propuesta `DeviationCapaPlan` en estado `PROPOSED` puede generar una única CAPA real;
- la propuesta se marca `REGISTERED` y conserva `linkedCapaRecordId` únicamente para identificar qué propuesta originó qué CAPA;
- la relación de negocio se crea una sola vez mediante `QmsRelation` Desviación → CAPA;
- cuando existe `fromDeviationPlanId`, se omite la creación genérica adicional basada en `originCode`;
- `originType` y `originCode` de la CAPA se canonicalizan desde la Desviación de la propuesta;
- dos propuestas distintas de la misma Desviación pueden generar dos CAPA distintas;
- propuestas ya registradas o canceladas no pueden generar una CAPA adicional;
- actualización de propuesta y creación de relación permanecen dentro de la misma transacción de alta de CAPA.

B2.1 no incluye rediseño visual ni prueba transversal manual.

## Hito 10.8C3-B2.2 — UX y navegación Desviación ↔ CAPA
Estado: **COMPLETADO, VALIDADO Y FUSIONADO EN MAIN (PR #40)**.

Cambios de interfaz:
- el resumen de Desviación muestra cada propuesta CAPA una sola vez;
- una propuesta `PROPOSED` ofrece `Crear CAPA`;
- una propuesta `REGISTERED` muestra su código y ofrece `Abrir CAPA`;
- una propuesta `CANCELLED` no ofrece crear CAPA;
- se elimina del resumen el bloque redundante adicional de CAPA vinculadas;
- la pestaña `Relaciones` conserva la vista derivada desde `QmsRelation`;
- en CAPA, el código de origen enlaza al expediente cuando existe un único origen QMS;
- las tarjetas de origen identifican explícitamente `Desviación de origen` o `Reclamación de origen`.

Se añaden pruebas unitarias para la lógica de navegación de propuestas.

## Hito 10.8C3-B2.3 — Prueba transversal Desviación → dos CAPA
Estado: **COMPLETADO Y VALIDADO EN CI — PR #41**.

Se añade un smoke transversal con PostgreSQL real que comprueba:
- una Desviación con dos propuestas CAPA independientes;
- ambas propuestas comienzan en `PROPOSED`;
- cada propuesta genera una CAPA distinta;
- ambas propuestas terminan en `REGISTERED` y conservan su `linkedCapaRecordId`;
- existen exactamente dos `QmsRelation` `Desviación → CAPA`;
- repetir la creación lógica de la misma relación no duplica filas;
- no existen relaciones inversas artificiales `CAPA → Desviación`;
- cada CAPA recupera la misma Desviación como origen mediante la vista inversa;
- la lógica de navegación de cada propuesta registrada devuelve `Abrir CAPA`;
- los enlaces QMS de ida y vuelta se resuelven con el identificador del expediente correcto.

El smoke queda registrado como `pnpm b2-3:smoke` y se ejecuta en el workflow CI antes del smoke general de Hito 10.

## Hito 10.8C3-B3.1 — Flujo canónico Reclamación → CAPA
Estado: **COMPLETADO, VALIDADO Y FUSIONADO EN MAIN (PR #42)**.

Cambios limitados a backend:
- una propuesta `ComplaintCapaPlan` en estado `PROPOSED` puede generar una única CAPA real;
- la propuesta se marca `REGISTERED` y conserva `linkedCapaRecordId` solo para identificar qué propuesta originó qué CAPA;
- la relación de negocio se crea una sola vez mediante `QmsRelation` Reclamación → CAPA;
- cuando existe `fromComplaintPlanId`, no se crea además otra relación mediante `originCode`;
- `originType` y `originCode` se canonicalizan desde la Reclamación real asociada a la propuesta;
- propuestas registradas o canceladas no pueden generar una CAPA adicional;
- el cambio de propuesta a `REGISTERED` se protege con actualización condicionada dentro de la misma transacción;
- la creación directa desde `fromComplaintId` usa también una única relación explícita y no duplica el intento mediante `originCode`;
- las CAPA creadas manualmente sin origen explícito conservan el fallback existente por `originCode`.

Se añaden pruebas unitarias del flujo canónico, reutilización bloqueada, cambio concurrente y creación directa.

## Hito 10.8C3-B3.2 — UX y navegación Reclamación ↔ CAPA
Estado: **COMPLETADO, VALIDADO Y FUSIONADO EN MAIN (PR #43)**.

Cambios de interfaz:
- Reclamaciones y Desviaciones reutilizan una única lógica compartida de estados/navegación de propuestas CAPA;
- una propuesta `PROPOSED` muestra `Pendiente` y ofrece `Crear CAPA`;
- una propuesta `REGISTERED` muestra `Registrada`, su código y `Abrir CAPA`;
- una propuesta `CANCELLED` muestra `Cancelada` y no ofrece crear otra CAPA;
- el resumen de Reclamación usa tarjetas vinculadas coherentes con Desviaciones;
- la navegación abre el expediente CAPA a través del resolver QMS;
- la pestaña `Relaciones` sigue mostrando todas las relaciones reales Reclamación → CAPA/Devolución;
- la vista CAPA → Reclamación de origen ya queda cubierta por la UX común introducida en B2.2.

La lógica compartida conserva pruebas unitarias para los tres estados.

## Hito 10.8C3-B3.3 — Prueba transversal Reclamación → dos CAPA
Estado: **COMPLETADO Y VALIDADO EN CI — PR #44**.

Se añade un smoke transversal con PostgreSQL real que comprueba:
- una Reclamación con dos propuestas CAPA independientes;
- ambas propuestas comienzan en `PROPOSED`;
- cada propuesta genera una CAPA distinta;
- ambas propuestas terminan en `REGISTERED` con su `linkedCapaRecordId` y código CAPA;
- existen exactamente dos `QmsRelation` `Reclamación → CAPA`;
- reintentar la misma relación no crea filas duplicadas;
- no existen relaciones inversas artificiales `CAPA → Reclamación`;
- cada CAPA recupera la misma Reclamación como origen mediante la vista inversa;
- la lógica compartida de navegación devuelve `Abrir CAPA` para ambas propuestas registradas;
- los enlaces QMS de ida/vuelta resuelven el expediente correcto.

El smoke queda registrado como `pnpm b3-3:smoke` y se ejecuta permanentemente en CI.

## Hito 10.8C3-B4.1 — Flujo canónico Reclamación → Devolución
Estado: **COMPLETADO, VALIDADO Y FUSIONADO EN MAIN (PR #45)**.

Cambios limitados a backend:
- cuando una devolución se crea con `fromComplaintId`, la Reclamación se resuelve dentro de la misma transacción;
- si la Reclamación ya no existe, el alta falla con un mensaje funcional y no se crea una devolución huérfana;
- `returnType` se canonicaliza a `COMPLAINT`;
- `relatedDocument` se canonicaliza al código de negocio de la Reclamación real;
- la relación de negocio se crea una sola vez como `QmsRelation` Reclamación → Devolución;
- una misma Reclamación puede originar varias Devoluciones distintas;
- reintentar la misma relación exacta sigue siendo idempotente por la capa común de relaciones;
- las Devoluciones creadas manualmente sin `fromComplaintId` mantienen su comportamiento actual.

Se añaden pruebas unitarias para resolución de origen, origen inexistente, varias devoluciones por reclamación e idempotencia.

## Hito 10.8C3-B4.2 — UX y navegación Reclamación ↔ Devolución
Estado: **COMPLETADO, VALIDADO Y FUSIONADO EN MAIN (PR #46)**.

Cambios de interfaz:
- al crear una Devolución desde una Reclamación, el campo Tipo se muestra fijado a `Reclamación`;
- el Documento relacionado se muestra fijado al código de la Reclamación de origen;
- ambos valores se envían mediante campos ocultos y coinciden con la canonicalización del servidor;
- el Resumen de Devolución muestra el Documento relacionado como enlace cuando existe un único origen QMS;
- el Resumen incorpora una tarjeta `Reclamación de origen` navegable;
- la pestaña `Relaciones` conserva la vista inversa derivada de la única `QmsRelation` Reclamación → Devolución;
- la Reclamación continúa mostrando sus Devoluciones derivadas sin duplicar relaciones.

## Hito 10.8C3-B4.3 — Prueba transversal Reclamación → dos Devoluciones
Estado: **COMPLETADO, VALIDADO Y FUSIONADO EN MAIN (PR #47)**.

Se añade un smoke transversal con PostgreSQL real que comprueba:
- una Reclamación que origina dos Devoluciones distintas;
- ambas Devoluciones conservan `returnType = COMPLAINT`;
- ambas conservan como `relatedDocument` el código real de la Reclamación;
- cada Devolución incluye producto ficticio propio para simular el flujo real;
- existen exactamente dos `QmsRelation` Reclamación → Devolución;
- reintentar la misma relación no crea filas duplicadas;
- no existen relaciones inversas artificiales Devolución → Reclamación;
- cada Devolución recupera la Reclamación como origen mediante la vista inversa;
- la Reclamación recupera las dos Devoluciones como expedientes derivados;
- los enlaces QMS ida/vuelta resuelven el expediente correcto.

El smoke queda registrado como `pnpm b4-3:smoke` y se ejecuta permanentemente en CI.

## Hito 10.8C3-C1 — Flujo canónico de seguimiento y versión CAPA
Estado: **COMPLETADO, VALIDADO Y FUSIONADO EN MAIN (PR #48)**.

Diagnóstico:
- `QmsRecordVersion` ya soportaba correctamente V00 y V01/V02… por seguimiento;
- el Anexo III histórico ya puede generarse desde cualquier snapshot persistido;
- el formulario de seguimiento solo registraba texto, evidencia y próxima fecha;
- para cambiar estado, cierre operativo o eficacia era necesario editar la CAPA por separado, lo que podía actualizar la versión vigente antes de crear el siguiente seguimiento.

Cambios:
- el seguimiento CAPA incorpora el estado que debe quedar vigente después del seguimiento;
- puede registrar en la misma operación estado Abierta/Cerrada/Cancelada, cierre operativo y conclusión;
- puede actualizar eficacia, criterio, valoración, evidencia y cierre efectivo;
- las reglas de cierre ya documentadas se validan antes de persistir;
- una CAPA que permanece abierta sigue requiriendo motivo y próxima fecha;
- el cierre operativo requiere fecha, conclusión y evidencia de ejecución en el seguimiento actual o en uno anterior;
- una cancelación requiere motivo;
- el cierre efectivo requiere estado Cerrada, eficacia Conforme y valoración documentada;
- seguimiento, actualización del expediente, historial y creación de V01/V02 se ejecutan en una única transacción;
- no se añaden campos nuevos a Prisma: el estado histórico de cada seguimiento se conserva en el snapshot funcional `QmsRecordVersion`.

Se añaden pruebas unitarias de las transiciones.

## Hito 10.8C3-C2 — UX e histórico de seguimientos CAPA
Estado: **COMPLETADO, VALIDADO Y FUSIONADO EN MAIN (PR #49)**.

Cambios de interfaz:
- el formulario identifica explícitamente qué seguimiento y versión V01/V02… se va a crear;
- la captura se organiza en tres bloques: seguimiento/evidencia, estado/cierre operativo y verificación de eficacia;
- estado y eficacia parten de los valores vigentes del expediente;
- los campos de cierre/cancelación se muestran según el estado seleccionado;
- ejecución/cierre operativo y eficacia se presentan como conceptos separados;
- cada tarjeta histórica de seguimiento resuelve la `QmsRecordVersion` exacta mediante `sourceEntityId`, con fallback por secuencia para históricos;
- cada seguimiento muestra versión, estado CAPA, eficacia y si la versión es histórica o vigente;
- se muestran cierre operativo, cierre efectivo y próxima fecha correspondientes;
- desde el propio seguimiento se puede descargar el Anexo III de esa versión exacta;
- se añade helper probado para resolver seguimiento ↔ versión y calcular la siguiente secuencia.

No se modifica el modelo de datos ni las reglas de transición de C1. Queda pendiente C3: prueba transversal V00 → V01 → V02 con documentos históricos.


## Hito 10.8C3-C3 — Prueba transversal CAPA V00 → V01 → V02
Estado: **EN VALIDACIÓN EN RAMA**.

Se añade un smoke PostgreSQL con la acción real de seguimiento: V00 abierta y eficacia pendiente; V01 abierta con actuación, evidencia y próxima fecha; V02 cerrada con cierre operativo y eficacia conforme. Comprueba snapshots históricos, congelación de V00/V01, vínculo `sourceEntityId` y resolución del histórico sin modificar C1/C2.

Se corrige la interpretación de `?version=0/1/2` en la descarga de Anexo III, que anteriormente trataba esas peticiones como versión vigente. El parser tiene pruebas para V00, V01, V02 e inválidos.

`pnpm c3:smoke` verifica el ciclo y limpia sus datos ficticios. Con el servidor en marcha y la plantilla oficial instalada, `C3_BASE_URL=<URL de la app> pnpm c3:smoke` descarga los tres DOCX, inspecciona el contenido diferenciado y comprueba el vínculo `GeneratedDocument.recordVersionId`. Sin `C3_BASE_URL`, el smoke no afirma haber probado los documentos.


## Mejora transversal — Anulación administrativa de expedientes
Estado: **IMPLEMENTADA EN RAMA; PENDIENTE DE VALIDACIÓN FINAL**.

- aplica a Desviaciones, CAPA, Controles de Cambios, Reclamaciones y Devoluciones;
- no existe borrado físico;
- motivo y usuario obligatorios;
- conservación del código histórico y liberación del código para reutilización;
- filtro común Activos / Anulados / Todos, con Activos por defecto;
- expedientes anulados identificados expresamente;
- relaciones históricas conservadas e identificadas;
- bloqueo de nuevas relaciones con anulados;
- reactivación condicionada a que el código original continúe libre;
- exportaciones e indicadores excluyen anulados por defecto.
