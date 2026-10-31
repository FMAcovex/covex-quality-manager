# Guía para Calidad: nueva revisión de un anexo (D-129)

Qué hacer cuando se aprueba una revisión nueva de un anexo (por ejemplo, el Anexo III de Desviaciones pasa de la 06 a la 07) y hay que usarla en la aplicación.

Se hace en **Configuración → Versiones → Versiones de plantillas**. Hace falta poder entrar en Configuración (permiso «Consultar» de Sistema), el permiso «Configuración» del módulo del anexo (D-130) y, para probar, los mismos permisos que para descargar ese anexo desde un expediente.

## 1. Registrar la revisión

En «+ Registrar nueva plantilla»:
1. Elegir el módulo y el documento.
2. Escribir la versión (por ejemplo, `07`) y la fecha desde la que está vigente. Debe ser posterior a la de la versión activa; si no, no se podrá activar.
3. Subir el archivo `.docx` o `.xlsx` aprobado y anotar la referencia documental (por ejemplo, el control de cambios que la aprueba).

La versión queda **inactiva**. Los expedientes siguen usando la anterior hasta que se active.

**Excepción: OOS.** Los anexos de OOS usan la revisión vigente en la fecha de emisión del OOS, esté activa o no (D-088). Una revisión de OOS registrada con una fecha de vigencia de hoy o anterior se empieza a usar al registrarla. Para probarla antes, registrarla con la fecha futura en que deba empezar a aplicarse y probarla antes de esa fecha.

## 2. Leer la comprobación automática

Junto a la versión inactiva aparece el resultado de comparar sus casillas y etiquetas con la versión activa (D-100):
- **✓ Mismas casillas y etiquetas.** La aplicación debería rellenarla igual. Pasar al paso 3.
- **Diferencias.** Se listan las casillas o etiquetas que cambian. Si la plantilla es incompatible, no se puede activar. Ver «Cuando no sale bien».

## 3. Probar con un expediente

Pulsar **Probar** en la fila de la versión nueva y después **Generar prueba**:
- **Sin indicar nada,** se usa el último expediente modificado del módulo, fuera de borrador y con código. En los listados anuales, el año en curso; en los programas de auditoría, el plan del año en curso o, si no lo hay, el más reciente.
- **Para elegir el caso,** se escribe el código de un expediente (por ejemplo, uno con varias acciones o productos) o un año.
- El archivo se llama `PRUEBA_…` y **no se guarda en el expediente**: no aparece en sus documentos ni en el historial.

La prueba se rellena con los mismos datos que la descarga desde la ficha del expediente: la última versión congelada o el estado actual, según el anexo. Lo único distinto es la revisión de la plantilla, y que no lleva las figuras de Desviaciones. Abrir el archivo y comparar con el mismo anexo descargado desde el expediente:
- cada dato está en su casilla, con su etiqueta;
- no falta ningún texto de la plantilla ni sobra nada;
- las tablas de los textos salen dentro de su casilla;
- la cabecera y el pie son los de la revisión nueva (la aplicación no los rellena, salvo el código de auditoría en el pie del informe de auditoría externa).

Conviene probar con dos o tres expedientes distintos: uno sencillo y otro con muchas filas (acciones, productos, seguimientos).

## 4. Activar

Si la prueba sale bien, pulsar **Activar**. Desde ese momento:
- los expedientes nuevos usan la revisión nueva;
- los expedientes ya creados conservan la revisión con la que se crearon.

## Cuando no sale bien

| Qué se ve | Qué hacer |
|---|---|
| La prueba no se genera y la página dice «No la actives» | El generador no sabe rellenar esta revisión. No activarla. Avisar a quien mantiene la aplicación con la versión y la referencia que da la página. |
| Un dato sale en otra casilla, falta texto o sobra | No activarla. Avisar con el archivo de prueba y la casilla afectada. Hace falta adaptar el generador y volver a verificar los anexos (`pnpm annexes:verify`, [ANNEX_VERIFICATION.md](ANNEX_VERIFICATION.md)). |
| La comprobación marca la plantilla como incompatible | Igual que la fila anterior: hay que adaptar la aplicación antes de activarla. |
| «No hay ningún expediente…» o «está en borrador» | No es un fallo de la plantilla: indicar el código de otro expediente que sí sirva para ese anexo. |
| «No tiene autorización» (o un mensaje breve de operación no autorizada) | Falta un permiso: «Configuración» del módulo, o descargar y generar documentos en ese expediente. Lo concede quien administra los roles. |

Activar no se deshace desde esta pantalla: solo se activa una versión con vigencia posterior a la activa, así que no se puede volver a la anterior. Por eso se prueba antes. Si se activa una revisión por error, avisar a quien mantiene la aplicación; los documentos ya generados no cambian.

## Límites

- La prueba no incluye las figuras de Desviaciones (D-125). Los informes de auditoría se rellenan con los datos actuales de la auditoría, aunque la descarga normal sale de una versión emitida.
- Sin indicar código, el expediente elegido es el último modificado de todo el módulo. Con ámbito «Asignados», si ese expediente es de otro departamento, la prueba se rechaza: indicar el código de un expediente propio.
- Activar una revisión no es una aprobación ni una firma electrónica: el control documental de la revisión sigue el PNT vigente.
- La prueba no sustituye a la verificación de los anexos antes de cada actualización de la aplicación (D-128) ni a la validación GMP.
