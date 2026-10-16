# Arquitectura objetivo V1+ — extensibilidad y futura validabilidad GMP

**Estado:** objetivos de arquitectura aceptados para orientar desarrollos, **no funciones ya implementadas**. **Fecha:** 2026-10-10. Mantener monolito modular actual (Next.js/React/TypeScript, Prisma/PostgreSQL), sin migración de stack ni microservicios en esta fase.

## Objetivo

Evolucionar COVEX Quality Manager hacia QMS corporativo configurable, extensible y potencialmente validable. ShareMe y Veeva son referencias de capacidades, no obligaciones de equivalencia ni propuestas de migración. La validación depende de uso previsto, procedimientos, infraestructura, configuración, riesgos y evidencias, no únicamente del código.

## Restricciones aprobadas

1. Conservar **estética, navegación principal, colores, menú y composición** trabajados. No rediseñar el producto.
2. UX visual de Fase 1: solamente mejorar maquetación/espaciado/agrupación de filtros e indicadores de **listados**. Las demás mejoras de UX serán funcionales y coherentes con el diseño.
3. Mantener guardado explícito, cambios pendientes visibles, errores junto al campo, protección ante doble envío y concurrencia; prohibido autoguardado silencioso en expedientes GMP.
4. Conservar reglas de cada PNT, fases, UUID, codificación, snapshots, archivos emitidos, historiales e integridad. No homogeneizar por fuerza ciclos de vida distintos.
5. No simular aprobación ni firma. La carga/importación no acredita vigencia ni conformidad documental.
6. Resolver mejoras como PR pequeñas, con pruebas focalizadas y regresión transversal según riesgo, sin supresión de verificaciones para acelerar CI.

## Capas y contratos futuros (diseño, NO implementación)

- **Experiencia:** componentes de layout existentes, listados, búsqueda, filtros, estados, dashboard. Mejoras por componentes compartidos y adaptadores de módulo.
- **Dominio de módulos:** Desviaciones, CAPA, Controles de Cambios, Reclamaciones, Devoluciones, Auditorías, PNT; nuevos módulos opcionales mediante contrato explícito que declare capacidades y ciclos de vida.
- **Servicios transversales:** identidad/autorización; tareas/notificaciones; catálogos/versiones de formularios; documentos/plantillas; relaciones QMS; auditoría de operaciones; definición/ejecución de flujos y firmas futuras.
- **Persistencia/integración:** PostgreSQL, integridad transaccional, custodia documental según análisis de volumen; conectores Microsoft 365 opcionales; salida y restauración probadas.

### Extender módulos de forma segura

Antes de añadir módulos, definir contratos versionados de: identidad de expediente y código visible; navegación/filtros/listado; permisos/operaciones; tipos de relación permitidos; documentos y su procedencia; versionado y eventos; tareas; KPI. Preferir composición/adaptadores a tablas universales que obliguen a PNT o Auditorías a usar estados ajenos. La incorporación de un módulo no debe requerir migración masiva de expedientes existentes. Diseño propuesto, pendiente de aprobación, en [MODULE_CONTRACT.md](MODULE_CONTRACT.md).

Futuros dominios **no comprometidos para V1**: Proveedores/homologación, OOS/OOT (OOS aprobado en D-088, diseño en OOS_DESIGN.md), validación/cualificación, riesgos, formación, calibración/mantenimiento, PQR/APQR e inspecciones. Training Manager permanece independiente hasta una decisión específica de integración e identidad.

## Identidad, permisos y separación de funciones — diseño futuro

- Elegir autenticación corporativa con IT (Microsoft Entra como opción preferente si disponible); no asumir que escribir el nombre de actor en formulario es identidad autenticada.
- Autorización **en servidor** por identidad, rol, módulo, expediente, acción y estado, incluido acceso a descargas y API; denegación por defecto y registro de denegaciones relevantes según riesgo.
- Definir roles de preparación, revisión, aprobación, administración y consulta junto a QA/DT. Separar permisos administrativos de permisos de aprobar contenido. La responsabilidad documental no sustituye comprobaciones de acceso.
- Segregación de funciones, delegaciones temporales, bajas, sesiones y acceso de emergencia deberán decidirse con QA/IT y documentarse.

## Flujos versionados y firmas — capacidades futuras

- Motor configurable con definiciones **versionadas**, transiciones explícitas (preparación, revisión, devolución, aprobación, vigencia cuando aplique), responsables, condiciones, tareas y escalado.
- Cada instancia fija la **versión exacta de la definición** al iniciarse. Cambiar la configuración no reescribe instancias ni evidencias históricas.
- Aprobación referida al **snapshot/archivo concreto**, no a una versión que pueda cambiar después. Bloquear/invalidar propuestas obsoletas y exigir nueva decisión ante revisiones.
- Firma electrónica distinta de login y de imagen o PDF recibido: evaluar identidad/reauthentication, intención/significado, momento, vinculación a registro y versión, irreversibilidad lógica, verificación de integridad y requisitos GMP/eIDAS aplicables al uso. No diseñar equivalencia automática con 21 CFR Part 11 sin análisis de aplicabilidad.
- Ningún motor de workflow ni firma corporativa GMP se declara ya disponible; antes de implementar, preparar URS, riesgos y prototipo delimitado.

## Datos e integridad regulada

Conservar UUID de entidades y decisiones, snapshots, hashes, append-only donde proceda. Evaluar con QA audit trail conforme a riesgos: autor autenticado, cuándo/qué cambió, valores previos/nuevos, motivo, acceso y retención; revisión periódica y extracción legible. **Historial operativo V1 != audit trail GMP validado**. Considerar ALCOA+, EU GMP Annex 11 y Annex 15 aplicables; requisitos jurídicos y revisión futura de normativa deben confirmarse con Asuntos Regulatorios/QA en el momento de implantación.

No ocultar discrepancias al importar históricos ni reescribir bytes/documentos emitidos. Criterios de retención y recuperación por tipo de registro a acordar con QA/IT.

## Backend/CI e IT

1. Medir antes de optimizar: tamaño de tablas/documentos, consultas, paginación, tiempos p95, uso CPU/RAM, crecimiento de backups y concurrencia real. Índices solo con evidencias.
2. Mantener transacciones, restricciones de BD, idempotencia, bloqueos y checksums ya verificados; pruebas adversarias en los límites de permisos/descarga.
3. CI por impacto: lint/tipos/unitarias focalizadas, PostgreSQL/browser afectados, contratos comunes y batería completa antes de candidate release; registrar métricas de tiempo y no desactivar pruebas críticas.
4. Parche React/Next 15.5.26 documentado en CI_583_R4B_DIAGNOSIS.md: resolver mediante upgrade controlado y pruebas sin/con parche, **nunca retirarlo por intuición**.
5. IT: servidor dedicado o VM evaluados con IT, Node compatible, servicio controlado, PostgreSQL administrado, HTTPS, configuración secret-safe, actualización, supervisión, backup automático restaurable, pruebas de recuperación y responsabilidades de soporte.
6. Despliegues trazables: commit, versión, migraciones auditables, reversibilidad de aplicación/datos según riesgo y separación desarrollo/prueba/operación.

## Criterio para usar el término «GMP validado»

No etiquetar V1, PRs ni CI como «validado GMP». Exigir: uso previsto definido; requisitos trazables; análisis de riesgos; especificaciones y controles; evidencia de pruebas formales en ambiente representativo; autorización, firma y trazabilidad verificadas según aplicabilidad; procedimientos de operación/seguridad/backup/cambio; formación y aceptación formal. Una futura ampliación tiene análisis de impacto y validación proporcional, no validación cero ni exigencia de revalidar todo indiscriminadamente.

## ADR/decisiones y gobernanza

Las decisiones ejecutables y cerradas se mantienen en DECISIONS.md; ROADMAP.md planifica; CURRENT_STATUS.md guarda hitos históricos; V1_BASELINE_AND_BACKLOG.md distingue lo integrado de lo pendiente. Cada PR deberá declarar impacto en reglas GMP, seguridad, documentos, datos, compatibilidad y riesgos y su plan de rollback o recuperación cuando aplique.
