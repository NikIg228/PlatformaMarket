import { describe, expect, it, vi } from "vitest";
import { janaPostLocalResultSchema } from "@marketplace/schemas";
import type { ClientTransport } from "../transport-contract";
import { lookupJanaPostLocal } from "./janapost-local";

describe("JanaPost local client", () => {
  it("requests the selected city within the order route and accepts an empty result", async () => {
    const fixture = { points: [], tracking: { number: "DEMO-JP-001", status: "arrival_branch" } };
    const get = vi.fn().mockResolvedValue(fixture);
    const result = await lookupJanaPostLocal({ get } as unknown as ClientTransport, "order/id", "shymkent");
    expect(get).toHaveBeenCalledWith("/supplier-orders/order%2Fid/janapost-local?city=shymkent");
    expect(janaPostLocalResultSchema.parse(result)).toEqual(fixture);
  });
});
