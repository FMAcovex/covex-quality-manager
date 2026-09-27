# Arquitectura de configuración funcional

## Principios aprobados

1. Los campos de un expediente no se crean libremente por el usuario.
2. Los campos pertenecen a una versión de formulario ligada a la revisión aplicable del PNT/anexo.
3. Todos los expedientes creados bajo la misma versión comparten la misma estructura.
4. Los expedientes históricos conservan la versión con la que fueron creados.
5. El listado operativo puede contener más columnas que el anexo impreso.
6. La elección de columnas visibles es una preferencia de vista y no modifica los datos.
7. Desviaciones no necesita columnas Último seguimiento / Próximo seguimiento en el listado principal.
8. CAPA sí mantiene las columnas de seguimiento acordadas.
9. Las plantillas Word permanecen versionadas; no se crea un editor Word dentro de la app.

## Tipos de campo

### Estructural
Campo con efecto en relaciones, reglas de negocio, KPI o integridad del expediente.
Ejemplos: código, estado, departamento, clasificación, eficacia, fechas de cierre.

No debe ser creado o redefinido libremente desde la interfaz.

### De formulario versionado
Campo exigido por una revisión concreta del anexo.
Puede configurarse en una nueva versión antes de activarla:
- etiqueta;
- sección;
- tipo;
- obligatoriedad;
- orden;
- visibilidad en listado;
- disponibilidad como filtro;
- inclusión en listado simple.

La definición queda bloqueada cuando la versión entra en vigor.

### Operativo de seguimiento
Dato útil para gestión que no necesariamente se imprime en el anexo.
Ejemplos: observaciones internas, control del dato, inclusión en KPI.

### Derivado / sistema
Valor calculado o inferido de datos estructurados.
Ejemplos: estado, días de cierre, existencia de CAPA relacionada, último seguimiento CAPA.

## Versionado

Flujo para una nueva revisión:
1. duplicar la versión activa como borrador;
2. modificar la definición de campos;
3. cargar la nueva plantilla documental;
4. configurar/mantener el mapeo plantilla-campos;
5. previsualizar con datos de prueba;
6. aprobar la configuración;
7. activar con fecha de vigencia;
8. nuevos expedientes usan la nueva versión;
9. expedientes existentes conservan la versión anterior salvo migración controlada explícita.

## Listados

La definición del formulario y la definición del listado son independientes.

El listado de seguimiento puede incluir:
- campos del anexo;
- campos operativos;
- campos derivados;
- campos de control del dato.

Cada columna puede definir:
- visible por defecto;
- disponible en selector;
- orden por defecto;
- filtrable;
- exportable en listado simple.

El anexo oficial de seguimiento mantiene su propia estructura y versión y no queda afectado por preferencias personales de columnas.

## Permisos

Mientras la aplicación no disponga de identidad y roles, la pantalla Configuración será de consulta/prototipo.
La edición funcional se habilitará cuando exista un rol administrador (preferentemente Garantía de Calidad) o un mecanismo equivalente controlado.

## Cambios que requieren actualización técnica

- nueva lógica de negocio;
- nuevo cálculo o KPI;
- cambio de relaciones entre módulos;
- campo estructural nuevo;
- modificación sustancial del mapeo de una plantilla Word;
- cambios que afecten integridad, permisos o trazabilidad.
