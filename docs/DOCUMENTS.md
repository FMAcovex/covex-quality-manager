# Documentos y exportaciones

## Principio

Los anexos controlados no se rediseñan. La aplicación introduce datos en una plantilla versionada y descarga el resultado.

## 1. Anexo III — Informe de Desviación

Baseline inicial: Anexo III del PNT GC-00/023/06.

La plantilla contiene bloques:
- identificación;
- origen;
- documentación de referencia afectada;
- descripción;
- acciones correctoras inmediatas;
- investigación;
- metodología;
- análisis de causa raíz;
- clasificación;
- impacto;
- decisión de abrir CAPA;
- planificación CAPA;
- conclusión/cierre;
- disposición final;
- aprobaciones/firmas.

La UI puede reorganizar el orden de cumplimentación para usabilidad, pero el documento generado debe conservar el formato controlado.

### Generación
- DOCX.
- Plantilla versionada.
- Sin firma electrónica en V1.
- Mantener espacios de firma del documento.
- Registrar fecha, usuario manual y versión usada.

## 2. Anexo V — Listado de Desviaciones

Baseline inicial: Anexo V GC-00/023/06.

La plantilla disponible incluye:
1. listado detallado;
2. vista simplificada/imprimible.

La descarga por año debe completar ambas desde los mismos registros.

### Campos de la hoja detallada identificados
- Código departamento.
- Codificación.
- Material/proceso afectado.
- Procedencia/origen.
- Descripción.
- Clasificación.
- Causa raíz.
- Fecha apertura.
- Fecha cierre.
- Medidas adoptadas.
- Código CAPA.
- Observaciones.

### Vista simplificada
Incluye, según plantilla:
- Nº de desviación.
- Fecha de apertura y departamento.
- Material/proceso afectado.
- Descripción.
- Código CAPA.
- Fecha de cierre.
- leyenda/estado y zonas de firma según plantilla.

No eliminar ni rediseñar elementos fijos sin una nueva plantilla aprobada.

## 3. Listado simple

Exportación operativa independiente del Anexo V.

Requisitos:
- XLSX o formato equivalente definido en implementación;
- columnas del listado operativo hasta Observaciones;
- opción de respetar filtros activos;
- opción de listado completo anual;
- sin columnas KPI internas salvo solicitud expresa.

## 4. Versionado

Estructura prevista:
`templates/deviations/anexo-iii/v06/...`
`templates/deviations/anexo-v/v06/...`

Una versión nueva se añade, no sustituye silenciosamente a la anterior.

Cada GeneratedDocument registra TemplateVersion.

## 5. Almacenamiento

MVP:
- generar en servidor;
- ofrecer descarga;
- eliminar temporales;
- no subir automáticamente a SharePoint.

Futuro opcional:
- guardar en SharePoint;
- abrir carpeta;
- sincronizar documento firmado.

La integración futura no debe ser requisito para el núcleo de generación.


## 6. Documentos por versión funcional

Los anexos individuales pueden generarse desde la versión vigente o desde un snapshot histórico de `QmsRecordVersion`.

Reglas:
- el documento histórico se reconstruye desde los datos de esa versión, no desde los valores actuales del expediente;
- el nombre de descarga identifica V00, V01, V02…;
- `GeneratedDocument` conserva la referencia a `recordVersionId`;
- la versión de plantilla documental sigue siendo independiente de la versión funcional del expediente;
- una nueva revisión del PNT/anexo no modifica el snapshot ni el documento histórico.

Para datos anteriores al Hito 6.1 solo son descargables como versión histórica exacta aquellos estados para los que exista snapshot persistido; no se reconstruyen estados inexistentes.

### PDF firmado de una versión funcional

Cuando el usuario dispone de un PDF firmado manualmente, el binario se almacena en `RecordVersionDocument` y queda asociado a la `QmsRecordVersion` exacta.

- Desviaciones mantiene la gestión por V00/V01/V02… ya existente.
- CAPA gestiona el PDF desde Seguimiento 00/01/02…; la pestaña Documentos solo resume disponibilidad.
- Cada seguimiento/versión es independiente: crear una nueva versión no hereda ni copia el PDF anterior.
- Sustituir un PDF exige motivo y registra el documento anterior y el nuevo en el historial operativo.
- No se implementa firma electrónica en V1.



## 7. Controles de Cambios · GC-00/003/03

### Anexo III — Solicitud
DOCX generado desde plantilla controlada. Conserva:
- codificación y fecha;
- alcance;
- departamento;
- solicitante;
- descripción y justificación;
- documentos aportados;
- aceptación/denegación.

### Anexo IV — Dictamen
DOCX generado desde plantilla controlada. El plan de ejecución se expande dinámicamente por departamento y acción sin fijar columnas organizativas.

Las acciones de seguimiento no reescriben el plan aprobado del Dictamen.

### Anexo V — Seguimiento
DOCX por versión 00/01/02...
- historial de seguimientos;
- acciones y responsables;
- fecha prevista/real;
- evidencia;
- ejecución;
- eficacia;
- próxima revisión o cierre.

Las tareas cuyo origen sea FOLLOWUP se renderizan en azul y quedan identificadas estructuralmente mediante `introducedInFollowup`.

### Anexo VII — Listado anual
Se genera un XLSX anual con las columnas oficiales:
- codificación;
- tipo/clasificación;
- descripción;
- fecha solicitud;
- fecha aprobación;
- fecha prevista ejecución;
- fecha ejecución;
- fecha cierre.

El libro fuente utilizado para validar el formato contiene hojas históricas y dashboard. El generador extrae únicamente la hoja oficial imprimible y los recursos visuales necesarios; no distribuye las demás hojas.

### Listado simple
Exportación independiente con las columnas operativas ampliadas de seguimiento, incluyendo ejecución, eficacia, último/próximo seguimiento y estado final.


## 8. Reclamaciones · GC-00/027/02 (histórico; objetivo actual v03)

Fuente controlada: PNT completo GC-00/027/02.

La aplicación extrae del propio PNT:
- Anexo III · Informe de la Reclamación;
- Anexo IV · Informe de Respuesta a Reclamación;
- Anexo V · Listado de Reclamaciones.

El Anexo III conserva Parte I y Parte II, incluyendo CAPA y eficacia. El Anexo V se amplía dinámicamente sin limitarse a las filas vacías originales.

SHA-256 auditado del PNT fuente:
`f717ae907da9ed8b575f740fbf8b1536d4157174de5b7b4d240220910b570df4`.

## 9. Devoluciones · GC-00/028/03

Fuente controlada: PNT completo GC-00/028/03.

La aplicación extrae:
- Anexo III · Formulario de Devolución;
- Anexo IV · Hoja de Devolución de Producto;
- Anexo V · Declaración del Cliente sobre Conservación;
- Anexo VI · Listado de Devoluciones.

Si una devolución contiene varios productos, el Anexo IV se genera por producto. El Anexo VI anual genera una línea por producto devuelto.

SHA-256 auditado del PNT fuente:
`191c0e838f06d465bd820450b9130e1209c14fc9cb97559e8ec567819ba07f9a`.

Los binarios controlados no se versionan en Git. Se instalan localmente y el hash se verifica antes de cualquier generación.

## Auditorías R3C — anexos controlados

Fuentes reales y hashes en AUDITS_R3C.md/GMP_SOURCES.md. A3.03 interno, A3 externo V04, A4.03 CAPA PLAN.xlsx y Anexo IV extraído del PNT externo GC-00.034.04. Sin borrador/obsoletos ni plantilla independiente inventada. Paquete OOXML/estilos/textos fijos/hojas/firmas preservados; tablas se amplían con los datos estructurados.

Versiones formales generan solo desde su snapshot/plantilla fijada y conservan bytes/checksum; plan actual se archiva separado. Documento primario CLIENT/AUTHORITY es recibido. PDF firmado externo por QmsRecordVersion exacta, sin sobreescritura ni firma electrónica. Instalación de binarios oficiales excluidos de Git mediante templates:audits:install; QA manual de formato en Office antes del uso documental controlado.


## Reclamaciones R4A — documentos GC-00/027/03

Fuentes separadas reales III/IV/V, estructura y SHA-256 en [COMPLAINTS_R4A.md](COMPLAINTS_R4A.md). III y IV se generan desde el snapshot de la versión solicitada; IV aplica opcionalmente a respuesta formal al cliente, sin requisito universal. V mantiene listado anual oficial. Binarios corporativos fuera de Git; instalador verifica hashes y conserva pins/vigencias históricas.


## Devoluciones R4B

R4B: se han revisado los cinco binarios reales GC-00/028/03 (26/05/2026), A3 FORMULARIO DEV 03, A4 PETICION DEV 03, A5 DECLARACION CLIENTE 03 y A6 LISTADO DEV 03. Hashes, instalador de carpeta autorizado y conservación de activos previos en RETURNS_R4B.md. III/IV/V se archivan con snapshot por generación; PDF independientes III/V mantienen sustitución con motivo y bytes anteriores. VI sigue formato anual XLSX con filas por producto.

## OOS · GC-10/014/04 (OOS-3, D-088)

Los Anexos III (Fase I), IV (Fase II) y VI (Listado general de OOS) se derivan del propio PNT GC-10/014/04, con el encabezado de los anexos corregido a 04. Se instalan con `pnpm templates:oos:install -- <PNT.docx>`, que verifica el SHA-256, y se cumplimentan sin rediseño. Los rangos, la correspondencia de celdas, los hashes y las reglas de versión están en [OOS_DESIGN.md](OOS_DESIGN.md) §8.

- Los Anexos III y IV son documentos de trabajo: cada descarga deja un recibo con plantilla, versión y SHA-256, y no crea un original oficial.
- El Anexo VI es el listado anual imprimible para la firma manuscrita de §5.2 y no se archiva.
