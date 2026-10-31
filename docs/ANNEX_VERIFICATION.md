# Verificación de los anexos con las plantillas reales (D-128)

Comprueba que los 24 anexos que genera la aplicación se rellenan bien con las plantillas oficiales. Para revisar una revisión nueva de un anexo desde la aplicación, con un expediente real y antes de activarla, está el botón «Probar» de Configuración → Versiones (D-129, [GUIA_PLANTILLAS_CALIDAD.md](GUIA_PLANTILLAS_CALIDAD.md)). Repite el método de la verificación del 18/10/2026 ([ANNEX_VERIFICATION_2026-10-18.md](ANNEX_VERIFICATION_2026-10-18.md)) con un solo comando. Se ejecuta antes de cada actualización y cuando se cambia un anexo o un generador.

Las plantillas reales **no** se versionan, porque el repositorio es público. Se usan en el equipo o el servidor donde se ejecuta el comando. La carpeta de salida (`informe-anexos/`, ignorada por Git) guarda una copia de cada plantilla, el anexo generado y el informe.

## Cómo se ejecuta

1. Crear una base de datos **desechable**. Su nombre debe empezar por `covex_annexes_verify`; el comando se niega a usar cualquier otra base de datos, sin excepciones. La salida, que guarda copias de las plantillas, no puede quedar dentro del repositorio salvo en `informe-anexos/`. Por ejemplo, con el PostgreSQL de `compose.yaml`:

   ```bash
   docker compose exec postgres createdb -U covex covex_annexes_verify
   ```

2. Ejecutar el comando con esa base de datos y la carpeta, ZIP o archivos de las plantillas. Se admiten los mismos paquetes que en `pnpm templates:install`.

   ```bash
   DATABASE_URL="postgresql://USUARIO:CLAVE@localhost:5432/covex_annexes_verify" \
     pnpm annexes:verify -- --out informe-anexos plantillas/
   ```

   El comando:
   1. aplica las migraciones;
   2. carga los catálogos y los expedientes de demostración;
   3. instala las plantillas reconociéndolas por su huella SHA-256 (D-099);
   4. genera los anexos y los compara.

   Con `--skip-setup`, repite solo la generación y la comparación sobre la misma base de datos.

   Se verifica la versión **activa** de cada anexo, la que usan los expedientes nuevos, o la última instalada si no hay ninguna activa. El generador y la comparación usan la misma. Para verificar una revisión nueva antes de activarla, se indica con `--version DOCUMENTO=VERSIÓN`, por ejemplo `--version CAPA_ANNEX_III=06`. Se puede repetir para varios anexos.

3. Leer `informe-anexos/INFORME.md`. El comando termina con error si algún anexo no sale como se espera.

Al terminar se puede borrar la base de datos (`dropdb covex_annexes_verify`) y la carpeta de salida.

## Qué comprueba

Los expedientes de demostración se preparan en memoria:
- **Textos:** cada texto se sustituye por un marcador único (`⟦Modelo.campo⟧`).
- **Fechas:** cada fecha se sustituye por una fecha distinta de 2031.
- **Tablas:** cada texto que admite tablas (D-127) recibe una tabla cuyo título nombra su campo.
- **OOS:** no hay OOS de demostración, así que se construye uno completo con Fase I y Fase II.

Con esos expedientes se generan los anexos con los mismos generadores que las descargas. Después, cada anexo se compara con su plantilla. En Word se comparan las tablas, las filas y las casillas; en Excel, las hojas por posición y las celdas.

1. **Qué dato cae en cada casilla**, con la etiqueta de la plantilla que tiene al lado o encima. Las filas que el anexo copia (una por acción, producto o seguimiento) y las filas de datos de los listados no descuadran las de debajo.
2. **Que el texto de la plantilla sigue en su sitio**, con el mismo criterio de D-098: una casilla ☒ equivale a la ☐, y los huecos `____` se pueden rellenar.
   - Algunos textos de la plantilla son marcadores que la aplicación sustituye a propósito. Son «fecha», «hora», «(Nombre)», «X», «XX:XX», «AÑO», las filas de ejemplo y el texto de ayuda de Word, entre otros.
   - Esas sustituciones previstas están en `scripts/verify-annexes-expected.json`. Se guardan como **posición + huella**, sin su texto, para no copiar contenido de las plantillas al repositorio. Si cambian la plantilla o el relleno, la huella deja de coincidir y vuelve a salir como fallo.
3. **Qué campos del expediente no se imprimen.** Los que no se imprimen a propósito están en la misma lista (`notPrinted`). Son, por ejemplo:
   - las observaciones internas;
   - los datos de anulación;
   - los seguimientos antiguos;
   - los campos de otro anexo.

   Un campo que deje de imprimirse sin estar en la lista es un fallo.
4. **Que cada campo sigue en su casilla.** La lista guarda en qué casillas sale cada campo (`positions`). Un campo que cambia de casilla es un fallo aunque se imprima, por ejemplo con columnas o casillas desplazadas.
5. **Que cada tabla sale en la casilla donde sale el texto de su campo**, y solo si sale ese texto. En los anexos que no llevan tablas de los textos no debe salir ninguna.
6. **Qué casillas de verificación se marcan (☒)** (D-132).
   - El informe lista cada casilla marcada con su opción (por ejemplo, «Tabla 4, fila 6, casilla 1, opción 2 · NO»). Al lado van los valores de las opciones del expediente de demostración, para comprobar a mano que cada ☒ es la opción correcta.
   - La lista de lo previsto guarda qué casillas se marcan, como posición + huella de la opción. Una casilla marcada que no estaba prevista, o una prevista que ya no se marca, es un fallo.
   - También es un fallo una casilla de la tabla con distinto número de casillas de verificación que la plantilla, salvo que esté prevista (por ejemplo, filas de ejemplo que el anexo sustituye).
7. **Que los controles de casilla de Word son coherentes.** Si una casilla se ve marcada (☒) pero su control de Word está sin marcar, o al revés, Word la cambia al pulsarla. Es un fallo que no se puede dar por bueno: hay que corregir el generador.
8. **Las cabeceras y los pies de Word**, parte a parte, con el mismo criterio que el cuerpo. Los datos que caen en ellos cuentan como impresos; por ejemplo, el código de auditoría que sustituye a `AE/XXXX/YY/AAAA` en el pie del informe externo, que está previsto.

También se avisa de una fila o una casilla de la plantilla que falta, de una hoja que falta o sobra, y de un número de tablas distinto.

## Cuando falla

- **Fallo real:** se corrige el generador y se vuelve a ejecutar.
- **Cambio intencionado de una plantilla o de un generador:** se revisa el informe y se regenera la lista con `--write-expected`. Solo se reescriben los anexos generados; lo previsto para los demás se conserva. No se puede dar por bueno un anexo que no se genera, una tabla fuera de su casilla ni un control de casilla incoherente. Hay que revisar el diff de `scripts/verify-annexes-expected.json` antes de versionarlo, porque cada línea nueva es un texto de plantilla, un campo o una casilla marcada que se da por buena.

## Límites
- Qué opción se marca se comprueba con los valores del expediente de demostración, uno por campo. La primera vez se revisa a mano (el informe pone los valores al lado) y después se fija en la lista de lo previsto. Otras combinaciones de valores las cubren las pruebas automáticas de cada generador.
- Solo se leen las casillas ☐/☒. Las que se dibujan con símbolos de fuentes como Wingdings no se leerían. En las plantillas actuales esos símbolos son viñetas (Anexo IV de Cambios, historial del plan maestro de auditorías externas), no casillas.
- Los campos JSON solo llevan marcador donde se indica: los otros lotes y la justificación del plazo de Devoluciones. No llevan marcador las herramientas de investigación de Desviaciones (D-124) ni el resto de `extraData`, y lo que imprimen lo cubren sus pruebas.
- Los cuadros de texto de Word se comparan con el resto del texto fuera de las tablas, sin posición propia.
- Los marcadores llevan el modelo, no el camino completo: `QmsRecord.*` o `QmsRelation[1].*` pueden ser del expediente o del relacionado.
- Se usa el expediente vigente, no la foto de una versión anterior, y sin figuras (D-125).

- Se verifica el relleno de cada plantilla con un expediente completo de cada módulo, no todas las combinaciones de datos. Por ejemplo, en Reclamaciones solo se rellenan los detalles de las actuaciones que el expediente de demostración tiene marcadas.
- Los informes de reclamación v02 (PNT histórico) no se verifican si no se aporta su PNT.
- La comprobación de la aplicación instalada (descarga desde la ficha, versiones del expediente) la cubren las pruebas automáticas y los smokes. Este comando usa los mismos generadores con el expediente vigente.

## Resultado 31/10/2026 (casillas y cabeceras: D-132)

Se verificó con las plantillas oficiales de `ANEXOS PARA APP.zip`, las de auditorías, el PNT GC-10/014/04 de OOS, el paquete parcial verificado de Reclamaciones v03 y el `.docx` del PMAI V04. Los 24 anexos salen correctos.

La verificación encontró un fallo, ya corregido. En el Anexo III de Devoluciones, la tabla de la justificación del plazo excepcional se imprimía aunque la justificación no saliera. Ahora sigue a su texto, como las de los detalles de actuación de Reclamaciones.

Con las casillas, las cabeceras y los pies (D-132), los 24 anexos salen correctos. Se revisaron a mano las 66 casillas marcadas frente a los valores del expediente de demostración, y todas son la opción correcta. La ampliación encontró un fallo, ya corregido: en el Anexo III de Desviaciones, las casillas «Acciones correctivas», «Acciones preventivas» y «Sin acciones inmediatas» se veían marcadas, pero su control de Word seguía sin marcar (`markFirstCheckbox`).

