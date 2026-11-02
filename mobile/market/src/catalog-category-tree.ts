import type { CatalogSearchResponse } from "../../../packages/schemas/src/core-api";
export type CatalogCategory = NonNullable<CatalogSearchResponse["filterOptions"]>["categories"][number];
export type CatalogCategoryPath = Readonly<{ row: CatalogCategory; names: readonly string[]; state: "complete" | "partial" | "cycle" | "ambiguous"; truncated: boolean }>;
type Path = Omit<CatalogCategoryPath,"row">;
const memo = new WeakMap<readonly CatalogCategory[],readonly CatalogCategoryPath[]>();
/** Source parent links only: iterative, bounded label tails and no invented missing ancestors. */
export function catalogCategoryPaths(rows: readonly CatalogCategory[]): readonly CatalogCategoryPath[] {
  const immutable = Object.isFrozen(rows) && rows.every(Object.isFrozen), previous = immutable ? memo.get(rows) : undefined; if (previous) return previous;
  const byId = new Map<string,CatalogCategory>(), duplicates = new Set<string>(), cache = new Map<string,Path>();
  for (const row of rows) { if (byId.has(row.id)) duplicates.add(row.id); else byId.set(row.id,row); }
  const path = (state: Path["state"], names: readonly string[] = [], truncated = false): Path => Object.freeze({ state, names: Object.freeze(names), truncated });
  for (const start of rows) {
    if (cache.has(start.id)) continue;
    const stack: CatalogCategory[] = [], seen = new Set<string>(); let current: CatalogCategory | undefined = start, base: Path = path("complete");
    while (current) {
      if (duplicates.has(current.id)) { cache.set(current.id,path("ambiguous",[current.name])); base = path("ambiguous"); break; }
      const known = cache.get(current.id); if (known) { base = known; break; }
      if (seen.has(current.id)) { base = path("cycle"); break; }
      seen.add(current.id); stack.push(current);
      if (current.parentId === null) break;
      current = byId.get(current.parentId); if (!current) { base = path("partial"); break; }
    }
    for (let index = stack.length-1; index >= 0; index--) {
      const row = stack[index]!;
      if (base.state === "cycle" || base.state === "ambiguous") base = path(base.state,[row.name]);
      else { const names = [...base.names,row.name], truncated = base.truncated || names.length > 12; base = path(base.state,names.slice(-12),truncated); }
      cache.set(row.id,base);
    }
  }
  const result = Object.freeze(rows.map(row => Object.freeze({ row, ...(duplicates.has(row.id) ? path("ambiguous",[row.name]) : cache.get(row.id) ?? path("partial",[row.name])) })));
  if (immutable) memo.set(rows,result); return result;
}
export function selectableCatalogCategory(rows: readonly CatalogCategory[], row: CatalogCategory) {
  if (!rows.includes(row)) return false;
  const value = catalogCategoryPaths(rows).find(candidate => candidate.row === row);
  return value?.state === "complete" || value?.state === "partial";
}
