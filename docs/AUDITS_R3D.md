# R3D — Auditorías: regresión final y cierre

Estado: **VALIDACIÓN LOCAL COMPLETA; CI PENDIENTE**.

Baseline: `cc097c1312bbed5890ac2180635919479a328e8a`, R3A/R3B/R3C fusionados. Rama: `feature/audits-r3d-final-regression`. Un único PR contra main, sin merge ni squash.

## Defectos corregidos

1. **Adjuntos falsos aceptados como Office.** La comprobación de los dos bytes `PK` admitía texto con ese prefijo, un ZIP arbitrario o un XLSX renombrado DOCX. La validación comprueba ahora ZIP, tamaños y CRC, partes OPC de contenido/relaciones y parte principal correspondiente a la extensión. Verifica MIME declarado, admite MIME vacío/genérico del navegador y conserva el MIME correcto. Límite de archivo 15 MB y expansión acumulada 60 MB, incluso con tamaño declarado manipulado. Se aplica también la coherencia MIME al PDF firmado de Auditorías. No cambia el servicio PDF transversal.
2. **CAPA Plan con textos largos superpuestos.** Las filas cumplimentadas heredaban `ht="30.75" customHeight="1"` de la fila vacía oficial. En el render real los textos invadían cabecera y otras filas. La plantilla también activaba ajuste a página con altura implícita de una página, comprimiendo un plan largo hasta hacerlo ilegible. Se permite paginación vertical con una página de ancho y altura automática únicamente en filas cumplimentadas, conservando fuentes, anchos, estilos, colores, columnas, firmas, hojas y contenido. La comparación visual antes/después con LibreOffice elimina el solapamiento y la reducción de toda la tabla a una página; el plan extenso se distribuye verticalmente con tamaño legible, conservando pie/firmas y títulos de impresión originales.
3. **Mensaje de cierre obsoleto.** El formulario base seguía anunciando que el cierre llegaría en R3B/R3C. Ahora remite a «Informe y cierre» y mantiene el bloqueo de cierre desde el formulario base, evitando eludir las comprobaciones QA.

Ocho pruebas del defecto de adjuntos y dos del defecto de altura/paginación. El smoke R3A conserva la comprobación de bloqueo con el mensaje actualizado. No se añaden pruebas permanentes para comportamientos que ya funcionaban.

## Regresión integrada

Se ejecutó una comprobación temporal con servicios reales sobre PostgreSQL 16 aislado, sin incorporar fixtures corporativos ni nuevos tests permanentes. Para cada escenario: borrador incompleto y bloqueos documentales/cierre; apertura; dos auditores con jefe e interlocutor; modalidad mixta; realización; 14 hallazgos/recomendaciones y 28 acciones; seguimiento por hallazgo pendiente y posterior resolución; CAPA atribuida; emisión 00; descarga documental/PDF; edición, retirada, acción adicional y cambio de atribución; emisión 01; conservación exacta de snapshot/documento/PDF 00; rechazo de CAPA no conforme; cierre y filtros combinados.

| Escenario | Resultado comprobado |
| --- | --- |
| INTERNAL_COVEX | INTERNAL, AI y múltiples departamentos; A3.03 interno/A4.03; parcial por plan establecido sin closedAt; cierre con verificación local. |
| INTERNAL_CONTRACTED | Permanece INTERNAL y serie AI; informe interno identifica organización/auditor contratado; mismas reglas internas. |
| SUPPLIER | AE, entidad/dirección/contacto/tipo; A3 externo y Anexo IV real; parcial al envío; cierre normal. El smoke R3C comprueba respuesta, excepción sin respuesta y bloqueo por crítico/escenario/respuesta. |
| CLIENT | UUID y referencia externa, sin código artificial; primario recibido y acciones COVEX, CAPA Plan; cierre sin respuesta exigida en el caso integrado, con respuesta exigida en R3C. Sin informe externo COVEX artificial. |
| AUTHORITY | Primario externo/revisión, observaciones y acciones; respuesta exigida y evidencia de cierre; sin eficacia local universal ni informe COVEX artificial. |

Los smokes acumulados R3A/R3B/R3C cubren además concurrencia AI/AE y versiones, estabilidad/no reutilización de códigos y referencias retiradas, UUID ajenos, administración, paginación, historial, atribuciones compartidas/desvinculación, estado relacionado vivo, navegación inversa y orígenes/snapshots CAPA. Las únicas direcciones persistidas añadidas son AUDIT → DEVIATION/CAPA; la selección de Auditoría como origen de CAPA conserva esa dirección canónica aprobada, sin crear una relación CAPA → AUDIT.

**Concurrencia de cierre:** dos cierres simultáneos producen un único cierre y un rechazo «ya está cerrada». Se mantuvo abierta una transacción que bloqueaba/actualizaba CAPA a No conforme; se observó el cierre esperando el lock en PostgreSQL y, tras el commit, rechazando el cierre y conservando Audit OPEN. Sin deadlock en esta comprobación. Se mantienen locks y políticas R3C.

## Plantillas y QA documental

Las cinco fuentes reales autorizadas de SharePoint coinciden con los SHA-256 registrados en AUDITS_R3C.md/GMP_SOURCES.md. No se cambian hashes ni estructura oficial; no se utilizan BORRADOR ni OBSOLETOS. Installer oficial ejecutado de nuevo y copia deliberadamente alterada rechazada por SHA-256 antes de transacción. TemplateVersion oficial conserva bytes en PostgreSQL; generación sin fallback a rutas locales, histórico fijado por UUID/checksum.

Se generaron cinco CAPA Plans de 14 filas, tres informes (interno COVEX, interno contratado, proveedor) y el Plan externo desde el Anexo IV del PNT. Las partes XML/RELS se analizaron como XML; ZIP/OOXML correctos. El CAPA Plan amplía tabla y filtro a A10:K24, validaciones B/D/I hasta fila 24, mueve pie/firmas cuatro filas y conserva exactamente las hojas Leyenda/Listas. Textos extensos, dos acciones por hallazgo y referencias CAPA, estilos y campos manuales conservados. A3 mantiene secciones/tablas/firmas; Plan externo conserva estructura original y programa dinámico.

LibreOffice abre y exporta los DOCX/XLSX reales sin errores de reparación registrados. **Microsoft Office no está instalado:** no se afirma apertura comprobada en Word/Excel ni fidelidad visual perfecta. La revisión visual en Office por Calidad permanece antes del uso documental controlado; los límites de altura/paginación de cada visor requieren comprobar textos extremos. En A3 interno, la celda original estrecha de fecha de informe divide el año en dos líneas en LibreOffice; el valor OOXML está completo. Se conserva la distribución oficial y se documenta esta incidencia visual no bloqueante para contraste en Office. Esto no altera el cierre funcional de la aplicación ni constituye validación GMP.

PDF 00/01 independientes, ownership/checksum/descarga y no sobrescritura comprobados; no firma electrónica. Primarios/adjuntos PDF/DOCX/XLSX reales aceptados, paquete falso rechazado sin persistir documento. Histórico recibido conservado. Review mantiene PENDING/ACCEPTED activos y RESOLVED no activo, replies, versión histórica, UUID, retirados y deep links; no cambia R2C.

## Validación y límites

- Prisma/schema/índices/constraints: sin modificaciones y **sin migración nueva**. Cuatro migraciones existentes aplicadas a una segunda base vacía; actualización desde main en base con datos sin cambios de schema.
- Listados: búsqueda y filtros SQL, paginación/ColumnSelector, Review agregado; consultas de metadatos no cargan GeneratedDocument.fileData. No se detectó N+1 que requiera corrección.
- Navegador de producción Node 22, servidor UTC y Chromium Madrid: R2C UI, R3A UI ×3, R3B UI y R3C UI con fuentes oficiales; responsive 1440/768/390, formularios, tabs, retirados, Review, documentos, versiones y cierre sin errores JS/hidratación.
- Regresión PostgreSQL: los 35 smokes existentes del pipeline, incluidos Desviaciones, CAPA, CC, Reclamaciones, Devoluciones, Review y Auditorías.
- Quality final: Prisma validate/generate, lint, **321 tests en 65 archivos**, build. Permanecen los dos warnings de hooks preexistentes de CAPA/CC.
- Evidencia local: logs de regresión/quality/navegador en `/tmp/r3d-*.log`; exportaciones ficticias en `reports/audits/r3d/`, excluidas de Git. Los binarios oficiales permanecen excluidos de Git.

Pendientes de alcance posterior: Plan Maestro anual y alertas. Sin nueva funcionalidad, estados, reglas GMP/cierre/codificación, entidades, roles, dashboard, firma electrónica o integración. No se modifica el patrón estable de Server Action → resultado confirmado → navegación cliente; no se añaden retries, timeouts ni sleeps.

Primera ejecución CI verde: https://github.com/FMAcovex/covex-quality-manager/actions/runs/37692547298 (a054bca). La corrección adicional de paginación detectada en la inspección visual final requiere verificar de nuevo CI antes de declarar COMPLETADO.
