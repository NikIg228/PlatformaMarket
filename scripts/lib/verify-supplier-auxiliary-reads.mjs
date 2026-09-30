import { workspaceCorrectionOfferPageSchema, workspaceInventoryPageSchema, workspaceLotPageSchema, workspaceReservationPageSchema, workspaceOverridePageSchema } from "@marketplace/schemas";

export async function verifySupplierAuxiliaryReads({ prisma, supplierId, full, limited, foreign, request, assert }) {
  const definitions = [
    ["correction-offers", workspaceCorrectionOfferPageSchema, "supplierOffer"],
    ["inventory", workspaceInventoryPageSchema, "inventoryBalance"],
    ["inventory-overrides", workspaceOverridePageSchema, "dataOverride"],
  ];
  const capability = await prisma.organizationCapability.create({ data: { organizationId: foreign.organizationId, capability: "SUPPLIER" } });
  try {
    for (const [name, schema, model] of definitions) {
      const route = `/workspaces/supplier/${name}`;
      const expected = await prisma[model].findMany({ where: { supplierOrganizationId: supplierId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { id: true } });
      const seen = [];
      let cursor;
      do {
        const result = await request(`${route}?limit=1${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`, { identity: full });
        assert(result.status === 200, `${name}: page failed ${result.status}`);
        const page = schema.parse(result.body);
        assert(page.items.length <= 1, `${name}: page limit escaped`);
        for (const row of result.body.items) {
          assert(!("lots" in row) && !("reservations" in row) && !("inventoryBalances" in row) && !("prices" in row), `${name}: nested collections leaked`);
          seen.push(row.id);
        }
        cursor = page.nextCursor;
        if (cursor) {
          assert((await request(`${route}?limit=1&cursor=${encodeURIComponent(cursor)}`, { identity: foreign })).status === 400, `${name}: foreign cursor accepted`);
          assert((await request(`${route}?limit=1&q=changed&cursor=${encodeURIComponent(cursor)}`, { identity: full })).status === 400, `${name}: changed filter accepted`);
        }
        assert(seen.length <= expected.length, `${name}: cursor repeated rows`);
      } while (cursor);
      assert(JSON.stringify(seen) === JSON.stringify(expected.map(row => row.id)), `${name}: incomplete/unstable paging`);
      assert((await request(`${route}?limit=101`, { identity: full })).status === 400, `${name}: excessive limit accepted`);
      assert((await request(`${route}?cursor=invalid`, { identity: full })).status === 400, `${name}: malformed cursor accepted`);
      const own = await request(route, { identity: foreign });
      assert(own.status === 200 && own.body.items.length === 0, `${name}: foreign data leaked`);
    }
    const balance = await prisma.inventoryBalance.findFirstOrThrow({ where: { supplierOrganizationId: supplierId } });
    for (const [name, schema] of [["lots", workspaceLotPageSchema], ["reservations", workspaceReservationPageSchema]]) {
      const route = `/workspaces/supplier/inventory/${balance.id}/${name}`;
      const result = await request(`${route}?limit=1`, { identity: full });
      assert(result.status === 200, `${name}: read failed`);
      schema.parse(result.body);
      assert(result.body.items.length <= 1, `${name}: unbounded child read`);
      assert((await request(route, { identity: foreign })).status === 404, `${name}: foreign parent disclosed`);
      assert((await request(route, { identity: limited })).status === 403, `${name}: permission check bypassed`);
    }
    const legacy = await request(`/suppliers/${supplierId}/inventory/balances`, { identity: full });
    const bounded = await request("/workspaces/supplier/inventory?limit=1", { identity: full });
    console.log(`Supplier reads PASS: stable pages, contracts, tenant/cursor/permission isolation; fixture inventory bytes legacy=${Buffer.byteLength(JSON.stringify(legacy.body))}, page(1)=${Buffer.byteLength(JSON.stringify(bounded.body))}`);
  } finally {
    await prisma.organizationCapability.delete({ where: { id: capability.id } });
  }
}
