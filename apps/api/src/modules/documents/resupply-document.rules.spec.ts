import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { resupplyDocumentSnapshot, resupplyPreviewCurrent, resupplyDocumentText } from "./resupply-document.rules";
import { resupplyDocumentFixture, rdId } from "./resupply-document.test-fixture";
const actor = { id: rdId(91), name: "Сотрудник" };
describe("working resupply document rules", () => {
  it("preserves 10/8/2 and original without issuing or signing anything", () => {
    const f = resupplyDocumentFixture(), before = JSON.stringify(f);
    const s = resupplyDocumentSnapshot(f, "SETTLEMENT", 1, actor);
    expect(s.lines[0]).toMatchObject({ originalQuantity: "10", originalReceivedQuantity: "8", resupplyQuantity: "2", receivedQuantity: "2" });
    expect(resupplyDocumentText(s)).toContain("ФОРМА НЕ УТВЕРЖДЕНА");
    expect(resupplyPreviewCurrent(s, f)).toBe(true);
    expect(JSON.stringify(f)).toBe(before);
  });
  it("allows transfer draft before receipt but denies premature settlement", () => {
    const f = resupplyDocumentFixture(); f.shipment.resupplyShipment!.status = "DISPATCHED";
    f.shipment.resupplyShipment!.items[0].deliveredQuantity = new Prisma.Decimal(0);
    expect(resupplyDocumentSnapshot(f, "TRANSFER", 1, actor).kind).toBe("TRANSFER");
    expect(() => resupplyDocumentSnapshot(f, "SETTLEMENT", 1, actor)).toThrow("полного получения");
  });
  it("rejects foreign replacement, changed original and non-agreed resolution", () => {
    const f = resupplyDocumentFixture(); f.shipment.resupplyShipment!.resupplyDiscrepancyId = rdId(99);
    expect(() => resupplyDocumentSnapshot(f, "TRANSFER", 1, actor)).toThrow("связанную");
    f.shipment.resupplyShipment!.resupplyDiscrepancyId = f.id;
    f.shipment.items[0].deliveredQuantity = new Prisma.Decimal(10);
    expect(() => resupplyDocumentSnapshot(f, "TRANSFER", 1, actor)).toThrow("Исходные количества");
    f.shipment.items[0].deliveredQuantity = new Prisma.Decimal(8); f.status = "REJECTED";
    expect(() => resupplyDocumentSnapshot(f, "TRANSFER", 1, actor)).toThrow("согласованная");
  });
  it("marks prior snapshots stale after receipt/version changes", () => {
    const f = resupplyDocumentFixture(), s = resupplyDocumentSnapshot(f, "TRANSFER", 1, actor);
    f.shipment.resupplyShipment!.version++;
    expect(resupplyPreviewCurrent(s, f)).toBe(false);
  });
});
