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
    date: "2026-11-12",
    summary: "Primera versión con notas. Recoge las mejoras del 29 de octubre al 12 de noviembre de 2026. La aplicación sigue sin validar para uso GMP.",
    changes: [
      "Tablas dentro de los textos largos de los seis módulos de expedientes y de los seguimientos de las acciones de CAPA; salen en los anexos dentro de su casilla.",
      "Viñetas en los textos largos, también en los anexos.",
      "Figuras (imágenes con pie) en los apartados de Desviaciones, numeradas al final del Anexo III.",
      "Herramientas de investigación en Desviaciones (5 porqués, Ishikawa, FTA…) y su resumen en el Anexo III.",
      "Modelos de expediente en Controles de cambios.",
      "Calendario de vencimientos y vista previa de PDF e imágenes sin descargarlos.",
      "Configuración → Versiones: botón «Probar» para generar un anexo con una plantilla nueva y un expediente real antes de activarla (guía para Calidad).",
      "Comando de verificación de los 24 anexos con las plantillas oficiales, para ejecutarlo antes de cada actualización: qué dato cae en cada casilla, qué casillas ☒ se marcan, y las cabeceras y los pies.",
      "La versión de la aplicación y estas novedades se ven al pie de cada página.",
      "Auditorías: informes de los PNT GC-00/033/04 y GC-00/034/05 y plan de auditoría 05, con varias personas por función en las firmas (elaborado, revisado, aprobado y recibido). Las auditorías abiertas antes del 15/11/2026 siguen con sus plantillas.",
      "Auditorías: estado «Cierre parcial» al establecer el CAPA plan 00 (en proveedor, al aceptar su respuesta), con su fecha; «Cerrada» pasa a «Cierre definitivo».",
      "Programa anual de auditorías como Anexo V de los PNT GC-00/033/04 y GC-00/034/05: año y versión, código y fechas de cada auditoría, comentarios de aplazadas o canceladas con su motivo, y «Nueva versión» con la lista de cambios.",
      "Al anular un expediente, su código queda libre y se puede asignar a otro expediente del mismo módulo. Si era el último de la serie, la aplicación lo vuelve a proponer.",
    ],
    fixes: [
      "Guardar un expediente cerrado o cancelado exige su permiso también en el servidor, como ya hacía la página.",
      "El historial de Controles de cambios ya no anota cambios que no se han hecho.",
      "El permiso «Configuración» se puede conceder por módulo; sin él nadie podía activar plantillas de los módulos.",
      "En el Anexo III de Devoluciones, la tabla de la justificación del plazo excepcional solo sale con su texto.",
      "Casillas marcadas también para Word en el Anexo III de Desviaciones (acciones correctivas, preventivas y sin acciones inmediatas) y en la clasificación del Anexo III de Reclamaciones: antes se veían marcadas, pero Word las trataba como sin marcar al pulsarlas.",
    ],
    actions: [
      "Calidad instala las plantillas nuevas de Auditorías (Configuración → Versiones) y las activa tras probarlas; conviene corregir en Word la sangría de la casilla REFERENCIA (fila MAYOR) del informe interno 04.",
      "Calidad instala y activa las plantillas del Anexo V de los programas anuales y completa «Elaborado por» y «Aprobado por» en cada programa antes de emitir la nueva versión.",
      "Quien administra los roles concede «Configuración» en los módulos cuyas plantillas gestiona Calidad (Configuración → Usuarios); la política queda pendiente de aceptación QA/DT.",
    ],
    database: true,
  },
];
