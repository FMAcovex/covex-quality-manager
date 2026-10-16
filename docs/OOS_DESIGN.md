# Módulo OOS — Resultados fuera de especificación (diseño, PR documental)

**Estado:** diseño propuesto para aprobación (D-088). Sin código, schema, migraciones, plantillas ni datos. La implementación se hará en PR posteriores, cada una con su aprobación de alcance.

## 1. Fuente

PNT **GC-10/014/04 «Resultados fuera de especificación»**, Control de Calidad, vigencia 15/06/2025, sustituye a GC-10/014/03. Leído el 16/10/2026 en SharePoint Dirección de Calidad, carpeta `GC-10 DPTO. CONTROL DE CALIDAD/GC-10 Control de Calidad/GC-10-014 Analíticas Fuera de Especificación`:

| Fichero | Uso en el diseño |
| --- | --- |
| `GC-10-014-04 (15-06-2025) EN REDACCION.docx` | PNT vigente. El responsable del proyecto confirma que es la revisión en vigor aunque el nombre diga «en redacción». Fuente de las plantillas de los anexos III y IV. |
| `Anexo III.docx`, `Anexo IV.docx` (separados) | **No se usan.** El III no incluye el bloque de microbiología de la 04 y el IV contiene un informe ya cumplimentado, no la plantilla en blanco. |
| `GC-10-014-03 (01-12-2023).docx`, `OBSOLETOS/` | No se usan. |
| `GC-10 DPTO. CONTROL DE CALIDAD/FUERA DE ESPECIFICACIONES/LISTADO GENERAL OOS.xlsx` | Listado histórico para la importación (sección 9). |

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

- **Evaluación**: los 21 parámetros del anexo con su resultado, en cinco bloques: analista (5), muestra (4), equipos (4), patrones/reactivos/disolventes/disoluciones (5) y microbiología (3). El bloque de microbiología solo aplica a análisis microbiológicos. El anexo no define los valores de «Resultado»: propuesta pendiente de confirmar en la sección 10.
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

Mismos permisos de contrato que el resto de módulos (lectura, alta, edición, cierre, anulación, documentos, exportación e importación), asignables en el editor de roles (D-086). El PNT asigna:

- la numeración, la Fase I y su emisión a **Control de Calidad**;
- la aprobación de la Fase I, la Fase II, la interpretación de resultados y la decisión sobre el lote a **Garantía de Calidad**.

Los roles concretos se configuran en el editor de roles. La aplicación no implementa firma electrónica ni aprobación GMP (D-073, D-074): registra quién emite y aprueba, y el documento firmado a mano se adjunta como PDF con el mecanismo existente.

## 8. Documentos

| Documento | Fuente | Salida |
| --- | --- | --- |
| Anexo III — Fase I | Rango del PNT 04 entre «Anexo III» y «Anexo IV» | Word cumplimentado |
| Anexo IV — Fase II | Rango del PNT 04 entre «Anexo IV» y «Anexo V» | Word cumplimentado |
| Anexo VI — Listado general de OOS | Tabla del PNT 04 | Pendiente de decisión (sección 10) |

- Se extraen del PNT con el mecanismo `word-range` ya usado en Devoluciones (`scripts/install-template-bundle.ts`), que comprueba el SHA-256 del binario antes de instalar. Las plantillas se cumplimentan sin rediseñarlas.
- **Requisito previo:** Calidad corrige en el PNT controlado el encabezado «GC-10/014/03» de los anexos. El hash que verifica el instalador será el del binario corregido.
- Los binarios corporativos no se versionan en Git; se registran nombre y SHA-256 al implementar.
- Una nueva revisión del PNT se incorpora como nueva versión de plantilla; los expedientes conservan la versión con la que se crearon (AGENTS.md).

## 9. Importación del histórico

`LISTADO GENERAL OOS.xlsx` contiene 38 OOS en hojas anuales: 3 de 2023, 5 de 2024, 9 de 2025 y 21 de 2026. Puntos que la importación debe tratar con conciliación y acta, como en Desviaciones y CAPA:

- la hoja «2026 (insp)» duplica «2026» y no se importa;
- las columnas cambian por año: 2023 tiene «Aplica a» (FARMA/QUÍMICA) y códigos `OOS/GC-10/…`; 2024 y 2025 tienen «Confirmación OOS»; 2025 y 2026 tienen «Ámbito»;
- hay fechas con formato erróneo: un número de serie de Excel y fechas con dígitos de más o de menos;
- «Fecha de cierre» mezcla fechas, iniciales y textos de estado («pendiente cierre», «pendiente investigación fase II»);
- el listado de 2026 llega a `OOS/API/004/2026`, pero existe al menos un informe `OOS/API/006/2026`, así que el listado está incompleto.

El listado solo tiene los campos del Anexo VI: los expedientes importados se cargan con esos datos y sin el detalle de las fases. El fichero real no se versiona (AGENTS.md).

## 10. Pendiente de decisión

1. **Anexo VI**: el PNT 04 lo define como tabla Word; el Excel operativo añade «Ámbito» y «Confirmación OOS», y su cabecera sigue citando «Anexo V PNT GC-00/014/02». Propuesta: listado anual imprimible con las columnas del PNT para firma manuscrita, más la exportación Excel habitual con las columnas añadidas.
2. **Valores de «Resultado»** de la evaluación de la Fase I. Propuesta: Conforme / No conforme / No aplica, más observación.
3. **Alcance de la importación**: todo el histórico 2023-2026 o solo los abiertos.
4. **Corrección del PNT 04** por Calidad antes de instalar las plantillas.

## 11. Plan de implementación

| PR | Alcance |
| --- | --- |
| **OOS-0 (esta)** | Diseño, decisión D-088 y fuente en GMP_SOURCES |
| OOS-1 | Modelo y migración aditiva, contrato y registro, listado, ficha, alta, datos iniciales, Fase I, estados, codificación, permisos, búsqueda y pruebas |
| OOS-2 | Fase II, resultado, cierre, relaciones con CAPA y Desviación, cronología y captura del audit trail |
| OOS-3 | Anexos III y IV, Anexo VI según decisión, instalación de plantillas e importador del histórico |

Cada PR con lint, tests, Prisma validate, build y la batería CI completa. El módulo no queda validado GMP por estar implementado (D-076).
