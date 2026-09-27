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


## 7. Controles de cambios · GC-00/003/03

Documentos controlados:
- Anexo III — Solicitud de cambios.
- Anexo IV — Dictamen de cambios.
- Anexo V — Informe de Seguimiento y Control de un Cambio.
- Anexo VII — Listado de controles de cambios.

### Plantillas DOCX
Las plantillas III, IV y V se instalan fuera de Git y se verifican por SHA-256 antes de uso.

SHA-256 auditados:
- Anexo III: a436d4aa732209e1aeb9620d5442a154a68899f875d1aa5d0dc437edd751a49f
- Anexo IV: 742b1de11e0e0dece4e9c65c97613c112325189e183b9cb02c56ca82cd06cc60
- Anexo V: 3012e81b0172c77c59c9c97514d788e10eb332a73e4490b9c0a1c87afa6ad1e4

La descarga Solicitud + Dictamen entrega un ZIP con los dos DOCX para conservar cada anexo como documento independiente.
El Anexo V se genera por seguimiento y, cuando existe snapshot funcional, se reconstruye desde el estado persistido de ese seguimiento.

### Anexo VII
Se genera como XLSX anual desde la base de datos respetando los campos del Anexo VII de GC-00/003/03:
- codificación;
- tipo/clasificación;
- descripción;
- fecha de solicitud;
- fecha de aprobación;
- fecha prevista de ejecución;
- fecha de ejecución;
- fecha de cierre.

El seguimiento operativo ampliado (departamento, estado de ejecución, eficacia, último/próximo seguimiento, estado final y observaciones) queda en el listado simple XLSX completo o respetando filtros activos, sin alterar el contenido del Anexo VII oficial.
