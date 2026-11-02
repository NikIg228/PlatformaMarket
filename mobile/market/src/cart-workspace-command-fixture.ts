import { nativeCartAvailable, type NativeCartCommands } from "./native-cart-commands";
import { createCartSchema, recoverCartSchema } from "../../../packages/schemas/src/index";
import { cartResponseSchema, errorResponseSchema, type CartResponse } from "../../../packages/schemas/src/core-api";
import type { WorkspaceCartPage } from "../../../packages/schemas/src/workspace-reads";
import { authorizedCartFixture, decodeCommandCart, type CartCommandFixture, type CartCreateInput, type CartVersionInput } from "./cart-command-fixture";
import type { ReadScope } from "./read-controller";

type Phase = "idle" | "prepared" | "pending" | "result" | "unknown" | "rejected" | "reading" | "review" | "read-error" | "observed";
export type CartWorkspaceCommandState = Readonly<{
  phase: Phase;
  operation?: "create" | "recover";
  sourceCartId?: string;
  input?: CartCreateInput | CartVersionInput;
  result?: CartResponse;
  latest?: WorkspaceCartPage;
  priorUnknown?: boolean;
  issue?: "validation" | "authentication" | "denied" | "not-found" | "conflict" | "invalid-result" | "context";
}>;
type Attempt = Readonly<{ page: WorkspaceCartPage; unknownBefore?: boolean } & (
  { kind: "create"; input: CartCreateInput } |
  { kind: "recover"; sourceCartId: string; input: CartVersionInput }
)>;
type Execution = Readonly<{ page: WorkspaceCartPage; source?: CartResponse; sourceId?: string; version?: number; checkoutId?: string; recoveredId?: string | null }>;
const idle: CartWorkspaceCommandState = Object.freeze({ phase: "idle" });
const resultRoot = cartResponseSchema.pick({ id: true, buyerOrganizationId: true }).strip();

export function createCartWorkspaceCommands(
  scope: ReadScope,
  fixture: CartCommandFixture | undefined,
  currentPage: () => WorkspaceCartPage | null,
  reloadPage: () => Promise<WorkspaceCartPage | undefined>,
  otherMutationLocked: () => boolean = () => false,
  isWorkspaceActive: () => boolean = () => currentPage() !== null,
  native?: NativeCartCommands,
) {
 const commands = native ?? fixture;
  const owner = Object.freeze({ ...scope }), listeners = new Set<() => void>();
  let active = true, disposed = false, sequence = 0;
  let state = idle, attempt: Attempt | null = null, reviewed: WorkspaceCartPage | null = null;
  let resultContext: Execution | null = null;
  let lastSent: Attempt | null = null, recoveryUncertain = false;
  const emit = (next: CartWorkspaceCommandState) => { state = Object.freeze(next); listeners.forEach(listener => listener()); };
  const available = (): boolean => active && (native ? nativeCartAvailable(native, owner) : authorizedCartFixture(owner, fixture)) && (typeof commands?.createCart === "function" || typeof commands?.recoverCart === "function");
  const createAvailable = (): boolean => available() && typeof commands?.createCart === "function";
  const recoveryAvailable = (): boolean => available() && typeof commands?.recoverCart === "function";
  const attemptAvailable = (value: Attempt): boolean => value.kind === "create" ? createAvailable() : recoveryAvailable();
  const sourceFor = (page: WorkspaceCartPage, value: Attempt | null = attempt): CartResponse | undefined => value?.kind === "recover" ? page.items.find(cart => cart.id === value.sourceCartId) : undefined;
  const ownedPage = (page: WorkspaceCartPage): boolean => (!page.current || page.current.buyerOrganizationId === owner.organizationId) && page.items.every(cart => cart.buyerOrganizationId === owner.organizationId);
  const usablePage = (page: WorkspaceCartPage): boolean => currentPage() === page && ownedPage(page);
  const canStart = (page: WorkspaceCartPage): boolean => createAvailable() && !otherMutationLocked() && usablePage(page) && page.current === null && ["idle", "observed"].includes(state.phase);
  const failed = (cart: CartResponse): boolean => cart.buyerOrganizationId === owner.organizationId && cart.status === "ABANDONED" && cart.checkout?.status === "FAILED";
  const noCurrentWork = (page: WorkspaceCartPage): boolean => page.current === null || page.current.status === "ACTIVE" && page.current.checkout === null && page.current.items.length === 0;
  const recoverable = (page: WorkspaceCartPage, source: CartResponse): boolean => recoveryAvailable() && !otherMutationLocked() && usablePage(page) && page.items.includes(source) && failed(source) && recoverCartSchema.safeParse({ expectedVersion: source.version }).success && !source.recoveredCartId && noCurrentWork(page);
  const canStartRecovery = (page: WorkspaceCartPage, source: CartResponse): boolean => recoverable(page, source) && ["idle", "observed"].includes(state.phase);
  const contextFor = (page: WorkspaceCartPage, source?: CartResponse): Execution => Object.freeze({ page, source, sourceId: source?.id, version: source?.version, checkoutId: source?.checkout?.id, recoveredId: source?.recoveredCartId ?? null });
  const sameContext = (context: Execution): boolean => usablePage(context.page) && (context.source
    ? context.page.items.includes(context.source) && failed(context.source) && context.source.id === context.sourceId && context.source.version === context.version && context.source.checkout?.id === context.checkoutId && (context.source.recoveredCartId ?? null) === context.recoveredId
    : context.page.current === null);
  const denyAll = () => { active = false; sequence++; attempt = null; lastSent = null; recoveryUncertain = false; reviewed = null; resultContext = null; emit({ phase: "rejected", issue: "denied" }); };
  const execute = async (prepared: Attempt, context: Execution) => {
    attempt = prepared; lastSent = prepared; reviewed = null; resultContext = null; const ownSequence = ++sequence;
    const unknown = (issue?: CartWorkspaceCommandState["issue"]) => { if (prepared.kind === "recover") recoveryUncertain = true; emit({ ...state, phase: "unknown", priorUnknown: true, issue }); };
    emit({ phase: "pending", operation: prepared.kind, sourceCartId: prepared.kind === "recover" ? prepared.sourceCartId : undefined, input: prepared.input, priorUnknown: state.priorUnknown });
    try {
      const body = prepared.kind === "create" ? await commands!.createCart!(owner, owner.organizationId, prepared.input)
        : await commands!.recoverCart!(owner, prepared.sourceCartId, prepared.input);
      if (!active || ownSequence !== sequence) return;
      if (!attemptAvailable(prepared)) { denyAll(); return; }
      if (!sameContext(context)) { unknown("context"); return; }
      const root = resultRoot.safeParse(body);
      // A create-or-get response can be a pre-existing cart owned by another
      // employee of this buyer; createdById and empty items are not invariants.
      const rootMatches = root.success && root.data.buyerOrganizationId === owner.organizationId && (prepared.kind === "create" || root.data.id !== prepared.sourceCartId && (!context.recoveredId || root.data.id === context.recoveredId));
      const value = rootMatches ? decodeCommandCart(body, owner, root.data.id) : null;
      const valid = value && (prepared.kind === "create" ? value.currency === prepared.input.currency && value.status === "ACTIVE"
        : value.id !== prepared.sourceCartId && (!context.recoveredId || value.id === context.recoveredId));
      if (!value || !valid) { unknown("invalid-result"); return; }
      resultContext = context;
      if (prepared.kind === "recover") recoveryUncertain = false;
      emit({ ...state, phase: "result", result: value, issue: undefined, priorUnknown: prepared.kind === "recover" ? prepared.unknownBefore : state.priorUnknown });
    } catch (error) {
      if (!active || ownSequence !== sequence) return;
      if (!attemptAvailable(prepared)) { denyAll(); return; }
      if (!sameContext(context)) { unknown("context"); return; }
      const parsed = typeof error === "object" && error !== null && "payload" in error && "status" in error ? errorResponseSchema.safeParse(error.payload) : null;
      const status = typeof error === "object" && error !== null && "status" in error ? error.status : undefined;
      if (!parsed?.success || parsed.data.statusCode !== status || ![400, 401, 403, 404, 409].includes(status as number)) { unknown(); return; }
      const issue = status === 400 ? "validation" : status === 401 ? "authentication" : status === 403 ? "denied" : status === 404 ? "not-found" : "conflict";
      emit({ ...state, phase: "rejected", issue, result: undefined });
    }
  };
  return {
    runtime: native ? "native-session" as const : "fixture" as const, getSnapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    isAvailable: available, isCreateAvailable: createAvailable, isRecoveryAvailable: recoveryAvailable, canStart, canStartRecovery,
    currentWorkBlocksRecovery(page: WorkspaceCartPage): boolean { return usablePage(page) && !noCurrentWork(page); },
    blocksOtherMutations(): boolean { return active && !["idle", "observed"].includes(state.phase); },
    async start(page: WorkspaceCartPage, currency?: string) {
      if (!canStart(page)) return;
      const parsed = createCartSchema.safeParse(currency === undefined ? {} : { currency });
      if (!parsed.success) return;
      recoveryUncertain = false;
      await execute(Object.freeze({ kind: "create", page, input: Object.freeze(parsed.data), unknownBefore: state.priorUnknown }), contextFor(page));
    },
    async startRecovery(page: WorkspaceCartPage, source: CartResponse) {
      if (!canStartRecovery(page, source)) return;
      recoveryUncertain = false;
      const input = Object.freeze(recoverCartSchema.parse({ expectedVersion: source.version }));
      await execute(Object.freeze({ kind: "recover", page, sourceCartId: source.id, input, unknownBefore: state.priorUnknown }), contextFor(page, source));
    },
    canReplayRecovery(): boolean {
      const page = currentPage(), source = page && sourceFor(page, lastSent);
      return recoveryAvailable() && !otherMutationLocked() && !!page && usablePage(page) && !!source && failed(source) && lastSent?.kind === "recover" && ["unknown", "read-error", "review"].includes(state.phase) && recoveryUncertain;
    },
    hasUnresolvedRecovery(): boolean { return recoveryUncertain; },
    async replayRecovery() {
      if (!this.canReplayRecovery() || lastSent?.kind !== "recover") return;
      const page = currentPage()!, source = sourceFor(page, lastSent)!;
      // Same immutable original request/source key. The actual helper returns
      // the permanent previous target before checking version/current work.
      await execute(lastSent, contextFor(page, source));
    },
    canRead(): boolean { return available() && !!attempt && isWorkspaceActive() && ["result", "unknown", "rejected", "read-error", "review", "prepared"].includes(state.phase); },
    async readCurrent() {
      if (!this.canRead()) return;
      if (state.phase === "prepared") attempt = lastSent;
      const ownSequence = ++sequence; emit({ ...state, phase: "reading", input: lastSent?.input, result: undefined, latest: undefined });
      try {
        const page = await reloadPage();
        if (!active || ownSequence !== sequence) return;
        if (!available()) { denyAll(); return; }
        if (!page || !usablePage(page)) { emit({ ...state, phase: "read-error", latest: undefined }); return; }
        reviewed = page; emit({ ...state, phase: "review", latest: page, issue: undefined });
      } catch { if (active && ownSequence === sequence) emit({ ...state, phase: "read-error", latest: undefined }); }
    },
    canPrepare(): boolean {
      if (!available() || otherMutationLocked() || state.phase !== "review" || !reviewed || !usablePage(reviewed) || !attempt) return false;
      if (attempt.kind === "create") return createAvailable() && reviewed.current === null;
      const source = sourceFor(reviewed);
      return !!source && recoverable(reviewed, source);
    },
    prepareNew() {
      if (!this.canPrepare()) return;
      if (attempt!.kind === "recover") {
        const original = attempt!, source = reviewed!.items.find(cart => cart.id === original.sourceCartId)!;
        attempt = Object.freeze({ ...original, page: reviewed!, input: Object.freeze(recoverCartSchema.parse({ expectedVersion: source.version })) });
      } else attempt = Object.freeze({ kind: "create", page: reviewed!, input: Object.freeze(createCartSchema.parse({ currency: attempt!.input.currency })), unknownBefore: state.priorUnknown });
      emit({ ...state, phase: "prepared", input: attempt.input, result: undefined, latest: undefined });
    },
    canSubmitPrepared(): boolean {
      if (!available() || otherMutationLocked() || state.phase !== "prepared" || !attempt || !usablePage(attempt.page)) return false;
      if (attempt.kind === "create") return createAvailable() && attempt.page.current === null;
      const source = sourceFor(attempt.page);
      return !!source && recoverable(attempt.page, source) && source.version === attempt.input.expectedVersion;
    },
    async submitPrepared() {
      if (!this.canSubmitPrepared() || !attempt) return;
      const source = sourceFor(attempt.page);
      await execute(attempt, contextFor(attempt.page, source));
    },
    returnToReview() { if (available() && state.phase === "prepared" && reviewed && usablePage(reviewed)) { attempt = lastSent; emit({ ...state, phase: "review", input: lastSent?.input, latest: reviewed }); } },
    canAcknowledge(): boolean { return available() && state.phase === "review" && !!reviewed && usablePage(reviewed); },
    acknowledge(): boolean {
      if (!this.canAcknowledge()) return false;
      attempt = null; lastSent = null; recoveryUncertain = false; reviewed = null; resultContext = null; emit({ phase: "observed", priorUnknown: state.priorUnknown }); return true;
    },
    resultCart(): CartResponse | null { return available() && state.phase === "result" && resultContext && sameContext(resultContext) ? state.result ?? null : null; },
    activate() { if (disposed) { disposed = false; active = true; } },
    denyAll,
    dispose() { disposed = true; active = false; sequence++; attempt = null; lastSent = null; recoveryUncertain = false; reviewed = null; resultContext = null; state = idle; listeners.clear(); },
  };
}
export type CartWorkspaceCommands = ReturnType<typeof createCartWorkspaceCommands>;
