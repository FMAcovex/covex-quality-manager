# Especificación funcional — COVEX Quality Manager

## 1. Objetivo

Crear una aplicación web interna para registrar, consultar, seguir y relacionar expedientes del Sistema de Calidad de COVEX, reduciendo la dependencia de listados Excel independientes y permitiendo generar los anexos oficiales desde datos estructurados.

## 2. Módulos

Módulos previstos:
1. Desviaciones.
2. CAPA.
3. Controles de cambios.
4. Reclamaciones.
5. Devoluciones.
6. Indicadores.

Desviaciones es el primer módulo operativo. CAPA se prepara desde el modelo de datos y se implementa después.

## 3. Principios

- Una sola fuente estructurada de datos.
- Formularios de aplicación optimizados para uso diario; no réplicas visuales de Word.
- Generación posterior del documento controlado.
- Expedientes consultables en pantalla completa.
- Seguimientos como registros históricos independientes.
- Relaciones N:N entre expedientes.
- Versionado de formularios y plantillas.
- Capacidad de evolucionar a alertas, permisos, Entra, SharePoint y audit trail en fases posteriores.

## 4. Desviaciones — pantalla principal

Navegación del módulo:
- Expedientes.
- Indicadores.

Orden visual:
1. filtros horizontales;
2. buscador;
3. acciones `+ Nueva desviación` y `Exportar`;
4. tabla de seguimiento.

Filtros mínimos:
- año;
- departamento;
- estado;
- clasificación;
- procedencia/origen;
- medidas adoptadas;
- CAPA;
- cierre en plazo;
- más filtros.

El buscador debe consultar al menos:
- código;
- material/proceso;
- descripción;
- causa raíz;
- CAPA;
- observaciones.

## 5. Listado operativo de desviaciones

La vista de seguimiento tomará como referencia el listado actual y mostrará, como mínimo, las columnas funcionales existentes hasta Observaciones:

- Código departamento.
- Codificación.
- Departamento.
- Material/proceso afectado.
- Procedencia.
- Descripción.
- Clasificación.
- Causa raíz.
- Fecha apertura.
- Fecha cierre.
- Estado.
- Cerrada en el tiempo establecido.
- Medidas adoptadas.
- Descripción CAPA.
- Documento firmado / disponibilidad documental.
- Observaciones.

Los campos exclusivamente KPI no se mostrarán en la tabla operativa principal.

Puede existir una columna compacta de control para avisos como:
- datos históricos incompletos;
- documento firmado no informado;
- fuera de plazo.

## 6. Expediente de desviación

Se abre a pantalla completa.

Pestañas:
- Resumen.
- Investigación.
- Acciones.
- Seguimientos.
- Documentos.
- Historial.

Acciones principales:
- Editar.
- Añadir seguimiento.
- Generar Anexo III.
- Acciones relacionadas.
- Opciones adicionales.

No incluir `Abrir SharePoint` en el MVP salvo que posteriormente se implemente integración.

## 7. Alta y edición de desviación

El formulario se organiza por bloques:
1. Identificación y origen.
2. Documentación afectada.
3. Descripción del evento.
4. Acciones correctoras inmediatas.
5. Investigación.
6. Metodología y causa raíz.
7. Clasificación e impacto.
8. Decisión y planificación CAPA.
9. Conclusión, disposición y cierre.

Debe poder guardarse sin completar todo el expediente. El estado oficial inicial se mantiene simple: Abierta/Cerrada. La aplicación puede mostrar información de campos pendientes sin inventar estados GMP adicionales.

Los expedientes cerrados permanecen editables en V1.

## 8. CAPA dentro de una desviación

La desviación puede incluir cero o varias acciones CAPA propuestas.

Cada propuesta incluirá, cuando aplique:
- tipo correctiva/preventiva;
- descripción;
- responsable;
- fecha prevista;
- código AC/AP si ya existe;
- vínculo al expediente CAPA real si se registra.

La transición `CAPA propuesta -> Crear/relacionar CAPA` no debe duplicar manualmente información aprobada innecesariamente.

## 9. Seguimientos

Cada seguimiento es un registro independiente y cronológico.

Campos base:
- fecha;
- cumplimentado por;
- tipo;
- comentario/actuación;
- próxima fecha;
- referencia/evidencia opcional.

Un seguimiento nuevo nunca debe sobrescribir seguimientos anteriores.

## 10. Observaciones internas

Campo operativo adicional:
- editable;
- visible en listado;
- buscable;
- utilizable en exportaciones/listados;
- no se vuelca automáticamente al Anexo III;
- puede alimentar Observaciones del Anexo V cuando proceda.

## 11. Exportaciones

Desde Desviaciones:
- Anexo III individual en DOCX.
- Anexo V oficial por año en XLSX, conservando sus hojas/vistas oficiales.
- Listado simple de los registros filtrados.
- Listado completo del año.

El listado simple debe poder reflejar los filtros activos.

## 12. Indicadores

Los KPI se calculan desde la misma base de datos que los expedientes.

Indicadores iniciales:
- desviaciones por área;
- recurrencia;
- afectación a producto terminado;
- cerradas en plazo;
- mediana de días de cierre;
- clasificación;
- origen;
- con CAPA;
- abiertas;
- comparativa anual;
- tendencia hasta 5 años.

No mantener un segundo origen manual de datos para KPI.

## 13. Históricos

Importar 2025 y 2026 del listado existente.

Reglas:
- no inventar datos ausentes;
- conservar el estado existente;
- marcar calidad/completitud del dato por separado;
- detectar duplicados;
- producir informe de importación;
- permitir completar posteriormente desde la interfaz.

## 14. Evolución futura

La arquitectura debe permitir añadir:
- campos;
- nuevas versiones de formulario;
- nuevas plantillas;
- alertas;
- permisos;
- identidad Microsoft;
- SharePoint;
- bloqueo de estados;
- audit trail;
- aprobaciones/firma electrónica;
sin romper históricos.


## Auditorías R3A

Un módulo y un expediente común para internas/externas. Escenarios: interna COVEX, interna contratada, a proveedor, cliente a COVEX e inspección. Modalidad opcional presencial/remota/mixta. Auditoría interna subcontratada sigue siendo interna. No se implementan hallazgos, CAPA Plan, relaciones nuevas, anexos, archivos, versiones formales, Review, alertas ni cierre definitivo. Las obligatoriedades y códigos aplicados son los aprobados para R3A por el usuario.

## Auditorías R3B

R3A se amplía con hallazgos persistentes, recomendaciones, criticidad, CAPA Plan con acciones locales, seguimiento general/hallazgo, atribuciones a Desviación/CAPA existentes y navegación bidireccional. Reglas concretas en D-065 y docs/AUDITS_R3B.md. No se emite informe ni se habilita cierre definitivo, Review, adjuntos o versiones de Auditorías.
