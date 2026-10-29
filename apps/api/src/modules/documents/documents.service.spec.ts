import { describe, expect, it, vi } from "vitest";
import { DocumentsService } from "./documents.service";

describe("DocumentsService signature status", () => {
  it("does not sign or regenerate a shipment preview through generic document endpoints", async () => {
    const service = new DocumentsService({} as never, {} as never, {} as never, {} as never, {} as never);
    vi.spyOn(service, "get").mockResolvedValue({ ownerOrganizationId: "org", externalId: "WAYBILL_PREVIEW:test", source: "GENERATED", status: "DRAFT" } as never);
    await expect(service.createSignatureSession("draft", { method: "EDS", expiresInMinutes: 60 }, { actorId: "actor", organizationId: "org" })).rejects.toThrow("ещё недоступно");
    await expect(service.createVersion("draft", { reason: "change", data: {} }, { actorId: "actor", organizationId: "org" })).rejects.toThrow("актуальной партии");
  });
  it("does not let a stale partial refresh regress a signed document", async () => {
    const prisma = {
      document: {
        findUniqueOrThrow: vi.fn()
          .mockResolvedValueOnce({ id: "document", immutableAt: null, requiredSignatureCount: 2, signatures: [{ status: "SIGNED" }] })
          .mockResolvedValueOnce({ id: "document", status: "SIGNED" }),
        updateMany: vi.fn(async () => ({ count: 0 })),
      },
    };
    const service = new DocumentsService(prisma as never, {} as never, {} as never, {} as never, {} as never);

    const result = await (service as any).refreshDocumentSignatureStatus("document");

    expect(prisma.document.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "document", status: { not: "SIGNED" } } }));
    expect(result.status).toBe("SIGNED");
  });

  it("rejects a local EDS signer from another organization", async () => {
    const service = new DocumentsService({} as never, {} as never, {} as never, {} as never, {} as never);
    vi.spyOn(service, "get").mockResolvedValue({
      id: "document",
      checksumSha256: "a".repeat(64),
      storageKey: "documents/document.pdf",
      status: "GENERATED",
    } as never);
    vi.spyOn(service as any, "isOperator").mockResolvedValue(false);

    await expect(service.createLocalEdsSignatureSession("document", {
      method: "EDS",
      signerOrganizationId: "organization-b",
      signerUserId: "user-a",
      signerName: "Signer",
      expiresInMinutes: 60,
    }, { actorId: "user-a", organizationId: "organization-a" })).rejects.toThrow("Signer organization must be the active organization");
  });

  it("rejects a local EDS session created for another user", async () => {
    const service = new DocumentsService({} as never, {} as never, {} as never, {} as never, {} as never);
    vi.spyOn(service, "get").mockResolvedValue({
      id: "document",
      checksumSha256: "a".repeat(64),
      storageKey: "documents/document.pdf",
      status: "GENERATED",
    } as never);
    vi.spyOn(service as any, "isOperator").mockResolvedValue(false);

    await expect(service.createLocalEdsSignatureSession("document", {
      method: "EDS",
      signerOrganizationId: "organization-a",
      signerUserId: "user-b",
      signerName: "Signer",
      expiresInMinutes: 60,
    }, { actorId: "user-a", organizationId: "organization-a" })).rejects.toThrow("Signer user must be the authenticated user");
  });
});

describe("DocumentsService archive", () => {
  it("allows an agreement participant to read a supplier-owned document", async () => {
    const prisma = {
      document: { findUnique: vi.fn().mockResolvedValue({
        id: "document",
        ownerOrganizationId: "supplier",
        participants: [{ organizationId: "buyer", role: "RECIPIENT" }],
        supplierOrder: null,
        buyerSupplierAgreement: null,
        marketplaceAgreement: null,
      }) },
    };
    const service = new DocumentsService(prisma as never, {} as never, {} as never, {} as never, {} as never);

    const result = await service.get("document", { actorId: "buyer-user", organizationId: "buyer" });

    expect(result.id).toBe("document");
  });

  it("applies the tenant graph to archive queries", async () => {
    const prisma = {
      organizationCapability: { findUnique: vi.fn().mockResolvedValue(null) },
      document: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const service = new DocumentsService(prisma as never, {} as never, {} as never, {} as never, {} as never);

    await service.listArchive({ limit: 25 }, { actorId: "buyer-user", organizationId: "buyer" });

    expect(prisma.document.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { AND: [expect.objectContaining({ OR: expect.arrayContaining([
        { ownerOrganizationId: "buyer" },
        { participants: { some: { organizationId: "buyer" } } },
      ]) }), expect.any(Object), expect.any(Object)] },
      take: 26,
    }));
  });

  it.each([
    ["AWAITING_SIGNATURE", { OR: [{ status: "AWAITING_SIGNATURE" }, { status: "PARTIALLY_SIGNED" }] }],
    ["ATTENTION", { OR: [{ status: { in: ["FAILED", "REJECTED", "EXPIRED"] } }, { accountingStatus: { in: ["PENDING_REVIEW", "DISPUTED"] } }] }],
    ["ARCHIVED", { status: "ARCHIVED" }],
  ] as const)("intersects %s with tenant access, search and cursor", async (view, expected) => {
    const findMany = vi.fn().mockResolvedValue([]);
    const service = new DocumentsService({ organizationCapability: { findUnique: vi.fn().mockResolvedValue(null) }, document: { findMany } } as never, {} as never, {} as never, {} as never, {} as never);
    await service.listArchive({ view, q: "invoice", counterpartyOrganizationId: "supplier", cursor: "cursor", limit: 25 }, { actorId: "buyer-user", organizationId: "buyer" });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { AND: [expect.objectContaining({ OR: expect.arrayContaining([{ ownerOrganizationId: "buyer" }]) }), expected, expect.objectContaining({
        participants: { some: { organizationId: "supplier" } }, OR: expect.any(Array),
      })] }, cursor: { id: "cursor" }, skip: 1, take: 26,
    }));
  });

  it("does not create payment evidence before payment is confirmed", async () => {
    const prisma = {
      supplierOrder: { findUnique: vi.fn().mockResolvedValue({
        supplierOrganizationId: "supplier",
        buyerOrganizationId: "buyer",
        checkoutId: "checkout",
        paymentStatus: "UNPAID",
      }) },
    };
    const service = new DocumentsService(prisma as never, {} as never, {} as never, {} as never, {} as never);

    await expect((service as any).assertReferences({
      ownerOrganizationId: "supplier",
      kind: "PAYMENT_CONFIRMATION",
      supplierOrderId: "order",
    })).rejects.toThrow("Payment confirmation requires a confirmed payment event");
  });

  it("does not expose a checkout-level document to every supplier in a multi-supplier checkout", async () => {
    const prisma = {
      checkout: { findUnique: vi.fn().mockResolvedValue({ buyerOrganizationId: "buyer" }) },
    };
    const service = new DocumentsService(prisma as never, {} as never, {} as never, {} as never, {} as never);

    const parties = await (service as any).assertReferences({
      ownerOrganizationId: "buyer",
      kind: "OTHER",
      checkoutId: "checkout",
    });

    expect(parties).toEqual([{ organizationId: "buyer", role: "RECIPIENT" }]);
  });

  it("uses optimistic locking for an accounting decision", async () => {
    const prisma = {
      document: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
    };
    const service = new DocumentsService(prisma as never, {} as never, {} as never, {} as never, {} as never);
    vi.spyOn(service, "getArchive").mockResolvedValue({
      id: "document",
      category: "PAYMENT",
      accountingStatus: "PENDING_REVIEW",
      updatedAt: "2026-09-06T12:00:00.000Z",
    } as never);

    await expect(service.updateAccountingStatus("document", {
      status: "REVIEWED",
      reason: "Проверено бухгалтером",
      expectedUpdatedAt: "2026-09-06T12:00:00.000Z",
    }, { actorId: "buyer-user", organizationId: "buyer" })).rejects.toThrow("Document was changed by another user");
  });
});


describe("DocumentsService signature completion ownership", () => {
  it.each([
    [{ actorId: "other-user", organizationId: "signer-org" }, "Signer user must be the authenticated user"],
    [{ actorId: "signer-user", organizationId: "other-org" }, "Signer organization must be the active organization"],
  ])("rejects a readable document's signature owned by another actor: %j", async (context, message) => {
    const signature = { id: "signature", documentId: "document", signerOrganizationId: "signer-org", signerUserId: "signer-user", method: "MOCK", status: "SESSION_CREATED", document: { checksumSha256: "a".repeat(64), ownerOrganizationId: "signer-org" } };
    const prisma = {
      documentSignature: { findUnique: vi.fn().mockResolvedValue(signature), updateMany: vi.fn().mockResolvedValue({ count: 1 }), findUniqueOrThrow: vi.fn().mockResolvedValue({ ...signature, status: "REJECTED" }) },
      document: { update: vi.fn().mockResolvedValue({ id: "document", status: "REJECTED" }) },
      auditLog: { create: vi.fn() }, outboxEvent: { create: vi.fn() }, $transaction: vi.fn(),
    };
    const service = new DocumentsService(prisma as never, {} as never, {} as never, {} as never, {} as never);
    vi.spyOn(service, "get").mockResolvedValue({ id: "document" } as never);
    await expect(service.completeSignature("signature", { status: "REJECTED" }, context)).rejects.toThrow(message);
    expect(prisma.documentSignature.updateMany).not.toHaveBeenCalled();
  });
});


describe("agreement documents require the actual signing parties", () => {
  it.each(["marketplace", "buyer-supplier"])("does not count duplicate/foreign/mock signatures as the missing %s party", async kind => {
    const signatures = [
      { status: "SIGNED", method: "EDS", signerOrganizationId: "supplier" },
      { status: "SIGNED", method: "EDS", signerOrganizationId: "supplier" },
      { status: "SIGNED", method: "EDS", signerOrganizationId: "outsider" },
      { status: "SIGNED", method: "MOCK", signerOrganizationId: "counterparty" },
    ];
    const prisma = { document: {
      findUniqueOrThrow: vi.fn().mockResolvedValue({ id: "document", requiredSignatureCount: 2, immutableAt: null, signatures,
        marketplaceAgreement: kind === "marketplace" ? { supplierOrganizationId: "supplier", operatorOrganizationId: "counterparty" } : null,
        buyerSupplierAgreement: kind === "buyer-supplier" ? { supplierOrganizationId: "supplier", buyerOrganizationId: "counterparty" } : null }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    } };
    const service = new DocumentsService(prisma as never, {} as never, {} as never, {} as never, {} as never);
    await (service as any).refreshDocumentSignatureStatus("document");
    expect(prisma.document.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "PARTIALLY_SIGNED" }) }));
    signatures.push({ status: "SIGNED", method: "EDS", signerOrganizationId: "counterparty" });
    await (service as any).refreshDocumentSignatureStatus("document");
    expect(prisma.document.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "SIGNED" }) }));
  });
});


describe("signature session actor binding", () => {
  function fixture() {
    const prisma = {
      documentSignature: { create: vi.fn(async ({ data }) => ({ id: "session", ...data })) },
      document: { update: vi.fn().mockResolvedValue({ id: "document", status: "AWAITING_SIGNATURE" }) },
      auditLog: { create: vi.fn() },
    };
    const registry = { resolve: vi.fn().mockReturnValue({ createSession: vi.fn().mockResolvedValue({ status: "SESSION_CREATED", externalSessionId: "external", signingUrl: null }) }) };
    const service = new DocumentsService(prisma as never, {} as never, {} as never, registry as never, {} as never);
    const document = { id: "document", checksumSha256: "a".repeat(64), storageKey: "document.pdf", status: "GENERATED", marketplaceAgreement: null, buyerSupplierAgreement: null };
    vi.spyOn(service, "get").mockResolvedValue(document as never);
    return { service, prisma, document };
  }
  it.each([false, true])("binds omitted signer fields to the authenticated actor, local EDS=%s", async local => {
    const { service, prisma } = fixture();
    const context = { actorId: "actor", organizationId: "org" };
    if (local) await service.createLocalEdsSignatureSession("document", { method: "EDS", expiresInMinutes: 60 }, context);
    else await service.createSignatureSession("document", { method: "MOCK", expiresInMinutes: 60 }, context);
    expect(prisma.documentSignature.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ signerOrganizationId: "org", signerUserId: "actor" }) }));
  });
  it.each([false, true])("rejects impersonation even with document read access, local EDS=%s", async local => {
    const { service, prisma } = fixture();
    const context = { actorId: "operator", organizationId: "operator-org" };
    vi.spyOn(service as any, "isOperator").mockResolvedValue(true);
    const input = { signerOrganizationId: "foreign-org", signerUserId: "foreign-user", expiresInMinutes: 60 };
    const promise = local ? service.createLocalEdsSignatureSession("document", { ...input, method: "EDS" }, context) : service.createSignatureSession("document", { ...input, method: "MOCK" }, context);
    await expect(promise).rejects.toThrow("Signer organization must be the active organization");
    expect(prisma.documentSignature.create).not.toHaveBeenCalled();
  });
  it.each([false, true])("does not grant a readable agreement to a non-party signer, local EDS=%s", async local => {
    const { service, prisma, document } = fixture();
    vi.mocked(service.get).mockResolvedValue({ ...document, marketplaceAgreement: { supplierOrganizationId: "supplier", operatorOrganizationId: "operator" } } as never);
    const context = { actorId: "outsider", organizationId: "outsider-org" };
    const promise = local ? service.createLocalEdsSignatureSession("document", { method: "EDS", expiresInMinutes: 60 }, context) : service.createSignatureSession("document", { method: "MOCK", expiresInMinutes: 60 }, context);
    await expect(promise).rejects.toThrow("Only an agreement party can sign it");
    expect(prisma.documentSignature.create).not.toHaveBeenCalled();
  });
  it("allows the recorded signer to reject its session once and refuses replay", async () => {
    const signature = { id: "signature", documentId: "document", signerOrganizationId: "org", signerUserId: "actor", method: "MOCK", status: "SESSION_CREATED", document: { ownerOrganizationId: "org" } };
    const prisma = {
      documentSignature: { findUnique: vi.fn().mockResolvedValue(signature), updateMany: vi.fn().mockResolvedValue({ count: 1 }), findUniqueOrThrow: vi.fn().mockResolvedValue({ ...signature, status: "REJECTED" }) },
      document: { update: vi.fn().mockResolvedValue({ id: "document", status: "REJECTED" }) },
      auditLog: { create: vi.fn() }, outboxEvent: { create: vi.fn() }, $transaction: vi.fn(),
    };
    const service = new DocumentsService(prisma as never, {} as never, {} as never, {} as never, {} as never);
    vi.spyOn(service, "get").mockResolvedValue({ id: "document" } as never);
    const context = { actorId: "actor", organizationId: "org" };
    await expect(service.completeSignature("signature", { status: "REJECTED" }, context)).resolves.toMatchObject({ signature: { status: "REJECTED" } });
    signature.status = "REJECTED";
    await expect(service.completeSignature("signature", { status: "REJECTED" }, context)).rejects.toThrow("Signature session is already final");
    expect(prisma.documentSignature.updateMany).toHaveBeenCalledTimes(1);
  });
});
