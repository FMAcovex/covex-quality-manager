# Emisión documental de programas anuales

## Alcance

Complemento de los planes anuales de PR #117, sobre main después de PR #122. No cambia el ciclo de vida, cierre, clasificación, edición o versiones de las auditorías individuales. Emite un Word editable del programa anual, nunca una revisión/reedición del Plan Maestro. No implementa aprobación electrónica, PDF firmado ni integración SharePoint.

## Fuentes vigentes contrastadas en SharePoint

Dirección de Calidad → 10 AUDITORIAS e INSPECCIONES:

- Internas: Plan Maestro V04/01-2023 y **Plantilla Anexo PMAI[V04[01-2023.doc** general. Referencia `Anexo/PMAI/V04/01-2023`. Se contrastó el DOCX de 2026: su bloque de aprobadores es diferente; no sustituye la plantilla general elegida.
- Externas: **PLAN MAESTRO A. EXTERNAS V05.docx**, `PMAE/V05/06-2026`, exclusivamente Anexo I, Programa Anual. V05 elimina el antiguo Anexo II. No se exporta el cuerpo del maestro, sus aprobadores ni su historial de revisiones.
- GC-00/033 vigente: versión 03. Cierre parcial interno = establecimiento del CAPA Plan (`capaPlanEstablishedAt`).
- GC-00/034 vigente: versión 04. Cierre parcial externo = envío del informe (`reportSentAt`); se muestra en observaciones, sin crear una columna nueva.

Las exigencias procedimentales de revisar el Plan Maestro se tramitan por el control documental correspondiente. La secuencia técnica de emisiones no acredita esa revisión.

## Datos y correspondencia

| Campo oficial | Fuente | Tratamiento |
|---|---|---|
| Año | `AuditAnnualPlan.year` | Automático |
| Departamento interno | `targetName`, o `department.name` | Usuario; no se inventa a partir del objeto |
| Compañía externa | `targetName` | Usuario |
| Producto/servicio/alcance | Nuevos `productService`, `plannedScope` | Usuario; líneas en la primera celda original |
| Ámbito externo | Nuevo `programmeArea` | Usuario; bandas originales; agrupación estable |
| Fecha prevista | `plannedDate` o nuevo `plannedPeriodText` | Usuario; alternativas mutuamente excluyentes |
| Equipo auditor | Nuevo `plannedAuditorsText` | Usuario; no sustituir por participantes reales del expediente |
| Fecha efectiva | Auditoría vinculada: `performedDate` | Automático, solo expediente activo y fuera de borrador |
| Cierre parcial interno | `capaPlanEstablishedAt` | Automático; nunca `closedAt` |
| Observaciones | Entrada: `notes` | Usuario; no volcar observaciones internas del expediente |
| Observaciones externas | `notes`, nueva `plannedModality`, `reportSentAt` | Incluye etiquetas de modalidad prevista y cierre parcial |
| Aprobado por | Nuevos `technicalApproverName`, `qualityApproverName` | Nombres manuales; cargos originales conservados |
| Firma/fecha | Celdas originales | Vacías, para cumplimentación manual en Word |
| Referencias, logos y pies | Plantilla instalada | Conservados; ninguna nueva versión maestra ficticia |

Los nuevos campos son opcionales para gestionar planes existentes. La emisión requiere una entrada activa, entidad/departamento, fecha/período, auditores previstos y nombres de aprobadores. Son comprobaciones de suficiencia documental de la aplicación; no nuevos requisitos GMP. Producto, alcance y ámbito externos incompletos generan avisos revisables. Las entradas sin expediente se incluyen como planificación. Las retiradas se excluyen; los expedientes fuera de plan no se incorporan automáticamente. Borradores/inactivos vinculados mantienen la planificación y no aportan fechas de ejecución.

## Emisión e histórico

- Previsualización actual antes de emitir. Si cambian planificación, ejecución, nombres o plantilla desde la previsualización, se rechaza la solicitud y se pide recargar.
- Emisión inicial `00`; siguientes `01`, `02`…, con motivo obligatorio. Secuencia en interfaz/nombre de descarga, sin añadir un campo al formulario oficial ni alterar V04/V05.
- Tabla independiente `AuditAnnualProgrammeVersion`: snapshot JSON, plantilla y checksum, actor, motivo, fecha, bytes DOCX y checksum. No crea `QmsRecordVersion` para el plan.
- Transacción PostgreSQL con snapshot consistente, bloqueo por plan y reintentos de conflictos de serialización. Restricciones únicas y clave de solicitud para doble envío/idempotencia.
- Versiones emitidas append-only, también mediante trigger PostgreSQL. Los cambios operativos no reescriben archivos anteriores.
- Descarga GET solo recupera una emisión del mismo plan y verifica integridad; no genera nuevas versiones. La descarga no equivale a aprobación.
- El histórico operativo de cambios del plan conserva modificaciones de aprobadores y emisiones.

## Instalación

Fuentes originales fuera de Git. Ejecutar tras desplegar la migración:

```sh
pnpm db:deploy
pnpm templates:audits:annual:install /ruta/a/originales-vigentes
```

La carpeta debe contener exactamente los nombres de las dos fuentes indicadas arriba. El instalador fija SHA-256 del original interno (`fa1296da0c6bbb9561e2ab992e717b7b2e31f73cc70ce274bac0a79a3b457e36`) y externo (`e55c7b2623604c45aa7282c6601479189a56395cbfa05fc421742a7e9db98cda`). Rechaza cualquier otro binario antes de escribir en BD.

La fuente interna `.doc` se convierte en una copia temporal mediante LibreOffice (`soffice`, o `LIBREOFFICE_BIN`). Se registra el checksum del DOCX convertido; nunca se sustituye una plantilla instalada ni se modifica el original. La conversión puede variar entre versiones de LibreOffice: revisar el Word instalado antes del uso operativo. Las fechas del catálogo expresan el mes de referencia de la fuente (primer día), no fechas de firma inferidas. Un cambio futuro de fuente exige adaptar y verificar instalador/generador y registrar otra versión.

## Generación y verificación

Se modifica OOXML dentro del paquete original. Se clonan filas/celdas y estilos, conservando anchuras, combinaciones, recursos y bloques de aprobación. Las alturas de filas cumplimentadas son mínimas y pueden crecer. La cabecera de la tabla se repite en páginas adicionales. El Anexo I externo hereda los recursos de su sección y reinicia la numeración de páginas en 1; el total corresponde al programa emitido.

Pruebas automatizadas: generadores con 20 filas, entidades XML, recursos/estilos, estructura incorrecta, fecha/período, separación entre cierre parcial/final; PostgreSQL con emisión, snapshot, integridad, bloqueos de edición/borrado, idempotencia, emisiones concurrentes, vista obsoleta, motivo, exclusión fuera de plan y fechas de borradores/inactivos; navegador con entrada de datos, error en formulario, histórico/download y tamaños 1440/768/390. CI usa plantillas ficticias compatibles; QA complementaria usa las fuentes oficiales.

Aceptación manual pendiente: apertura y edición en Microsoft Word del documento instalado/emitido, paginación, repetición de cabecera, nombres/cargos, espacio para firmas y equivalencia visual frente a las fuentes. Las comprobaciones con LibreOffice no sustituyen esa aceptación. No se ha fusionado ni desplegado la PR.
