import { ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { AiAssistantService } from "./ai-assistant.service";
import { AiSafetyService } from "./ai-safety.service";
import { AiToolsService } from "./ai-tools.service";

function setup() {
  const context = { actorId: "actor", organizationId: "org" };
  const conversation = { id: "conversation", userId: "actor", organizationId: "org", role: "BUYER", status: "ACTIVE" };
  const execution = { id: "execution", conversationId: conversation.id, userId: "actor", organizationId: "org", status: "AWAITING_CONFIRMATION", requiresConfirmation: true, toolName: "create_support_ticket", input: { description: "Помогите с заказом", subject: "Помощь", category: "AI_ASSISTED" } };
  const prisma = {
    aiConversation: {
      findFirst: vi.fn(async ({ where }) => where.organizationId === context.organizationId && where.userId === context.actorId ? conversation : null),
      update: vi.fn().mockResolvedValue(conversation),
    },
    aiMessage: { create: vi.fn(async ({ data }) => ({ id: "message", ...data })) },
    aiToolExecution: {
      findFirst: vi.fn(async ({ where }) => Object.entries(where).every(([key, value]) => execution[key as keyof typeof execution] === value) ? { ...execution } : null),
      create: vi.fn(async ({ data }) => ({ id: "execution", ...data })),
      updateMany: vi.fn(async ({ where, data }) => {
        if (!Object.entries(where).every(([key, value]) => execution[key as keyof typeof execution] === value)) return { count: 0 };
        Object.assign(execution, data);
        return { count: 1 };
      }),
      update: vi.fn(async ({ data }) => Object.assign(execution, data)),
    },
    $transaction: vi.fn(async (callback: (tx: unknown) => unknown) => callback(prisma)),
  };
  const authority = { assertAiRole: vi.fn().mockResolvedValue(undefined) };
  const tools = {
    plan: new AiToolsService({} as never, {} as never).plan,
    assertAuthorized: vi.fn().mockResolvedValue(undefined),
    execute: vi.fn().mockResolvedValue({ number: "SUP-TEST", count: 1 }),
    json: (value: unknown) => value,
  };
  const openai = { summarize: vi.fn().mockResolvedValue(null) };
  const entitlements = { resolve: vi.fn().mockResolvedValue({ enabled: true }) };
  const service = new AiAssistantService(prisma as never, entitlements as never, new AiSafetyService(), tools as never, openai as never, authority as never);
  const confirm = () => service.send(conversation.id, { content: "Да", confirmedToolExecutionId: execution.id }, context);
  return { service, prisma, context, execution, tools, openai, authority, entitlements, confirm };
}

describe("AI confidentiality and confirmation", () => {
  it("redacts before persistence, planning, and summarization; retains normal text", async () => {
    const f = setup();
    await f.service.send("conversation", { content: "Маски token=SYNTHETIC_PRIVATE_VALUE" }, f.context);
    const writes = JSON.stringify(f.prisma.aiMessage.create.mock.calls) + JSON.stringify(f.prisma.aiToolExecution.create.mock.calls);
    expect(writes).not.toContain("SYNTHETIC_PRIVATE_VALUE");
    expect(f.openai.summarize.mock.calls[0][0].question).toBe("Маски [REDACTED]");
    expect(f.tools.execute.mock.calls[0][0].input.query).toContain("Маски");
  });

  it("does not put raw secrets into a pending support action", async () => {
    const f = setup();
    await f.service.send("conversation", { content: 'Создай обращение: api_key="SYNTHETIC_PRIVATE_VALUE"' }, f.context);
    expect(JSON.stringify(f.prisma.aiToolExecution.create.mock.calls)).not.toContain("SYNTHETIC_PRIVATE_VALUE");
    expect(f.tools.execute).not.toHaveBeenCalled();
    expect(f.openai.summarize).not.toHaveBeenCalled();
  });

  it("sanitizes legacy pending inputs and tool output including nested credentials", async () => {
    const f = setup();
    f.execution.input.description = "token=LEGACY_PRIVATE_VALUE";
    f.tools.execute.mockResolvedValue({ number: "SUP-TEST", nested: [{ access_token: "NESTED_PRIVATE_VALUE", lastError: "password=ERROR_PRIVATE_VALUE" }] } as never);
    const response = await f.confirm();
    expect(JSON.stringify(f.tools.execute.mock.calls)).not.toContain("LEGACY_PRIVATE_VALUE");
    expect(JSON.stringify(response)).not.toContain("PRIVATE_VALUE");
    expect(JSON.stringify(f.openai.summarize.mock.calls)).not.toContain("PRIVATE_VALUE");
  });

  it("allows exactly one concurrent confirmation and rejects later replay", async () => {
    const f = setup();
    let release!: () => void;
    const bothRead = new Promise<void>(resolve => { release = resolve; });
    let count = 0;
    f.tools.assertAuthorized.mockImplementation(async () => { if (++count === 2) release(); await bothRead; });
    const outcomes = await Promise.allSettled([f.confirm(), f.confirm()]);
    expect(outcomes.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter(result => result.status === "rejected")).toHaveLength(1);
    expect(f.tools.execute).toHaveBeenCalledTimes(1);
    expect(f.execution.status).toBe("SUCCEEDED");
    await expect(f.confirm()).rejects.toThrow("Pending AI action not found");
    expect(f.tools.execute).toHaveBeenCalledTimes(1);
  });

  it("never executes or claims after permission denial", async () => {
    const f = setup();
    f.tools.assertAuthorized.mockRejectedValue(new ForbiddenException("denied"));
    await expect(f.confirm()).rejects.toThrow("denied");
    expect(f.prisma.aiToolExecution.updateMany).not.toHaveBeenCalled();
    expect(f.tools.execute).not.toHaveBeenCalled();
  });

  it.each(["organizationId", "userId"])("rejects a foreign pending execution by %s", async key => {
    const f = setup();
    f.execution[key as "organizationId" | "userId"] = "foreign";
    await expect(f.confirm()).rejects.toThrow("Pending AI action not found");
    expect(f.tools.execute).not.toHaveBeenCalled();
  });

  it("does not repeat a tool after completion persistence fails", async () => {
    const f = setup();
    f.prisma.$transaction.mockRejectedValueOnce(new Error("token=FAILURE_PRIVATE_VALUE"));
    await expect(f.confirm()).rejects.toThrow();
    expect(f.execution.status).toBe("FAILED");
    expect(JSON.stringify(f.prisma.aiToolExecution.update.mock.calls)).not.toContain("FAILURE_PRIVATE_VALUE");
    await expect(f.confirm()).rejects.toThrow("Pending AI action not found");
    expect(f.tools.execute).toHaveBeenCalledTimes(1);
  });

  it("keeps deterministic success when the model is unavailable", async () => {
    const f = setup();
    f.openai.summarize.mockRejectedValue(new Error("provider unavailable"));
    const response = await f.confirm();
    expect(response.message.content).toContain("SUP-TEST");
    expect(f.execution.status).toBe("SUCCEEDED");
  });
});
