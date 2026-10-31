import type { ReleaseNote } from "./release-check";

/**
 * D-131: notas de cada versión, para los usuarios, de la más reciente a la más antigua.
 * Se escriben al preparar la versión (antes de entregarla a IT) y Calidad las revisa en la PR.
 * La aplicación las enseña en «Novedades»; `pnpm release:check` exige que la versión de
 * package.json tenga las suyas.
 */
export const releaseNotes: readonly ReleaseNote[] = [
  {
    version: "0.2.0",
    date: "2026-10-31",
    summary: "Primera versión con notas. Recoge las mejoras de la segunda quincena de octubre de 2026; la aplicación sigue sin validar para uso GMP.",
    changes: [
      "Tablas dentro de los textos largos de los seis módulos de expedientes y de los seguimientos de las acciones de CAPA; salen en los anexos dentro de su casilla.",
      "Viñetas en los textos largos, también en los anexos.",
      "Figuras (imágenes con pie) en los apartados de Desviaciones, numeradas al final del Anexo III.",
      "Herramientas de investigación en Desviaciones (5 porqués, Ishikawa, FTA…) y su resumen en el Anexo III.",
      "Modelos de expediente en Controles de cambios.",
      "Calendario de vencimientos y vista previa de PDF e imágenes sin descargarlos.",
      "Configuración → Versiones: botón «Probar» para generar un anexo con una plantilla nueva y un expediente real antes de activarla (guía para Calidad).",
      "Comando de verificación de los 24 anexos con las plantillas oficiales, para ejecutarlo antes de cada actualización.",
      "La versión de la aplicación y estas novedades se ven al pie de cada página.",
    ],
    fixes: [
      "Guardar un expediente cerrado o cancelado exige su permiso también en el servidor, como ya hacía la página.",
      "El historial de Controles de cambios ya no anota cambios que no se han hecho.",
      "El permiso «Configuración» se puede conceder por módulo; sin él nadie podía activar plantillas de los módulos.",
      "En el Anexo III de Devoluciones, la tabla de la justificación del plazo excepcional solo sale con su texto.",
    ],
    actions: [
      "Quien administra los roles concede «Configuración» en los módulos cuyas plantillas gestiona Calidad (Configuración → Usuarios); la política queda pendiente de aceptación QA/DT.",
    ],
    database: true,
  },
];
