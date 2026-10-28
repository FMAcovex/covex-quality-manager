# AGENTS.md — COVEX Quality Manager

## Misión

Construir y mantener una aplicación web interna de COVEX para gestionar procesos del Sistema de Calidad: Desviaciones, CAPA, Controles de cambios, Reclamaciones, Devoluciones, Auditorías y documentación controlada PNT, conforme a los requisitos y decisiones de `/docs`. Los siete módulos integrados se conservan; las ampliaciones deben ser incrementales.

La V1 tiene desarrollo funcional integrado, pero no está validada GMP ni autorizada para operación productiva regulada. Debe diseñarse para poder validarse en el futuro, sin afirmar que ya cumple los controles pendientes de identidad, autorización, audit trail y firma.

## Fuentes de verdad

Antes de cambiar comportamiento funcional, leer en este orden:

1. `docs/DECISIONS.md`
2. `docs/SPECIFICATION.md`
3. `docs/DATA_MODEL.md`
4. `docs/WORKFLOWS.md`
5. `docs/UI_SPEC.md`
6. `docs/DOCUMENTS.md`
7. `docs/GMP_SOURCES.md`
8. `docs/ROADMAP.md`
9. `docs/CURRENT_STATUS.md`
10. `docs/V1_BASELINE_AND_BACKLOG.md` (fotografía vigente; desambigua históricos)
11. `docs/QMS_TARGET_ARCHITECTURE.md` (arquitectura objetivo no implementada)

Prioridad en caso de conflicto:
- `DECISIONS.md`: decisiones expresamente cerradas.
- `GMP_SOURCES.md` y plantillas controladas: estructura documental y referencia GMP.
- `SPECIFICATION.md`: alcance funcional.
- resto de documentos: detalle de implementación.

No inventar reglas GMP, campos oficiales, plazos, estados, firmas, requisitos de cierre o codificaciones. Si una regla depende del PNT vigente y no está documentada, dejarla configurable o marcarla como pendiente de verificación.

## Principios funcionales

- Los datos estructurados de la aplicación son la fuente maestra de la V1.
- El Excel histórico deja de ser la fuente maestra una vez importado.
- Los documentos se generan a partir de los registros estructurados.
- El usuario descarga manualmente los documentos generados en la V1.
- No integrar SharePoint, Microsoft Graph, Entra ID ni Power Automate en el MVP salvo decisión posterior.
- Una desviación puede generar cero, una o varias CAPA.
- Una CAPA puede estar relacionada con una o varias desviaciones u otros expedientes cuando proceda.
- Las relaciones entre expedientes son N:N y pueden existir entre cualquier módulo compatible.
- Estado de expediente y editabilidad son conceptos diferentes. Respetar las reglas aprobadas por módulo y los controles de versiones; no generalizar editabilidad de expedientes cerrados a PNT u otros procesos.
- El historial de modificaciones de la V1 es operativo; no denominarlo audit trail GMP.
- No borrar físicamente expedientes de negocio desde la interfaz normal. Preparar borrado lógico o inactivación si se necesita.
- Usar UUID interno inmutable separado del código visible de negocio.

## Consolidación V1 y evolución acordada (2026-10-10)

- Preservar íntegramente el diseño actual, la navegación principal y el lenguaje visual corporativo. **No rediseñar**; solo maquetación más clara de filtros/indicadores de listados, con aceptación visual.
- Mejoras UX funcionales: retorno con contexto, ayuda, búsquedas/vistas y errores inline, conservando el guardado **explícito** (sin autoguardado silencioso), versiones, históricos y pruebas.
- Extensibilidad futura por contratos de módulos y servicios transversales, no abstraer prematuramente ni cambiar los ciclos aprobados.
- Login corporativo, RBAC, flujos de aprobación, firma electrónica y audit trail GMP son **objetivos de evolución**: no están disponibles como capacidades corporativas validadas; exigen especificación, análisis de riesgos, seguridad y aceptación formal.
- La PR A es exclusivamente documental. Las PR B/C y dashboard/backend/IT seguirán el roadmap nuevo y requerirán aprobación de alcance.
- Consulte `docs/ROADMAP.md` (sección vigente), `docs/V1_BASELINE_AND_BACKLOG.md` y `docs/QMS_TARGET_ARCHITECTURE.md` antes de cualquier nueva PR.

## Separación de contenido de desviaciones

Mantener estrictamente separados:
- descripción del evento;
- acciones inmediatas;
- investigación;
- evaluación de impacto;
- causa raíz;
- CAPA;
- seguimiento;
- eficacia;
- conclusión/cierre.

No duplicar razonamientos ni convertir hipótesis en causas confirmadas.

## Documentos controlados

Las plantillas aprobadas deben cumplimentarse, no rediseñarse.

Para Desviaciones:
- Anexo III: Informe de Desviación.
- Anexo V: Listado general de desviaciones, incluido el formato detallado y la vista simplificada/imprimible.

Una nueva versión de PNT/anexo se incorpora como nueva versión de formulario/plantilla. Los históricos conservan referencia a la versión con la que fueron creados.

## Arquitectura

Objetivo inicial:
- Next.js + TypeScript + React.
- PostgreSQL.
- Prisma.
- monolito modular.
- generación DOCX/XLSX en servidor.
- plantillas versionadas.
- despliegue local/demo primero.
- Azure/Entra/SharePoint solo en fase posterior.

No usar microservicios en V1.

## Calidad de desarrollo

Para cada hito:
- trabajar en rama `feature/hito-XX-...`;
- limitar cambios al alcance del hito;
- validar entradas en servidor además de cliente;
- añadir/actualizar pruebas;
- ejecutar lint, tests, Prisma validate y build;
- no introducir secretos en código;
- usar variables de entorno;
- actualizar `docs/CURRENT_STATUS.md`;
- actualizar `docs/DECISIONS.md` si se cierra una decisión estructural;
- no avanzar al siguiente hito con errores conocidos críticos;
- antes de fusionar cada PR, pasar el diff completo a un agente revisor independiente: contexto nuevo, sin el razonamiento de quien lo implementó, con acceso al código y a `/docs`. Busca errores de funcionamiento, permisos y seguridad, migraciones y captura del audit trail, pruebas que falten y desviaciones de `docs/DECISIONS.md` y de este fichero;
- los hallazgos críticos o importantes se corrigen antes de fusionar, cada uno con una prueba que falle antes del arreglo. Los menores o descartados se explican en la PR. La descripción de la PR resume el resultado de la revisión;
- la revisión por agente no sustituye a la revisión humana ni a la validación GMP.

Preferir implementaciones sencillas y mantenibles a abstracciones prematuras.

## Datos y privacidad

- En desarrollo usar datos ficticios salvo instrucción expresa para una importación controlada.
- No subir datos personales reales innecesarios al repositorio.
- Los ficheros de importación reales no deben versionarse salvo decisión expresa.
- Nunca incluir contraseñas, tokens, cadenas de conexión o secretos.

## Alcance fuera del MVP

No implementar sin decisión expresa:
- firma electrónica;
- aprobación electrónica GMP;
- audit trail validado;
- bloqueo regulatorio definitivo de expedientes cerrados;
- Microsoft Entra ID (hasta fase autorizada de IT);
- permisos corporativos por rol;
- integración automática SharePoint/Graph;
- creación automática de carpetas SharePoint;
- alarmas por correo;
- sustitución automática de archivos corporativos;
- IA que determine causas raíz, impacto o decisiones GMP por sí sola.
