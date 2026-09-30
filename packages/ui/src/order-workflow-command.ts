import type { OrderWorkflowCommand } from "@marketplace/schemas";

export type WorkflowAction = OrderWorkflowCommand extends infer T ? T extends OrderWorkflowCommand ? Omit<T, "expectedVersion" | "idempotencyKey"> : never : never;

/** Retain the exact command while its write outcome is unknown. */
export class WorkflowCommandTracker {
  private pending: { signature: string; command: OrderWorkflowCommand } | null = null;
  constructor(private readonly key = () => crypto.randomUUID()) {}

  command(action: WorkflowAction, version: number) {
    const signature = JSON.stringify(action);
    if (this.pending && this.pending.signature !== signature)
      throw new Error("Результат предыдущего действия неизвестен. Сначала повторите его с прежними данными.");
    this.pending ??= { signature, command: { ...action, expectedVersion: version, idempotencyKey: this.key() } as OrderWorkflowCommand };
    return this.pending.command;
  }

  succeeded() { this.pending = null; }

  rejected(error: unknown) {
    const status = error && typeof error === "object" && "status" in error ? error.status : undefined;
    // A transactional 4xx proves rejection. Network errors and 5xx cannot
    // prove whether a write committed, so preserve both version and key.
    if (typeof status === "number" && status >= 400 && status < 500 && status !== 408) this.pending = null;
    return status === 409;
  }
}
