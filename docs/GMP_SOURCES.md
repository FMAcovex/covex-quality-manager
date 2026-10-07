# Fuentes GMP y documentos de referencia

## Regla general

La aplicación debe basarse en las versiones controladas vigentes de los PNT y anexos de COVEX.

No asumir que un fichero de trabajo con sufijos de revisión como `_CSM`, `_CG` u otros constituye por sí mismo la versión aprobada vigente. Antes de producción debe verificarse la copia controlada aplicable.

## Baseline de diseño — Desviaciones

Referencia funcional inicial:
- PNT GC-00/023, revisión 06.
- Anexo III: Informe de Desviación 06.
- Anexo V: Listado de Desviaciones 06.
- Listado general histórico/operativo 2025-2026.

La estructura del Anexo III revisada para el diseño incluye:
- origen;
- documentación afectada;
- descripción;
- acciones inmediatas;
- investigación;
- metodología;
- causa raíz;
- clasificación;
- impacto;
- decisión CAPA;
- planificación CAPA;
- conclusión/cierre;
- disposición;
- firmas.

## Baseline CAPA

Referencia funcional:
- PNT GC-00/030, revisión vigente a verificar antes de implementación del Hito 6.

Principios que deben preservarse:
- coherencia con documento de origen;
- acciones vinculadas a causa raíz;
- seguimientos con evidencia;
- estados controlados por PNT;
- eficacia separada de ejecución;
- trazabilidad origen -> causa -> CAPA -> seguimiento -> eficacia -> cierre.

## Otras referencias futuras

- Controles de cambios: GC-00/003.
- Reclamaciones: GC-00/027.
- Devoluciones: GC-00/028.

Verificar revisión vigente y anexos antes de implementar cada módulo.

## Control de cambios de fuente

Cuando cambie un PNT/anexo:
1. registrar la nueva fuente;
2. añadir FormVersion/TemplateVersion;
3. evaluar cambios de campos/reglas;
4. crear migración de esquema si procede;
5. no reescribir históricos automáticamente;
6. actualizar pruebas documentales.

## Plazos

No codificar plazos reglados basándose únicamente en un Excel histórico o memoria de proyecto. Confirmar el PNT vigente y, preferiblemente, modelarlos como configuración versionada.


## Fuentes de Auditorías comunicadas para R3A

Fuentes funcionales declaradas y aprobadas por el usuario: GC-00/033/03 Auditorías internas, vigencia 10/04/2026; GC-00/034/04 Auditorías externas, vigencia 08/06/2026. El usuario confirma revisión de sus anexos y programas/informes 2026. Los binarios no se han recibido ni verificado en esta fase: no se registran hashes inventados ni plantillas supuestamente instaladas. R3A implementa las reglas expresamente recogidas en la solicitud; documentos oficiales quedan para R3C.

## Fuentes funcionales de R3B

Se implementan los datos de hallazgos y CAPA Plan, atribuciones y seguimiento expresamente aprobados en la solicitud de R3B, tomando GC-00/033/03 (10/04/2026) y GC-00/034/04 (08/06/2026) como referencias declaradas. No se instalan ni verifican binarios oficiales, se generan anexos o se inventan plazos por criticidad, reglas de eficacia o cierre GMP. La incorporación documental queda para R3C.

## Fuentes de Auditorías verificadas para R3C

El 07/10/2026 se recuperaron y leyeron los binarios vigentes de SharePoint autorizados por el usuario: GC-00.033.03 Auditorías internas.docx, A3.03 INFORME AUDITORIA INTERNA.docx, A4.03 CAPA PLAN.xlsx, GC-00.034.04 Auditorías externas.docx y A3. INFORME AUDITORIA_V04.docx. Hashes, enlaces y vigencias en AUDITS_R3C.md. Esto completa la recepción pendiente en R3A/R3B.

No se usó BORRADOR_Anexo_IV_CAPA_Auditorias_COVEX.xlsx ni OBSOLETOS. Plan externo: estructura real Anexo IV incorporada en GC-00.034.04; no binario independiente vigente identificado. Reglas de cierre D-066; sin nuevos plazos automáticos, firma electrónica ni validación GMP declarada.
