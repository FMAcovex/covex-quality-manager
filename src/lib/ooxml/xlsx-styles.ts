export function appendFillVariants(
  stylesXml: string,
  baseStyleIds: number[],
  fillIds: number[],
) {
  const match = stylesXml.match(/<cellXfs\b([^>]*)>([\s\S]*?)<\/cellXfs>/);
  if (!match) throw new Error("XLSX styles: cellXfs no encontrado.");

  const xfs = [...match[2].matchAll(/<xf\b[^>]*(?:\/>|>[\s\S]*?<\/xf>)/g)].map((item) => item[0]);
  const mapping = new Map<string, number>();
  const additions: string[] = [];

  for (const baseId of baseStyleIds) {
    const base = xfs[baseId];
    if (!base) throw new Error(`XLSX styles: estilo base ${baseId} no encontrado.`);
    for (const fillId of fillIds) {
      let variant = base;
      if (/\bfillId="\d+"/.test(variant)) {
        variant = variant.replace(/\bfillId="\d+"/, `fillId="${fillId}"`);
      } else {
        variant = variant.replace("<xf ", `<xf fillId="${fillId}" `);
      }
      if (/\bapplyFill="\d+"/.test(variant)) {
        variant = variant.replace(/\bapplyFill="\d+"/, 'applyFill="1"');
      } else {
        variant = variant.replace("<xf ", '<xf applyFill="1" ');
      }
      const styleId = xfs.length + additions.length;
      additions.push(variant);
      mapping.set(`${baseId}:${fillId}`, styleId);
    }
  }

  const newCount = xfs.length + additions.length;
  const attrs = /\bcount="\d+"/.test(match[1])
    ? match[1].replace(/\bcount="\d+"/, `count="${newCount}"`)
    : `${match[1]} count="${newCount}"`;

  return {
    stylesXml: stylesXml.replace(
      match[0],
      `<cellXfs${attrs}>${match[2]}${additions.join("")}</cellXfs>`,
    ),
    styleId(baseStyleId: number, fillId: number) {
      const id = mapping.get(`${baseStyleId}:${fillId}`);
      if (id === undefined) throw new Error("XLSX styles: variante no encontrada.");
      return id;
    },
  };
}
