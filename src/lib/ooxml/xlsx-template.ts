export function xlsxCellStyle(sheetXml: string, ref: string) {
  const escaped = ref;
  const match = sheetXml.match(new RegExp(`<c\\b([^>]*\\br="${escaped}"[^>]*)>`)) ??
    sheetXml.match(new RegExp(`<c\\b([^>]*\\br="${escaped}"[^>]*)\\/>`));
  if (!match) return null;
  const style = match[1].match(/\bs="(\d+)"/)?.[1];
  return style ? Number(style) : 0;
}

export function setXlsxCellStyle(sheetXml: string, ref: string, styleId: number) {
  const escaped = ref;
  const regex = new RegExp(`<c\\b([^>]*\\br="${escaped}"[^>]*)`, "g");
  return sheetXml.replace(regex, (_full, attrs: string) => {
    const updated = /\bs="\d+"/.test(attrs)
      ? attrs.replace(/\bs="\d+"/, ` s="${styleId}"`)
      : `${attrs} s="${styleId}"`;
    return `<c${updated}`;
  });
}

function cellXfs(stylesXml: string) {
  const match = stylesXml.match(/<cellXfs\b([^>]*)>([\s\S]*?)<\/cellXfs>/);
  if (!match) throw new Error("XLSX: cellXfs no encontrado.");
  const xfs = [...match[2].matchAll(/<xf\b[^>]*(?:\/>|>[\s\S]*?<\/xf>)/g)].map((item) => item[0]);
  return { match, xfs };
}

function fillIdFromStyle(stylesXml: string, styleId: number) {
  const { xfs } = cellXfs(stylesXml);
  const xf = xfs[styleId];
  if (!xf) throw new Error(`XLSX: estilo ${styleId} no encontrado.`);
  return Number(xf.match(/\bfillId="(\d+)"/)?.[1] ?? 0);
}

export function appendFillStyleVariants(stylesXml: string, baseStyleIds: number[], sourceFillStyleId: number) {
  const parsed = cellXfs(stylesXml);
  const fillId = fillIdFromStyle(stylesXml, sourceFillStyleId);
  const unique = [...new Set(baseStyleIds)];
  const map = new Map<number, number>();
  const additions: string[] = [];
  for (const base of unique) {
    const source = parsed.xfs[base];
    if (!source) throw new Error(`XLSX: estilo base ${base} no encontrado.`);
    let clone = source;
    clone = /\bfillId="\d+"/.test(clone)
      ? clone.replace(/\bfillId="\d+"/, `fillId="${fillId}"`)
      : clone.replace(/<xf\b/, `<xf fillId="${fillId}"`);
    clone = /\bapplyFill="\d+"/.test(clone)
      ? clone.replace(/\bapplyFill="\d+"/, 'applyFill="1"')
      : clone.replace(/<xf\b/, '<xf applyFill="1"');
    const newId = parsed.xfs.length + additions.length;
    additions.push(clone);
    map.set(base, newId);
  }
  const body = parsed.xfs.join("") + additions.join("");
  const countAttrs = /\bcount="\d+"/.test(parsed.match[1])
    ? parsed.match[1].replace(/\bcount="\d+"/, `count="${parsed.xfs.length + additions.length}"`)
    : `${parsed.match[1]} count="${parsed.xfs.length + additions.length}"`;
  const updated = stylesXml.replace(parsed.match[0], `<cellXfs${countAttrs}>${body}</cellXfs>`);
  return { stylesXml: updated, styleMap: map };
}

export function applyStatusFill(sheetXml: string, row: number, columns: string[], styleMap: Map<number, number>) {
  let result = sheetXml;
  for (const column of columns) {
    const ref = `${column}${row}`;
    const base = xlsxCellStyle(result, ref);
    if (base === null) continue;
    const variant = styleMap.get(base);
    if (variant !== undefined) result = setXlsxCellStyle(result, ref, variant);
  }
  return result;
}