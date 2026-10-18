# Verificación de anexos con las plantillas oficiales — 18/10/2026

Comprobación del relleno de los 24 anexos que genera la aplicación, hecha con las plantillas oficiales y el código de `main` a 18/10/2026. Los fallos encontrados se corrigen en la misma PR (D-098). Las plantillas reales y los expedientes de prueba **no** se versionan.

## Método

1. **Base de datos aislada.** Se crea una base de datos de prueba con datos de demostración ficticios. Las plantillas se instalan con los instaladores del proyecto, que comprueban la huella SHA-256 de cada archivo:
   - `ANEXOS_PARA_APP.zip`;
   - `plantillas_auditorias_oficiales_COVEX.zip`;
   - el PNT GC-10/014/04 de OOS.
2. **Expedientes marcados.** Cada texto del expediente DEMO de cada módulo se sustituye por un marcador único (`⟦Modelo.campo⟧`) y cada fecha por una fecha distinta de 2031. Así se identifica qué dato cae en qué casilla.
3. **Generación** con los mismos generadores que usa la descarga desde la ficha.
4. **Comparación casilla a casilla** de la plantilla con el anexo generado:
   - qué dato cae bajo cada etiqueta;
   - qué texto de la plantilla cambia;
   - qué campos del expediente no se imprimen.

   Las celdas envueltas en controles de contenido se cuentan igual que en la aplicación.
5. **Comprobación estricta de etiquetas.** Cada palabra de la plantilla debe seguir en su celda y en el mismo orden. Una casilla marcada ☒ equivale a la ☐ de la plantilla, y los huecos `____` pueden sustituirse por el dato.

**Límite:** se verifica el relleno de cada plantilla. La descarga desde la pantalla usa el mismo generador con los datos de la versión del expediente.

## Resultado

| Módulo | Anexo | Plantilla | Antes | Después |
|---|---|---|---|---|
| Desviaciones | III · Informe | 06 | F1, F2, D1 | ✓ |
| Desviaciones | V · Listado anual | 06 | ✓ | ✓ |
| CAPA | III · Informe y seguimiento | 05 | ✓ | ✓ |
| CAPA | IV · Listado anual | 05 | ✓ | ✓ |
| Control de cambios | III · Solicitud | 03 | F7 | ✓ (ver observaciones) |
| Control de cambios | IV · Dictamen | 03 | F8 | ✓ |
| Control de cambios | V · Seguimiento | 03 | F9, F10, F11 | ✓ |
| Control de cambios | VII · Listado anual | 03 | ✓ | ✓ |
| Reclamaciones | III · Informe | 03 | F3 | ✓ |
| Reclamaciones | IV · Respuesta | 03 | ✓ | ✓ |
| Reclamaciones | V · Listado anual | 03 | F4 | ✓ |
| Devoluciones | III · Formulario | 03 | ✓ | ✓ |
| Devoluciones | IV · Hoja de producto | 03 | ✓ | ✓ |
| Devoluciones | V · Declaración del cliente | 03 | F5 | ✓ |
| Devoluciones | VI · Listado anual | 03 | F6 | ✓ |
| OOS | III · Fase I | 04 | ✓ | ✓ |
| OOS | IV · Fase II | 04 | ✓ | ✓ |
| OOS | VI · Listado general | 04 | ✓ | ✓ |
| Auditorías | Informe interna | 03 | ✓ | ✓ |
| Auditorías | Informe externa | 04 | ✓ | ✓ |
| Auditorías | Plan CAPA | 03 | ✓ | ✓ |
| Auditorías | Plan de auditoría externa (Anexo IV GC-00/034/04) | 04 | ✓ | ✓ |
| Auditorías | Programa anual interno (PMAI V04) | — | ✓ | ✓ |
| Auditorías | Programa anual externo (PMAE V05, Anexo I) | — | ✓ | ✓ |

Después de los arreglos, la comprobación estricta solo encuentra sustituciones intencionadas: huecos de código y fecha (`C/__-__/___/____`, `__/____/______`), ejemplos de la plantilla (`Ej: 00 (dd/mm/yyyy)`, fila de ejemplo del seguimiento, filas de ejemplo de los programas anuales), indicaciones de relleno (`(nombre)`, `(especificar)`, `analista`, `turno`) y «Página X». En Auditorías, el plan y los programas se generan a partir del PNT completo; las diferencias de su portada no afectan al anexo.

## Fallos corregidos

| # | Anexo | Fallo | Corrección |
|---|---|---|---|
| F1 | Desviaciones III | La descarga de una versión anterior (`?version=N`) devolvía siempre la última, porque la expresión que reconoce el número de versión no coincidía nunca. | Se usa la misma validación que en CAPA. Una versión mal escrita responde con error en vez de descargar la vigente. |
| F2 | Desviaciones III | «Impacto sobre otros procesos/productos SI ☐ (detallar cuales): NO ☐ NA ☐» perdía «(detallar cuales):». | Se marcan las casillas de la plantilla sin reescribir su texto y el detalle se añade debajo. |
| F3 | Reclamaciones III | Varios textos oficiales cambiados:<br>• «Autoridad / entidad sanitaria».<br>• «Aviso a cliente / proveedor / titular /Autoridad».<br>• «(justificar)».<br>• Casillas y línea de referencias de «Estado de las acciones».<br>• «No Conforme».<br>• «ABONO» y «REPOSICIÓN».<br>Además, añadía «☐ N/A» a cinco preguntas que solo tienen Sí/No. | Se escriben los textos literales de la plantilla. |
| F4 | Reclamaciones V | El listado Excel no incluía los otros lotes afectados (D-094). El cambio se había hecho en un generador Word sin uso. | Columnas de producto y lote con un lote por línea. Se retira el generador sin uso. |
| F5 | Devoluciones V | El nombre del firmante se escribía también en «☐ Otra documentación: ____». | Solo se rellena la línea «D./D.ª ____». |
| F6 | Devoluciones VI | «Seguimiento y control» mostraba «Trazabilidad: YES». | «Trazabilidad: Sí / No / N/A». Se retira el generador Word del listado, que no se usaba. |
| F7 | Control de cambios III | «Nombre y cargo del responsable que acepta la solicitud: ____» se reescribía como «Responsable de dictamen: … Cargo: …». | Se conserva la etiqueta. Nombre y cargo van en sus dos líneas, y la firma sigue siendo manuscrita. |
| F8 | Control de cambios IV | Las celdas de detalle de implicaciones perdían su etiqueta:<br>• «Justificar e indicar personal/departamentos implicados:».<br>• «(si Sí, indicar fecha y evidencia):».<br>• «(si Sí, indicar detalle):».<br>• «Especificar:».<br>• «Detalles:».<br>Además, las casillas de estabilidad cambiaban de orden. | Etiqueta y debajo el dato; sin dato se conserva la línea de relleno. Las casillas de estabilidad van en el orden de la plantilla («E. acelerada ☐»). |
| F9 | Control de cambios V | El número de seguimiento se escribía junto a su etiqueta y el historial encima de «Historial de Seguimientos:». La casilla del número va envuelta en un control de contenido y no se tenía en cuenta. | El número va en su casilla y el historial sustituye al ejemplo «Ej: 00 (dd/mm/yyyy)…». |
| F10 | Control de cambios V | Añadía «☐ NO APLICA» a la eficacia, que en la plantilla solo tiene Aceptable / No aceptable / Pendiente. | Sin casilla nueva. «No aplica» se indica en las observaciones de la comprobación. |
| F11 | Control de cambios V | El cierre del seguimiento sustituía el bloque «Aprobación y cierre del cambio, si aplica (Gª Calidad / Dirección Técnica/Responsable Técnico actividad IPS)… Firma… Fecha…» por «Aprobación: …». Se detectó con la comprobación estricta. | Se conservan los dos bloques y la aprobación se escribe bajo su etiqueta. |

## Decisiones del responsable de Calidad

| # | Asunto | Decisión |
|---|---|---|
| D1 | Desviaciones III · Disposición final | **Opción A** (D-098). El campo pasa a ser una lista con las opciones del anexo: Aprobado / Rechazado / Rechazado – Destruir / Rechazado – Devolver / Otro. El anexo marca exactamente esa casilla y escribe la cantidad en su línea «Cantidad ____». El texto libre anterior se conserva y se imprime como «Otro». |
| D2 | Observaciones internas en los listados (Reclamaciones V, Devoluciones VI) | **Se mantienen.** Sirven de seguimiento en el listado aunque no aparezcan en los informes. |

## Pruebas automáticas añadidas

Usan plantillas sintéticas con los textos literales de las celdas afectadas, sin las plantillas reales. Cada prueba falla con el código anterior a los arreglos.

- `src/modules/annex-template-text.test.ts`: Control de cambios III, IV y V y Devoluciones V. Comprueba que el texto de la plantilla sigue en cada celda.
- `src/modules/deviations/documents/annex-iii.test.ts`: impacto con «(detallar cuales):» y casilla y cantidad de cada disposición, incluido el texto anterior como «Otro».
- `src/modules/annex-listings.test.ts`: otros lotes en el listado de Reclamaciones y «Trazabilidad: Sí» en Devoluciones.
- `src/modules/complaints/documents/r4a.test.ts`: textos oficiales del Anexo III de Reclamaciones.
- `src/lib/ooxml/template-text.ts`: la comprobación de etiquetas (`missingTemplateWords`), reutilizable para revisar una plantilla nueva.

## Observaciones sin corregir

- **Control de cambios III · Alcance.** La plantilla repite «Especificar:» dos veces tras «☐ Otros», aparentemente por error de edición. El anexo lo imprime una vez, con el dato.
- **Instaladores sueltos.** `install-document-templates.ts` y `install-change-control-templates.ts` esperan otros nombres o huellas que el instalador del paquete y el generador. El paquete `ANEXOS_PARA_APP.zip` se instala bien con `install-template-bundle.ts`. Queda pendiente unificarlos.
- **Datos de demostración.** La CAPA DEMO guardaba el origen como «DEVIATION», y la aplicación guarda «Desviación». Se corrige en `seed-demo.ts`; no afecta a expedientes reales.
- **Una plantilla nueva** sigue requiriendo revisar el mapeo del generador antes de activarla (`ANNEX_MAPPING.md`, «Principios de control»). La comprobación de etiquetas ayuda a revisarla, pero no se aplica automáticamente al subir la plantilla.
