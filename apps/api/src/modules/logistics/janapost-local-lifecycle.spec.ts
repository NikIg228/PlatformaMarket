import { describe, expect, it, vi } from "vitest";
import { JanaPostLocalLifecycle, type JanaPostLocalTracking } from "./janapost-local-lifecycle";

function scenario() {
  const shipments = new Map<string, JanaPostLocalTracking>();
  let visible = true;
  const fixtureLabel = Buffer.from("%PDF-1.4\nsynthetic label bytes\n");
  const carrier = {
    create: vi.fn(async ({ mailNo }: { mailNo: string }) => { shipments.set(mailNo, "CREATED"); }),
    track: vi.fn(async (mailNo: string) => visible ? shipments.get(mailNo) ?? null : null),
    label: vi.fn(async (mailNo: string) => {
      if (!shipments.has(mailNo)) throw new Error("Shipment does not exist at carrier");
      return Buffer.from(fixtureLabel);
    }),
  };
  return {
    carrier, shipments, fixtureLabel,
    lifecycle: new JanaPostLocalLifecycle(carrier),
    setVisible: (value: boolean) => { visible = value; },
  };
}

describe("JanaPost local shipment lifecycle", () => {
  it("reconciles an accepted request after a timeout and temporary tracking lag", async () => {
    const { carrier, shipments, lifecycle, setVisible, fixtureLabel } = scenario();
    carrier.create.mockImplementationOnce(async ({ mailNo }) => {
      shipments.set(mailNo, "CREATED");
      throw new Error("The response was lost");
    });
    setVisible(false);
    await expect(lifecycle.create("shipment", "DEMO-JP-001", "DEMO-ALA-01")).resolves.toMatchObject({ creation: "unknown" });
    await expect(lifecycle.label("shipment")).rejects.toThrow("Confirm the shipment");
    expect(carrier.label).not.toHaveBeenCalled();
    await expect(lifecycle.refresh("shipment")).resolves.toMatchObject({ creation: "unknown" });
    await lifecycle.create("shipment", "DEMO-JP-001", "DEMO-ALA-01");

    setVisible(true);
    await expect(lifecycle.refresh("shipment")).resolves.toMatchObject({ creation: "confirmed", tracking: "CREATED" });
    expect(carrier.track.mock.calls).toEqual([["DEMO-JP-001"], ["DEMO-JP-001"]]);
    expect(carrier.create).toHaveBeenCalledTimes(1);
    expect(shipments.size).toBe(1);
    await expect(lifecycle.label("shipment")).resolves.toEqual(fixtureLabel);
    await expect(lifecycle.label("shipment")).resolves.toEqual(fixtureLabel);
    expect(carrier.label.mock.calls).toEqual([["DEMO-JP-001"], ["DEMO-JP-001"]]);
    expect(carrier.create).toHaveBeenCalledTimes(1);
  });

  it("rejects conflicting details and keeps concurrent requests on the same attempt", async () => {
    const { carrier, lifecycle } = scenario();
    const first = lifecycle.create("shipment", "DEMO-JP-001", "DEMO-ALA-01");
    await expect(lifecycle.create("shipment", "DEMO-JP-001", "DEMO-ALA-01")).resolves.toMatchObject({ creation: "pending" });
    await expect(first).resolves.toMatchObject({ creation: "confirmed" });
    await expect(lifecycle.create("shipment", "DEMO-JP-002", "DEMO-ALA-01")).rejects.toThrow("different shipment details");
    await expect(lifecycle.create("other", "DEMO-JP-001", "DEMO-ALA-01")).rejects.toThrow("another shipment");
    expect(carrier.create).toHaveBeenCalledTimes(1);
  });

  it("updates carrier tracking without returning Market receipt or payment state", async () => {
    const { lifecycle, shipments } = scenario();
    await lifecycle.create("shipment", "DEMO-JP-001", "DEMO-ALA-01");
    shipments.set("DEMO-JP-001", "arrival_branch");
    await expect(lifecycle.refresh("shipment")).resolves.toMatchObject({ tracking: "arrival_branch" });
    shipments.set("DEMO-JP-001", "delivered");
    await expect(lifecycle.refresh("shipment")).resolves.toEqual({
      mailNo: "DEMO-JP-001", stationCode: "DEMO-ALA-01", creation: "confirmed", tracking: "delivered",
    });
  });
});
