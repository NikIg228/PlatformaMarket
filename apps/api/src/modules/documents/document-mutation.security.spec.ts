import { describe, expect, it, vi } from "vitest";
import { DocumentsService } from "./documents.service";

describe("document read versus lifecycle authority", () => {
  function fixture(organizationId: string, operator = false) {
    const update = vi.fn().mockResolvedValue({ status: "ARCHIVED" });
    const create = vi.fn();
    const service = new DocumentsService({ organizationCapability: { findUnique: vi.fn().mockResolvedValue(operator ? {} : null) },
      document: { update, create }, auditLog: { create: vi.fn() } } as never, {} as never, {} as never, {} as never, {} as never);
    vi.spyOn(service, "get").mockResolvedValue({ id: "doc", ownerOrganizationId: "owner", status: "GENERATED", source: "UPLOADED" } as never);
    return { service, update, create, context: { actorId: "actor", organizationId } };
  }
  it("denies a participant both archive and version before mutation/rendering", async () => {
    const f = fixture("recipient");
    await expect(f.service.archive("doc", f.context)).rejects.toThrow(/owner/);
    await expect(f.service.createVersion("doc", { data: {}, reason: "new" }, f.context)).rejects.toThrow(/owner/);
    expect(f.update).not.toHaveBeenCalled(); expect(f.create).not.toHaveBeenCalled();
  });
  it.each([["owner", false], ["operator", true]] as const)("preserves authorized lifecycle actions for %s", async (org, operator) => {
    const f = fixture(org, operator);
    await expect(f.service.archive("doc", f.context)).resolves.toMatchObject({ status: "ARCHIVED" });
    await expect(f.service.createVersion("doc", { data: {}, reason: "new" }, f.context)).rejects.toThrow("Only generated");
    expect(f.update).toHaveBeenCalledTimes(1);
  });
});
