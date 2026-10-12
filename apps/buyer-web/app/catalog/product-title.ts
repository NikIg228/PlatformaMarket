/** Remove known import boilerplate; keep the source name and identifying parameters. */
export function compactProductTitle(name: string, catalogName?: string | null) {
  if (catalogName?.trim()) return catalogName.trim();
  let title = name.replace(/\s+/g, " ").trim();
  if (/^LM[- ]?активатор/i.test(title)) {
    const variant = title.match(/в вариантах\s+(\d+)$/i)?.[1];
    title = title.replace(/^LM[- ]?активатор/i, "LM Activator")
      .replace(/\s+для ортодонтическ.*$/i, "")
      .replace(/\bLOW\b/gi, "Low").replace(/\bHIGH\b/gi, "High")
      .replace(/\bLONG\b/gi, "Long").replace(/\bSHORT\b|шорт/gi, "Short")
      .replace(/\bNARROW\b/gi, "Narrow");
    if (variant) title += ` · вариант ${variant}`;
  }
  title = title.replace(/^Материал композиционный пломбировочный светоотверждаемый\s+(текучий\s+)?/i, "")
    .replace(/^Пломбировочный материал\s+/i, "")
    .replace(/-СТОМИР$/i, "");
  if (/^LUMEX AC\b/i.test(title)) title = title.replace(/опакуе дентине/gi, "Opaque Dentine").replace(/\s+масса для.*$/i, "");
  return title.trim() || name;
}
