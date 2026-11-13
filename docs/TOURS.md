# Recorridos por módulo (D-138)

Un recorrido es un guion que usa la aplicación como lo haría una persona: entra, rellena formularios, guarda, crea expedientes relacionados y descarga documentos. El mismo guion sirve para dos cosas:

| Modo | Para qué | Entorno | Qué deja |
|---|---|---|---|
| Prueba (por defecto) | Detectar que un cambio rompe el circuito del módulo | Base aislada de pruebas (`APP_ENV=test`), como en CI | Nada: borra lo que crea |
| Vídeo (`TOUR_VIDEO_DIR`) | Formación y comunicar cambios | Demo local (`APP_ENV=demo`) | Los expedientes en la demo y el vídeo `.mp4` (o `.webm` sin ffmpeg) |

Fuera de esos dos entornos el recorrido se niega a ejecutarse. Solo escribe a través de la interfaz, como un usuario. Hay dos excepciones, ambas solo en modo prueba: los expedientes mínimos de partida que un recorrido necesita y no le corresponde crear (por ejemplo, la desviación de origen del recorrido de CAPA), que llevan la marca del recorrido; y la limpieza, que borra por esa marca. En la demo no escribe fuera de la interfaz: usa los ejemplos de la demo y, si faltan, se detiene pidiendo cargarlos. Por eso `scripts/tours/` queda fuera del inventario de escritores del audit trail, como los smokes. Usa solo datos ficticios. No es evidencia de validación GMP.

## Recorridos disponibles

| Script | Módulo | Pasos |
|---|---|---|
| `tour:deviations` | Desviaciones | Alta en borrador → investigación con Ishikawa → clasificación e impacto → CAPA propuesta → apertura → CAPA desde la propuesta → Anexo III y listado |
| `tour:capa` | CAPA | Alta desde su desviación de origen con la acción propuesta → seguimiento 01 → eficacia conforme y cierre → Anexo III y listado |
| `tour:changes` | Controles de cambios | Solicitud (Anexo III) en borrador → dictamen (Anexo IV) con plan de ejecución, aprobado y abierto → seguimiento 01 con el cambio abierto → seguimiento 02 con eficacia aceptable y cierre → Anexos III, IV y V y listado |
| `tour:oos` | OOS | Alta → Fase I (21 parámetros e investigación en el laboratorio) sin error de laboratorio → vínculo con una CAPA → Fase II, resultado confirmado y cierre → Anexos III y IV y Anexo VI anual |

## Ejecutarlo

En modo prueba, con la aplicación arrancada contra la base aislada y el proveedor de identidad sintético, igual que el resto de pruebas de navegador:

```bash
pnpm tour:deviations
```

En modo vídeo, con la demo arrancada (`APP_ENV=demo`, base `covex_demo`):

```bash
TOUR_VIDEO_DIR=./videos pnpm tour:deviations
```

- Para ver los documentos en el vídeo hacen falta LibreOffice (`soffice`) y `pdftoppm`.
- Para el `.mp4`, `ffmpeg`.
- Si falta alguno, el vídeo se graba igual, sin esa parte.

## Si falla

El error indica el paso, la dirección de la página y los mensajes que se ven en pantalla. Por ejemplo:

```
Recorrido «Recorrido Desviaciones», paso 5 (5 · Se completa y se abre la desviación: recibe su código): …
Página: http://127.0.0.1:3000/deviations/…/edit
Mensajes en pantalla:
- Falta completar 1 campo obligatorio antes de guardar.
```

Aunque fallen también el cierre del navegador o la limpieza, se informa el error del paso, con los demás añadidos detrás. Con `TOUR_FAILURE_DIR=<carpeta>` guarda además una captura de la pantalla. En CI se guarda en las evidencias del grupo (`browser-qms-tours`).

## Añadir un recorrido

1. Crear `scripts/tours/<módulo>.ts` con `startTour()` de `scripts/tours/lib.ts`.
2. Dividirlo en pasos con `tour.step("rótulo", …)`. Cada paso:
   - usa `tour.click`, `tour.fill`, `tour.select` y `tour.download`, que en modo vídeo mueven el cursor y escriben a ritmo de lectura;
   - termina comprobando en la base de datos o en el documento lo que el usuario acaba de hacer.
3. Marcar los textos con una marca única. La limpieza del modo prueba borra por esa marca, también si el recorrido falla a medias.
4. Añadir el script `tour:<módulo>` a `package.json`, con `node --conditions=react-server --import tsx`, y al grupo de CI que corresponda en `.github/ci-suites.json`. El contrato de CI falla si un `tour:*` no está en ningún grupo.
