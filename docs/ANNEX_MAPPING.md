# Matriz de anexos y datos de aplicación

Fecha de revisión: 2026-09-28.

Esta matriz documenta los anexos usados por COVEX Quality Manager y su relación con los registros estructurados de la aplicación. Los binarios DOCX/XLSX controlados no se almacenan en Git; se cargan mediante Administración y se verifican por SHA-256.

## Desviaciones · GC-00/023/06

| Documento | Tipo | SHA-256 auditado | Fuente de datos | Reglas especiales |
|---|---|---|---|---|
| Anexo III · Informe | DOCX | `8639c29198101a73253f0681620c89a3e2848b335d2a4be61b946f9b7a353d43` | Expediente de desviación, investigación, CAPA y firmas | Respeta la versión histórica del expediente. Disposición final: marca la casilla de la opción registrada y escribe la cantidad en su línea; el texto anterior no estándar se imprime como «Otro» (D-098). |
| Anexo V · Listado anual | XLSX | `1f92410bc94e2037fe632450ce766b3ce5d44c4f55b8868056bad73c882c03f2` | Listado anual | Columna B combina fecha de apertura + departamento. Filas ABIERTA/CERRADA se colorean según la leyenda del anexo. Capacidad de la plantilla: 63 registros. |

## CAPA · GC-00/030/05

| Documento | Tipo | SHA-256 auditado | Fuente de datos | Reglas especiales |
|---|---|---|---|---|
| Anexo III · Informe y seguimiento | DOCX | `73c3d57ca5ae6f4e9644a4f1cbe416992de6b367973ba98cd67f7f0bd1fea540` | CAPA inicial, acciones, seguimientos, eficacia y cierre | Las versiones V00/V01/... conservan el seguimiento histórico. |
| Anexo IV · Listado anual | XLSX | `47f3d757c2c00cbcbdba9e4f7daf2cb4d804ce522a5e1145ab5260efd8147ac3` | Listado anual | B combina código CAPA + origen/procedencia. D combina departamento responsable + fecha apertura. Filas ABIERTA/CERRADA usan la leyenda oficial. |

## Controles de Cambios · GC-00/003/03

| Documento | Tipo | SHA-256 auditado |
|---|---|---|
| Anexo III · Solicitud | DOCX | `a436d4aa732209e1aeb9620d5442a154a68899f875d1aa5d0dc437edd751a49f` |
| Anexo IV · Dictamen | DOCX | `742b1de11e0e0dece4e9c65c97613c112325189e183b9cb02c56ca82cd06cc60` |
| Anexo V · Seguimiento | DOCX | `3012e81b0172c77c59c9c97514d788e10eb332a73e4490b9c0a1c87afa6ad1e4` |
| Anexo VII · Listado anual | XLSX | `b65671cdd652f104f4038c65e07c025b5c7374dee4b683d74fbeef55f12bc8eb` |

## Reclamaciones · GC-00/027/03 · versión candidata

La revisión 03 se usa en la fase de prueba por decisión del proyecto, aunque todavía no sea la revisión formalmente vigente. La revisión 02 se conserva para histórico.

| Documento | Tipo | SHA-256 auditado | Fuente de datos | Reglas especiales |
|---|---|---|---|---|
| Anexo III · Informe de reclamación | DOCX | `764e12076b407e9675f6291f03c8bab477f7850fbdb62fed8a904b4693b2bcde` | Partes I y II del registro | Incluye origen, ámbito, objeto, categorías, impacto, contención, investigación, evaluación regulatoria, acciones derivadas, comunicación y cierre. |
| Anexo V · Listado anual | XLSX | `8d9a572fcfbc8bba05d99e3772aa0fec6fd3b716b6db2eaa5a056737d79d1d83` | Listado anual | Crece dinámicamente conservando la estructura oficial. |

La respuesta formal al cliente no se genera desde la aplicación para v03.

## Devoluciones · GC-00/028/03

| Documento | Tipo | SHA-256 auditado | Fuente de datos | Reglas especiales |
|---|---|---|---|---|
| Anexo III · Formulario de devolución | DOCX | `9716477f2b261a4fec8b1d459fb8aa62bd42840f8fa352b4b66b15c2669745f4` | Datos generales, productos, verificaciones, decisión y firmas | Plantilla independiente aportada. |
| Anexo IV · Hoja de devolución de producto | DOCX | Recortado del PNT GC-00/028/03 (`7f6b318e936cef9d2685347decf52b8951c34585dbd2ef1ebca05232a0c59a5a`), D-099 | Producto/lote individual | Se genera una hoja por producto/lote y conserva fechas separadas de recepción/verificación. |
| Anexo V · Declaración del cliente | DOCX | Recortado del PNT GC-00/028/03 (`7f6b318e936cef9d2685347decf52b8951c34585dbd2ef1ebca05232a0c59a5a`), D-099 | Cliente, productos/lotes, conservación y firmante | Plantilla separada del PNT y normalizada a una página, sin sección en blanco posterior. |
| Anexo VI · Listado anual | XLSX | `fa027508995beca7e39368f92e9d75ac2fdcf0dd7dffa57dfef8d59e6696db64` | Listado anual, una fila por producto/lote | Crece dinámicamente y mantiene las 13 columnas oficiales. |

## Instalación (D-099)

- Las huellas aceptadas de todas las plantillas controladas (Desviaciones, CAPA, Controles de cambios, Reclamaciones, Devoluciones, OOS y Auditorías) están en un único catálogo: `src/modules/configuration/template-catalog.ts`.
- `pnpm templates:install -- <carpetas, ZIP o archivos>` (por defecto, la carpeta `plantillas`) reconoce cada archivo por su SHA-256, no por su nombre. Recorta del PNT los anexos que proceden de él e informa de lo instalado (✓), lo que ya estaba (=) y lo que no reconoce o no puede instalar (✗).
- Una versión ya instalada no se sustituye por otro archivo. Solo se completa una versión registrada sin archivo o se sustituye una derivación anterior documentada del mismo PNT (OOS). Una revisión nueva se registra como versión nueva en Configuración → Versiones.
- Las plantillas se guardan en la base de datos; los generadores ya no buscan copias en la carpeta `templates/`.

## Principios de control

- La plantilla asociada a un expediente se conserva por versión; cambiar la plantilla activa no altera documentos históricos.
- La aplicación almacena el binario de plantilla en PostgreSQL, junto a nombre, tamaño y SHA-256.
- Los listados simples de la aplicación son independientes de los anexos oficiales.
- Los anexos anuales se generan para un año concreto a partir de los datos estructurados.
- Si cambia la revisión de un anexo, debe revisarse esta matriz, el mapeo del generador y los campos requeridos del expediente antes de activar la nueva plantilla.
- El texto de la plantilla no se altera: la etiqueta se conserva y el dato va a continuación o debajo. Solo se sustituyen huecos de relleno, ejemplos e indicaciones, y no se añaden opciones que la plantilla no tiene (D-098). `missingTemplateWords` (`src/lib/ooxml/template-text.ts`) comprueba que cada palabra de la plantilla sigue en su celda.
- Última verificación completa con las plantillas oficiales: [ANNEX_VERIFICATION_2026-10-18.md](ANNEX_VERIFICATION_2026-10-18.md).
