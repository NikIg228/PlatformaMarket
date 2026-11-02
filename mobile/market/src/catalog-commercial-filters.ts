import { selectableCatalogCategory } from "./catalog-category-tree";
import { catalogFilterOptionsSchema, type CatalogSearchResponse } from "../../../packages/schemas/src/core-api";
import { searchCatalogSchema } from "../../../packages/schemas/src/index";
export type NativeCatalogCommercialClient = { nativeCatalogFilterOptions?: true };
export type CatalogSort = "RELEVANCE" | "PRICE_ASC" | "PRICE_DESC" | "NAME_ASC" | "UPDATED_DESC";
export const catalogSorts: readonly CatalogSort[] = Object.freeze(["RELEVANCE","PRICE_ASC","PRICE_DESC","NAME_ASC","UPDATED_DESC"]);
export type CatalogCommercialValues = Readonly<{ brandId?: string; manufacturerId?: string; packaging?: string; inStock?: "true"; sort?: CatalogSort; attributeFilters?: string }>;
export type CatalogFilterContext = Readonly<{ q: string; categoryId?: string; supplierOrganizationId?: string; cityId?: string }>;
export type CatalogOptions = NonNullable<CatalogSearchResponse["filterOptions"]>;
export type CatalogOptionGroup = "brands" | "manufacturers" | "packaging" | "attributes";
export const catalogOptionGroups: readonly CatalogOptionGroup[] = Object.freeze(["brands","manufacturers","packaging","attributes"]);
type Primitive = string | number | boolean;
type AttributeChoice = Readonly<{ code: string; value: Primitive }>;
type Draft = Readonly<{ brandId?: string; manufacturerId?: string; packaging?: string; stock: boolean; sort: CatalogSort; attributes: readonly AttributeChoice[]; group: CatalogOptionGroup; searches: Readonly<Record<CatalogOptionGroup,string>>; selections: Readonly<Partial<Record<CatalogOptionGroup,Readonly<{ start: number; end: number }>>>>; pages: Readonly<Record<CatalogOptionGroup,number>> }>;
export type CatalogCommercialFrame = Readonly<{ page: CatalogSearchResponse; context: CatalogFilterContext; key: string; options: Readonly<CatalogOptions> }>;
type CatalogCommercialCore = Readonly<{ phase: "idle" }> | Readonly<{ phase: "unavailable"; issue: "missing" | "contract" }> | Readonly<{ phase: "ready"; frame: CatalogCommercialFrame; draft: Draft; issue?: "missing" | "input" }>;
export type CatalogReferenceGroup = "categories" | "suppliers";
export type CatalogReferenceRow = CatalogOptions["categories"][number] | CatalogOptions["suppliers"][number];
export type CatalogReferenceView = Readonly<{ group: CatalogReferenceGroup; searches: Readonly<Record<CatalogReferenceGroup,string>>; selections: Readonly<Partial<Record<CatalogReferenceGroup,Readonly<{ start: number; end: number }>>>>; pages: Readonly<Record<CatalogReferenceGroup,number>> }>;
export type CatalogCommercialState = CatalogCommercialCore & Readonly<{ referenceView: CatalogReferenceView }>;
const referenceGroups: readonly CatalogReferenceGroup[] = Object.freeze(["categories","suppliers"]);
const blankReference = (): CatalogReferenceView => freeze({ group: "categories", searches: { categories: "", suppliers: "" }, selections: {}, pages: { categories: 0, suppliers: 0 } });
export type CatalogCommercialLabel = Readonly<{ kind: "brand" | "manufacturer" | "packaging" | "attribute" | "stock" | "sort"; name?: string; value?: Primitive; sort?: CatalogSort }>;
function freeze<T>(value: T): T { if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
const blank = (): Draft => freeze({ brandId: undefined, manufacturerId: undefined, packaging: undefined, stock: false, sort: "RELEVANCE", attributes: [], group: "brands", searches: { brands: "", manufacturers: "", packaging: "", attributes: "" }, selections: {}, pages: { brands: 0, manufacturers: 0, packaging: 0, attributes: 0 } });
function wire(draft: Draft): CatalogCommercialValues {
  const result: { -readonly [K in keyof CatalogCommercialValues]: CatalogCommercialValues[K] } = {};
  if (draft.brandId !== undefined) result.brandId = draft.brandId;
  if (draft.manufacturerId !== undefined) result.manufacturerId = draft.manufacturerId;
  if (draft.packaging !== undefined) result.packaging = draft.packaging;
  if (draft.stock) result.inStock = "true";
  if (draft.sort !== "RELEVANCE") result.sort = draft.sort;
  if (draft.attributes.length) result.attributeFilters = JSON.stringify(Object.fromEntries([...draft.attributes].sort((a,b) => a.code < b.code ? -1 : a.code > b.code ? 1 : 0).map(row => [row.code,row.value])));
  return Object.freeze(result);
}
function fromApplied(values: CatalogCommercialValues): Draft {
  let attributes: AttributeChoice[] = [];
  try { const raw: unknown = values.attributeFilters ? JSON.parse(values.attributeFilters) : {}; if (raw && typeof raw === "object" && !Array.isArray(raw)) attributes = Object.entries(raw).filter((entry): entry is [string,Primitive] => ["string","boolean"].includes(typeof entry[1]) || typeof entry[1] === "number" && Number.isFinite(entry[1])).map(([code,value]) => ({ code,value })); } catch { /* Only local route state is restored; it never authorizes a source choice. */ }
  return freeze({ ...blank(), brandId: values.brandId, manufacturerId: values.manufacturerId, packaging: values.packaging, stock: values.inStock === "true", sort: values.sort ?? "RELEVANCE", attributes });
}
export const catalogFilterContextKey = (context: CatalogFilterContext) => JSON.stringify([context.q,context.categoryId ?? null,context.supplierOrganizationId ?? null,context.cityId ?? null]);
const duplicates = (values: readonly string[]) => new Set(values).size !== values.length;
/** Read-only source options and drafts owned by one read-controller lifetime. No permission, write or durable state. */
export function createCatalogCommercialFilters(client: NativeCatalogCommercialClient, currentPage: () => CatalogSearchResponse | undefined) {
  let referenceView = blankReference();
  let active = true, state: CatalogCommercialState = Object.freeze({ phase: "idle", referenceView }), lastPage: CatalogSearchResponse | undefined, lastSignature: string | undefined;
  let applications = new WeakMap<CatalogCommercialValues,CatalogCommercialFrame>();
  const listeners = new Set<() => void>(), slots = new Map<string,{ draft: Draft; appliedKey: string }>(), labels = new Map<string,string>();
  const supported = () => { try { return active && client.nativeCatalogFilterOptions === true; } catch { return false; } };
  const owns = (page: CatalogSearchResponse) => { try { return supported() && currentPage() === page && supported(); } catch { return false; } };
  const live = (frame: CatalogCommercialFrame) => state.phase === "ready" && state.frame === frame && owns(frame.page);
  const unchangedOptions = (frame: CatalogCommercialFrame) => { if (!live(frame)) return false; try { const checked = catalogFilterOptionsSchema.parse(frame.page.filterOptions); return live(frame) && JSON.stringify(checked) === JSON.stringify(frame.options); } catch { return false; } };
  const publish = (next: CatalogCommercialCore) => { state = Object.freeze({ ...next, referenceView }); listeners.forEach(listener => listener()); };
  const patch = (frame: CatalogCommercialFrame, next: Partial<Draft>) => { if (!live(frame) || state.phase !== "ready") return; const draft = freeze({ ...state.draft, ...next }); const slot = slots.get(frame.key); if (!slot) return; slot.draft = draft; publish({ phase: "ready", frame, draft }); };
  const model = {
    supported, owns, live,
    getSnapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    admit(page: CatalogSearchResponse, context: CatalogFilterContext, applied: CatalogCommercialValues = {}) {
      if (!owns(page)) return;
      let key: string, signature: string;
      try { key = catalogFilterContextKey(context); signature = JSON.stringify([key,applied]); } catch { return; }
      if (!owns(page) || lastPage === page && lastSignature === signature) return;
      lastPage = page; lastSignature = signature;
      try {
        const rawOptions = page.filterOptions; if (!owns(page)) return;
        if (rawOptions === undefined) { publish({ phase: "unavailable", issue: "missing" }); return; }
        const options = catalogFilterOptionsSchema.parse(rawOptions);
        if (duplicates(options.categories.map(row => row.id)) || duplicates(options.suppliers.map(row => row.id)) || duplicates(options.brands.map(row => row.id)) || duplicates(options.manufacturers.map(row => row.id)) || duplicates(options.attributes.map(row => row.code)) || options.attributes.some(row => duplicates(row.values.map(value => `${typeof value}:${JSON.stringify(value)}`)))) throw Error("contract");
        if (!owns(page)) return;
        freeze(options);
        const frame: CatalogCommercialFrame = Object.freeze({ page, context: Object.freeze({ ...context }), key, options });
        if (!owns(page)) return;
        for (const row of options.categories) labels.set(`category:${row.id}`,row.name);
        for (const row of options.suppliers) labels.set(`supplier:${row.id}`,row.name);
        for (const row of options.brands) labels.set(`brand:${row.id}`,row.name);
        for (const row of options.manufacturers) labels.set(`manufacturer:${row.id}`,row.name);
        for (const row of options.attributes) labels.set(`attribute:${row.code}`,row.name);
        const appliedKey = JSON.stringify(wire(fromApplied(applied))); let slot = slots.get(key);
        if (!slot) { slot = { draft: fromApplied(applied), appliedKey }; slots.set(key,slot); }
        else if (slot.appliedKey !== appliedKey) { if (JSON.stringify(wire(slot.draft)) === slot.appliedKey) slot.draft = fromApplied(applied); slot.appliedKey = appliedKey; }
        publish({ phase: "ready", frame, draft: slot.draft });
      } catch { if (owns(page)) publish({ phase: "unavailable", issue: "contract" }); }
    },
    chooseId(frame: CatalogCommercialFrame, field: "brandId" | "manufacturerId", row?: CatalogOptions["brands"][number]) {
      if (!live(frame) || state.phase !== "ready" || !["brandId","manufacturerId"].includes(field)) return;
      const options = field === "brandId" ? frame.options.brands : frame.options.manufacturers;
      if (row !== undefined && !options.includes(row)) return;
      patch(frame,{ [field]: row?.id });
    },
    choosePackaging(frame: CatalogCommercialFrame, value?: string) { if (live(frame) && (value === undefined || frame.options.packaging.includes(value))) patch(frame,{ packaging: value }); },
    chooseAttribute(frame: CatalogCommercialFrame, row: CatalogOptions["attributes"][number], value: Primitive) {
      if (!live(frame) || state.phase !== "ready" || !frame.options.attributes.includes(row) || !row.values.some(candidate => Object.is(candidate,value))) return;
      const attributes = state.draft.attributes.filter(choice => choice.code !== row.code); attributes.push({ code: row.code, value }); patch(frame,{ attributes });
    },
    clearAttribute(frame: CatalogCommercialFrame, code: string) { if (live(frame) && state.phase === "ready") patch(frame,{ attributes: state.draft.attributes.filter(choice => choice.code !== code) }); },
    stock(frame: CatalogCommercialFrame, value: boolean) { if (typeof value === "boolean") patch(frame,{ stock: value }); },
    sort(frame: CatalogCommercialFrame, value: CatalogSort) { if (catalogSorts.includes(value)) patch(frame,{ sort: value }); },
    group(frame: CatalogCommercialFrame, value: CatalogOptionGroup) { if (catalogOptionGroups.includes(value)) patch(frame,{ group: value }); },
    search(frame: CatalogCommercialFrame, group: CatalogOptionGroup, value: string) {
      if (!live(frame) || state.phase !== "ready" || !catalogOptionGroups.includes(group) || typeof value !== "string" || value.length > 240) return;
      const previous = state.draft.selections[group]; patch(frame,{ searches: { ...state.draft.searches, [group]: value }, pages: { ...state.draft.pages, [group]: 0 }, ...(previous ? { selections: { ...state.draft.selections, [group]: { start: Math.min(previous.start,value.length), end: Math.min(previous.end,value.length) } } } : {}) });
    },
    selection(frame: CatalogCommercialFrame, group: CatalogOptionGroup, value: Readonly<{ start: number; end: number }>) {
      if (!live(frame) || state.phase !== "ready" || !catalogOptionGroups.includes(group) || !Number.isSafeInteger(value.start) || !Number.isSafeInteger(value.end) || value.start < 0 || value.end < value.start || value.end > state.draft.searches[group].length) return;
      const previous = state.draft.selections[group]; if (previous?.start === value.start && previous.end === value.end) return;
      patch(frame,{ selections: { ...state.draft.selections, [group]: { start: value.start, end: value.end } } });
    },
    optionPage(frame: CatalogCommercialFrame, group: CatalogOptionGroup, value: number) { if (live(frame) && state.phase === "ready" && catalogOptionGroups.includes(group) && Number.isSafeInteger(value) && value >= 0 && value <= 10000) patch(frame,{ pages: { ...state.draft.pages, [group]: value } }); },
    resetDraft(frame: CatalogCommercialFrame) { if (live(frame)) patch(frame,blank()); },
    apply(frame: CatalogCommercialFrame): CatalogCommercialValues | undefined {
      if (!live(frame) || state.phase !== "ready") return;
      if (!unchangedOptions(frame)) { if (live(frame)) publish({ phase: "unavailable", issue: "contract" }); return; }
      const draft = state.draft, result = wire(draft);
      const missing = draft.brandId !== undefined && !frame.options.brands.some(row => row.id === draft.brandId) || draft.manufacturerId !== undefined && !frame.options.manufacturers.some(row => row.id === draft.manufacturerId) || draft.packaging !== undefined && !frame.options.packaging.includes(draft.packaging) || draft.attributes.some(choice => !frame.options.attributes.some(row => row.code === choice.code && row.values.some(value => Object.is(value,choice.value))));
      if (missing) { publish({ ...state, issue: "missing" }); return; }
      if (!searchCatalogSchema.shape.brandId.safeParse(result.brandId).success || !searchCatalogSchema.shape.manufacturerId.safeParse(result.manufacturerId).success || !searchCatalogSchema.shape.packaging.safeParse(result.packaging).success || !searchCatalogSchema.shape.attributeFilters.safeParse(result.attributeFilters).success || !searchCatalogSchema.shape.sort.safeParse(result.sort).success) { publish({ ...state, issue: "input" }); return; }
      if (!live(frame)) return; applications.set(result,frame); return result;
    },
    take(page: CatalogSearchResponse, values: CatalogCommercialValues, context: CatalogFilterContext) { const frame = applications.get(values); if (!frame || frame.page !== page || frame.key !== catalogFilterContextKey(context) || !live(frame) || !unchangedOptions(frame) || state.phase !== "ready" || JSON.stringify(wire(state.draft)) !== JSON.stringify(values)) return false; applications.delete(values); return true; },
    referenceAllowed(page: CatalogSearchResponse, field: "categoryId" | "supplierOrganizationId", row: CatalogReferenceRow | undefined, context: CatalogFilterContext) {
      if (state.phase !== "ready") return false; const frame = state.frame;
      if (frame.page !== page || frame.key !== catalogFilterContextKey(context) || !live(frame) || !unchangedOptions(frame)) return false;
      if (row === undefined) return true;
      if (field === "categoryId") return frame.options.categories.some(candidate => candidate === row) && selectableCatalogCategory(frame.options.categories,row as CatalogOptions["categories"][number]);
      return field === "supplierOrganizationId" && frame.options.suppliers.some(candidate => candidate === row);
    },
    referenceLabel(field: "categoryId" | "supplierOrganizationId", id: string | undefined) { return supported() && id !== undefined ? labels.get(`${field === "categoryId" ? "category" : "supplier"}:${id}`) : undefined; },
    referenceGroup(frame: CatalogCommercialFrame, group: CatalogReferenceGroup) { if (!live(frame) || !referenceGroups.includes(group)) return; referenceView = freeze({ ...referenceView, group }); publish({ ...state }); },
    referenceSearch(frame: CatalogCommercialFrame, group: CatalogReferenceGroup, value: string) {
      if (!live(frame) || !referenceGroups.includes(group) || typeof value !== "string" || value.length > 240) return;
      const previous = referenceView.selections[group]; referenceView = freeze({ ...referenceView, searches: { ...referenceView.searches, [group]: value }, pages: { ...referenceView.pages, [group]: 0 }, ...(previous ? { selections: { ...referenceView.selections, [group]: { start: Math.min(previous.start,value.length), end: Math.min(previous.end,value.length) } } } : {}) }); publish({ ...state });
    },
    referenceSelection(frame: CatalogCommercialFrame, group: CatalogReferenceGroup, value: Readonly<{ start: number; end: number }>) {
      if (!live(frame) || !referenceGroups.includes(group) || !Number.isSafeInteger(value.start) || !Number.isSafeInteger(value.end) || value.start < 0 || value.end < value.start || value.end > referenceView.searches[group].length) return;
      const previous = referenceView.selections[group]; if (previous?.start === value.start && previous.end === value.end) return;
      referenceView = freeze({ ...referenceView, selections: { ...referenceView.selections, [group]: { start: value.start, end: value.end } } }); publish({ ...state });
    },
    referencePage(frame: CatalogCommercialFrame, group: CatalogReferenceGroup, value: number) { if (!live(frame) || !referenceGroups.includes(group) || !Number.isSafeInteger(value) || value < 0 || value > 10000) return; referenceView = freeze({ ...referenceView, pages: { ...referenceView.pages, [group]: value } }); publish({ ...state }); },
    describe(values: CatalogCommercialValues): readonly CatalogCommercialLabel[] {
      if (!supported()) return [];
      const draft = fromApplied(values), rows: CatalogCommercialLabel[] = [];
      if (draft.brandId !== undefined) rows.push({ kind: "brand", name: labels.get(`brand:${draft.brandId}`) });
      if (draft.manufacturerId !== undefined) rows.push({ kind: "manufacturer", name: labels.get(`manufacturer:${draft.manufacturerId}`) });
      if (draft.packaging !== undefined) rows.push({ kind: "packaging", name: draft.packaging });
      for (const choice of draft.attributes) rows.push({ kind: "attribute", name: labels.get(`attribute:${choice.code}`), value: choice.value });
      if (draft.stock) rows.push({ kind: "stock" }); if (draft.sort !== "RELEVANCE") rows.push({ kind: "sort", sort: draft.sort }); return rows;
    },
    draftValues(): CatalogCommercialValues { return state.phase === "ready" ? wire(state.draft) : Object.freeze({}); },
    clearAll() { referenceView = blankReference(); applications = new WeakMap(); slots.clear(); labels.clear(); lastPage = undefined; lastSignature = undefined; publish({ phase: "idle" }); },
    sync() { if (lastPage && !owns(lastPage)) { lastPage = undefined; lastSignature = undefined; publish({ phase: "idle" }); } },
    activate() { active = true; },
    close() { active = false; referenceView = blankReference(); applications = new WeakMap(); slots.clear(); labels.clear(); lastPage = undefined; lastSignature = undefined; state = Object.freeze({ phase: "idle", referenceView }); listeners.forEach(listener => listener()); listeners.clear(); },
  }; return model;
}
export type CatalogCommercialFilters = ReturnType<typeof createCatalogCommercialFilters>;
