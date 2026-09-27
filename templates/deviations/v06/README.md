# Plantillas controladas — Desviaciones v06

Por limitaciones del conector de GitHub, los binarios controlados no se versionan automáticamente en este repositorio.

Instalar una sola vez para la demo/local:

```bash
pnpm templates:install -- --annex-iii "/ruta/Anexo III Informe Desviaciones 06.docx" --annex-v "/ruta/Anexo_V_Listado_de_Desviaciones_06 (2).xlsx"
```

El instalador verifica SHA-256 antes de copiar.

Plantillas auditadas el 2026-09-27:
- Anexo III Informe Desviaciones 06.docx — SHA-256 `8639c29198101a73253f0681620c89a3e2848b335d2a4be61b946f9b7a353d43`
- Anexo_V_Listado_de_Desviaciones_06 (2).xlsx — SHA-256 `18e7e4b7f53df7b07387c891005c1df229a7cb549e4885d52bb55550e4874817`

La aplicación no acepta silenciosamente otro archivo con el mismo nombre.
