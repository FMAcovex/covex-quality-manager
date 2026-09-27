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
