# Plantillas controladas · Controles de Cambios v03

Directorio esperado para las plantillas oficiales de **GC-00/003/03**.

Los binarios `.docx`/`.xlsx` no se versionan en GitHub. Se instalan desde copias controladas mediante:

```
pnpm templates:changes:install -- \
  --annex-iii "<ruta Anexo III.docx>" \
  --annex-iv "<ruta Anexo IV.docx>" \
  --annex-v "<ruta Anexo V.docx>" \
  --annex-vii "<ruta Anexo VII.xlsx>"
```

El instalador valida SHA-256 antes de copiar cada fichero.

Hashes auditados en Hito 7:
- Anexo III: `a436d4aa732209e1aeb9620d5442a154a68899f875d1aa5d0dc437edd751a49f`
- Anexo IV: `742b1de11e0e0dece4e9c65c97613c112325189e183b9cb02c56ca82cd06cc60`
- Anexo V: `3012e81b0172c77c59c9c97514d788e10eb332a73e4490b9c0a1c87afa6ad1e4`
- Anexo VII fuente: `bdef034e5de4f314d77696230e07f2796c2d139f4868c055d68688082622ce16`

El generador de Anexo VII extrae únicamente la hoja oficial y recursos gráficos necesarios; no distribuye las hojas históricas o de dashboard contenidas en el libro fuente.