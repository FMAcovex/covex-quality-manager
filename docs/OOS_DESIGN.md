# Módulo OOS — Resultados fuera de especificación (diseño, PR documental)

**Estado:** diseño propuesto para aprobación (D-088). Sin código, schema, migraciones, plantillas ni datos. La implementación se hará en PR posteriores, cada una con su aprobación de alcance.

## 1. Fuente

PNT **GC-10/014/04 «Resultados fuera de especificación»**, Control de Calidad, vigencia 15/06/2025, sustituye a GC-10/014/03. Leído el 16/10/2026 en SharePoint Dirección de Calidad, carpeta `GC-10 DPTO. CONTROL DE CALIDAD/GC-10 Control de Calidad/GC-10-014 Analíticas Fuera de Especificación`:

| Fichero | Uso en el diseño |
| --- | --- |
| `GC-10-014-04 (15-06-2025) EN REDACCION.docx` | PNT vigente. El responsable del proyecto confirma que es la revisión en vigor aunque el nombre diga «en redacción». Fuente de las plantillas de los anexos III y IV. |
| `Anexo III.docx`, `Anexo IV.docx` (separados) | **No se usan.** El III no incluye el bloque de microbiología de la 04 y el IV contiene un informe ya cumplimentado, no la plantilla en blanco. |
| `GC-10-014-03 (01-12-2023).docx`, `OBSOLETOS/` | No se usan. |
| `GC-10 DPTO. CONTROL DE CALIDAD/FUERA DE ESPECIFICACIONES/LISTADO GENERAL OOS.xlsx` | Registro de los OOS anteriores; no se importa (sección 9). |

**Erratas detectadas en el PNT 04:** los anexos III a VI insertos en el PNT llevan en el encabezado «PNT GC-10/014/**03**», y la historia del documento fecha la revisión 03 el 01-02-2023 cuando su vigencia es 01-12-2023. El responsable del proyecto confirma que el encabezado correcto de los anexos es **04**. La corrección se hace en el documento controlado por Calidad; la aplicación no reescribe el texto de una plantilla controlada (sección 8).

## 2. Alcance

Materias primas, productos en proceso, productos finales (API y medicamento) y material de acondicionamiento con un resultado que no cumple su especificación (§1 y §3 del PNT). No entran las **incidencias** de los controles, que siguen GC-00/023 (§3), ni OOT o resultados atípicos, que el PNT no regula.

## 3. Codificación

`OOS/XX/YYY/ZZZZ` (§5.1):

- `XX`: `API` (principios activos) o `MD` (medicamento y complemento alimenticio).
- `YYY`: correlativo de tres cifras desde 001.
- `ZZZZ`: año.

El responsable del proyecto confirma que **API y MD tienen numeración independiente**: la secuencia es por área y año. La aplicación asigna el código al abrir el expediente, con el mismo bloqueo transaccional que el resto de módulos. Los códigos históricos se conservan tal cual, incluido el formato `OOS/GC-10/YYY/2023` anterior a la separación por área.

## 4. Contenido del expediente

Separado por fases, sin mezclar descripción, investigación, conclusión y dictamen (AGENTS.md).

### 4.1 Datos iniciales (Anexo III, página 1)

- Área: API o MD (determina el código).
- Material afectado, uno de los dos bloques del anexo:
  - producto final (API o medicamento): nombre, nº de lote, tamaño de lote y cantidad afectada;
  - materia prima o material de acondicionamiento: nombre, nº de lote, tamaño de lote, cantidad afectada, proveedor y lote del proveedor.
- Proceso.
- Fecha y hora del OOS; detectado por (analista) y turno.
- Detección: descripción del OOS (qué, quién, cómo, dónde, cuándo y por qué).

### 4.2 Fase I — Investigación en el laboratorio (Anexo III, páginas 2 y 3)

- **Evaluación**: los 21 parámetros del anexo con su resultado, en cinco bloques: analista (5), muestra (4), equipos (4), patrones/reactivos/disolventes/disoluciones (5) y microbiología (3). El bloque de microbiología solo aplica a análisis microbiológicos. El anexo deja en blanco la columna «Resultado»: se registra como texto libre por parámetro, sin valores inventados (sección 10).
- **Investigación** (causa raíz).
- **Conclusiones**: si la investigación es concluyente y se confirma error de laboratorio.
- **Disposición final**: «Investigación concluyente (error de laboratorio)» o «Investigación a gran escala».
- **Dictamen**: aprobado, rechazado u otros (indicar), con cantidad, cantidad a destruir y cantidad a devolver.
- **Emitido por** Control de Calidad y **aprobado por** Garantía de Calidad: nombre y fecha registrados; la firma es manuscrita en el documento impreso.
- Copias: protocolo de lote y originales en CC.

### 4.3 Fase II — Investigación a gran escala (Anexo IV)

Solo si la disposición de la Fase I es «Investigación a gran escala».

- **Revisión de la producción**: los cinco puntos del PNT (motivo de la investigación, aspectos del proceso, revisión de la documentación con causa real o probable, recurrencia y acciones correctivas).
- **Repetición de pruebas** y **remuestreo**: planes y resultados. En microbiología se puede pasar directamente a remuestreo (§5, PNT 04).
- **Conclusión de la investigación**.
- **Dictamen**: como en la Fase I.
- **Emitido por** Garantía de Calidad y **departamentos afectados** (uno o varios, con nombre y fecha).

### 4.4 Resultado de la investigación

El PNT (§5, «Conclusiones de la investigación») distingue tres resultados, que se registran como campo propio:

- **Invalidado**: error de laboratorio confirmado en la Fase I; el resultado no se usa para evaluar el lote.
- **Confirmado**: la investigación confirma el OOS; el lote no cumple y la investigación se extiende a otros lotes o productos asociados.
- **No concluyente**: no se encuentra la causa ni se confirma; el OOS se considera en la disposición del lote y Garantía de Calidad puede decidir liberarlo.

Corresponde a la columna «Confirmación OOS» del listado operativo actual.

## 5. Ciclo de vida

Mismos estados que Desviaciones, Reclamaciones y Devoluciones, para reutilizar listados, panel, indicadores y el ciclo descriptivo del contrato (PR 5). La fase es un campo aparte.

| Estado | Fase | Significado |
| --- | --- | --- |
| Borrador | — | Alta sin código asignado |
| Abierto | Fase I | Investigación de laboratorio en curso |
| Abierto | Fase II | Investigación a gran escala en curso |
| Cerrado | I o II | Investigación concluida con resultado y dictamen |

Transiciones según el árbol de decisiones (Anexo V):

- Borrador → Abierto (Fase I): asigna el código.
- Fase I → Cerrado: disposición «concluyente (error de laboratorio)», resultado Invalidado.
- Fase I → Fase II: disposición «Investigación a gran escala».
- Fase II → Cerrado: resultado Confirmado o No concluyente.

Para cerrar se exigen los campos que el anexo de la fase de cierre pide cumplimentar: conclusión, resultado, dictamen y emisor con fecha. No se añaden plazos ni requisitos que el PNT no establece. Reapertura, anulación y editabilidad siguen las reglas transversales vigentes (D-085), sin reglas propias.

## 6. Relaciones

Dirección canónica desde OOS (D-018, D-046), declarada en el contrato del módulo (MODULE_CONTRACT §5.3):

| Origen | Tipo | Destino | Motivo |
| --- | --- | --- | --- |
| OOS | GENERATES | CAPA | Acciones correctivas y preventivas de la investigación (columna «Investigación / CAPA» del Anexo VI) |
| OOS | GENERATES | Desviación | Caso poco habitual, confirmado por el responsable del proyecto; el listado histórico ya recoge aperturas de desviación desde un OOS |

Sin relación con Control de cambios, que no participa en relaciones operativas en V1 (D-018, D-047). OOS se añade a `QmsRecordType`.

## 7. Permisos

El módulo admite consultar, crear, editar, revisar, cerrar, anular, descargar, exportar, generar documentos (OOS-3) y adjuntar documentos (OOS-4), que se asignan en el editor de roles (D-086). El PNT asigna:

- la numeración, la Fase I y su emisión a **Control de Calidad**;
- la aprobación de la Fase I, la Fase II, la interpretación de resultados y la decisión sobre el lote a **Garantía de Calidad**.

Los roles concretos se configuran en el editor de roles. La aplicación no implementa firma electrónica ni aprobación GMP (D-073, D-074): registra quién emite y aprueba; el documento firmado a mano se adjunta como PDF (sección 8, OOS-4).

## 8. Documentos

Implementado en OOS-3 (17/10/2026).

| Documento | Fuente | Salida | Cuándo |
| --- | --- | --- | --- |
| Anexo III — Fase I | Rango del PNT 04 desde el título del formulario «Anexo III del PNT» hasta «Anexo IV» | Word cumplimentado | OOS abierto o cerrado |
| Anexo IV — Fase II | Desde «Anexo IV del PNT» hasta «ANEXO V» | Word cumplimentado | Solo con disposición «Investigación a gran escala» |
| Anexo VI — Listado general de OOS | Desde la tabla «LISTADO GENERAL DE OOS AÑO» hasta el final | Word del año, para imprimir y firmar a mano (§5.2) | Desde el listado: año en curso y años con OOS |

**Fuente controlada.** PNT `GC-10-014-04 (15-06-2025) EN REDACCION.docx`, con el encabezado de los anexos ya corregido a 04 por Calidad. Su SHA-256 es `1dc7d0a7f0937f90b75f6ba94f3cdbaf0cfdd3b6558503c2f1658d1fd837ad40`.

**Instalación.**
- `pnpm templates:oos:install -- <PNT.docx>` comprueba el SHA-256 y deriva los tres anexos.
- Los registra como plantillas versión 04, vigentes desde el 15/06/2025, con su cambio de configuración.
- Como los anexos en uso de la carpeta «FUERA DE ESPECIFICACIONES», cada anexo derivado empieza en el propio formulario y no lleva encabezado ni pie del PNT ni los títulos del apartado 8. La única numeración es la fila «Página n de X» del formulario.
- Una versión ya registrada con otro binario no se sustituye. Excepción: la derivación de OOS-3 del mismo PNT, que conservaba encabezado, pie y títulos, se sustituye al reinstalar con el cambio de configuración `TEMPLATE_REDERIVED` (hash anterior y motivo).
- SHA-256 de los anexos derivados, estable entre ejecuciones:
  - Anexo III: `eec11dfd04f19b687a5bee286a8ed1f43578934d5d4eb4e71430a7f292d4e737`;
  - Anexo IV: `f1f900179510436fec8230e9fb1c510afee50fe3bce86cc8ad273542d7df9bc8`;
  - Anexo VI: `99f4704f8eed938583d668e621aa23e592ee9bdc7ffe506810d037f8a579f3a1`.
- SHA-256 de la derivación de OOS-3 sustituida: III `66d885876c2ef9b6de56aed21f8b4b6a81b06a6b3142674e17c3dbeaa1ee6903`, IV `bb30562e5893887f5f932d8696e526971dd31fc46e25874295e55dbd591fd391`, VI `40c851beff49620f41fcda800028d0b33869d83c8af100c874a09b5054d85007`.
- El binario corporativo no se versiona en Git.

**Cumplimentación sin rediseño.**
- Se rellenan las celdas existentes y se conservan etiquetas, propiedades de celda y tipografía del párrafo.
- Las indicaciones en gris («fecha», «hora», «analista», «turno», «(fecha)») se sustituyen por el dato cuando existe.
- En «Página n de X» se escribe el número de páginas del formulario (3 en el Anexo III, 2 en el IV), como en los anexos en uso.
- Los textos libres van debajo de la indicación del anexo, por ejemplo «(Establecer causa raíz)».
- La firma sigue siendo manuscrita: en «Emitido por» y «Aprobado por» se escribe el nombre y la fecha registrados, sin firma electrónica (D-073, D-074).
- No se cumplimentan «Copias / Protocolo de lote» ni «Originales / CC» porque el expediente no registra esos datos.
- Dictamen:
  - APROBADO: «X» y cantidad;
  - RECHAZADO: «X», destruir, devolver y cantidad;
  - OTROS: «X» e «Indicar» con el texto y la cantidad.

**Anexo VI.**
- Una fila por OOS codificado del año, sin borradores ni anulados, ordenadas por número.
- Columnas:
  - Nº OOS;
  - fecha de apertura: la fecha de emisión del informe;
  - material afectado y lote;
  - descripción de la detección;
  - investigación / CAPA: resultado de la investigación, o «En curso · Fase I/II», y expedientes CAPA o Desviación derivados;
  - fecha de cierre.
- Las 13 filas de la plantilla se rellenan en su sitio. Si hay más OOS, se repite la última fila.
- El estado de seguimiento que exige §5.2 se marca con el fondo de la fila: amarillo `FFFF00` pendiente, verde `92D050` cerrado. El PNT no fija el tono exacto.

**Versión de plantilla.** Cada OOS usa la plantilla vigente en su fecha de emisión, y el Anexo VI la vigente al cierre del año. Así una nueva revisión del PNT no cambia los anexos de expedientes anteriores (AGENTS.md), sin añadir campos al expediente.

**Documento de trabajo y audit trail.**
- Cada descarga de los Anexos III y IV queda registrada como documento de trabajo, con plantilla, versión y SHA-256 del fichero.
- Con la política B2 se captura como operación OO06 (`PHASE_4B3_A.md` §3.9).
- El Anexo VI es una exportación con permiso «Exportar» y no se archiva, como el Anexo VI de Devoluciones.

**PDF firmado (OOS-4).** En la pestaña «Documentos» de la ficha se adjunta el PDF escaneado del Anexo III y, con Fase II, del Anexo IV, firmados a mano.
- Se conserva como original recibido con la custodia transversal: SHA-256 verificado al descargar, original inmutable y cadena de sustituciones.
- Sustituirlo exige motivo.
- OOS no tiene versiones funcionales. El PDF se asocia a un snapshot técnico del expediente (versión 0), que se crea o actualiza al recibir el PDF; cada original guarda además el snapshot observado.
- Requiere el permiso «Adjuntar documentos».
- Con la política B2 se captura como OO06.
- No es firma electrónica (D-073, D-074).

## 9. Importación del histórico

**No se importan OOS antiguos** (decisión del responsable del proyecto, 17/10/2026). El listado `LISTADO GENERAL OOS.xlsx` (38 OOS de 2023 a 2026) sigue siendo el registro de los OOS anteriores a la aplicación. Los códigos de la aplicación empiezan en las series API y MD de cada año, que deben arrancar después del último correlativo usado en el listado para no duplicar códigos: si se empieza a usar a mitad de año, el primer OOS se registra con el código siguiente indicado a mano.

## 10. Decisiones cerradas el 17/10/2026

1. **Anexo VI**: listado anual imprimible solo con las columnas del PNT (n.º OOS, fecha de apertura, material afectado, descripción, investigación / CAPA y fecha de cierre por Garantía de Calidad), para la firma manuscrita que exige §5.2. Sin columnas añadidas.
2. **«Resultado» de la evaluación de la Fase I**: texto libre por parámetro, porque el anexo no define valores.
3. **Resultado de la Fase I**: el OOS queda cerrado (error de laboratorio) o sigue abierto; la disposición «Investigación a gran escala» indica que es necesaria la Fase II y habilita la parte del registro que corresponde al Anexo IV.
4. **Importación**: no se importan OOS antiguos.
5. **Corrección del PNT 04**: Calidad corrige la errata de los encabezados antes de instalar las plantillas (OOS-3).

## 11. Plan de implementación

| PR | Alcance |
| --- | --- |
| **OOS-0 (esta)** | Diseño, decisión D-088 y fuente en GMP_SOURCES |
| OOS-1 | Modelo y migración aditiva, contrato y registro, listado, ficha, alta y edición con datos iniciales, Fase I, Fase II, resultado y cierre, codificación, permisos, búsqueda, panel, cronología, audit trail (pestaña), anulación y pruebas |
| OOS-2 | Relaciones con CAPA y Desviación y revisión (Review) |
| OOS-2b | Captura del audit trail B2 en las operaciones de OOS (OO01–OO05): matriz de `PHASE_4B3_A.md` §3.9, política de captura de `OosRecord`, funciones SQL y contrato de copia de seguridad |
| OOS-3 | Anexos III y IV y Anexo VI imprimible con las plantillas del PNT 04 corregido (sección 8), con la operación OO06 de generación documental en el audit trail |
| OOS-4 | PDF firmado a mano de los Anexos III y IV, custodiado como original recibido (sección 8), y PNT de OOS en la demo local |

Cada PR con lint, tests, Prisma validate, build y la batería CI completa. El módulo no queda validado GMP por estar implementado (D-076).
