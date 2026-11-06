import { beforeEach, expect, it, vi } from "vitest";
import type { ReactElement } from "react";

const harness = vi.hoisted(() => ({ slots: [] as unknown[], cursor: 0, send: vi.fn(), focus: vi.fn() }));
vi.mock("react", async importOriginal => ({
  ...await importOriginal<typeof import("react")>(),
  useState: (initial: unknown) => {
    const index = harness.cursor++;
    if (!(index in harness.slots)) harness.slots[index] = initial;
    return [harness.slots[index], (value: unknown) => { harness.slots[index] = value; }];
  },
  useRef: (initial: unknown) => {
    const index = harness.cursor++;
    if (!(index in harness.slots)) harness.slots[index] = { current: initial };
    return harness.slots[index];
  },
  useMemo: (factory: () => unknown) => factory(),
  useEffect: () => undefined,
}));
vi.mock("@marketplace/api-client", () => ({ MarketplaceApiClient: class { correctRegistrationEmail = harness.send; } }));
vi.mock("@marketplace/ui", () => ({ DmButton: "button", DmField: "field", DmInput: "input" }));
vi.mock("../auth-components", () => ({ AuthNotice: "notice" }));
vi.mock("../auth-client", () => ({ apiUrl: "http://fixture.invalid" }));
import { RegistrationEmailCorrection } from "./registration-email-correction";

type Element = ReactElement<Record<string, unknown>>;
function find(root: Element, type: string): Element {
  if (root.type === type) return root;
  for (const child of [root.props.children].flat(Infinity)) {
    if (child && typeof child === "object" && "props" in child) {
      try { return find(child as Element, type); } catch { /* Search the next child. */ }
    }
  }
  throw new Error(`Missing ${type}`);
}
const accepted = { ok: true as const, email: "new@example.test", delivery: "LOCAL_FILE" as const, message: "sent" };
const props = { initialEmail: "typo@example.test", registrationToken: "t".repeat(48), password: "original-password", returnTo: "/clinic", onAccepted: vi.fn(), onCancel: vi.fn() };
function render() { harness.cursor = 0; return RegistrationEmailCorrection(props) as Element; }
function change(tree: Element, value: string) {
  (find(tree, "input").props.onChange as (event: unknown, data: { value: string }) => void)({}, { value });
}
function submit(tree: Element) { return (tree.props.onSubmit as (event: { preventDefault(): void }) => Promise<void>)({ preventDefault() {} }); }
beforeEach(() => { harness.slots = []; vi.clearAllMocks(); harness.send.mockReset(); });

it("submits the original proof once while pending, then reports the confirmed delivery", async () => {
  let resolve!: (value: typeof accepted) => void;
  harness.send.mockReturnValue(new Promise(done => { resolve = done; }));
  change(render(), accepted.email);
  const tree = render();
  const pending = submit(tree);
  await submit(tree);
  expect(harness.send).toHaveBeenCalledTimes(1);
  expect(harness.send).toHaveBeenCalledWith({ registrationToken: props.registrationToken, password: props.password, email: accepted.email, returnTo: props.returnTo });
  expect(find(render(), "input").props.disabled).toBe(true);
  expect(props.onAccepted).not.toHaveBeenCalled();
  resolve(accepted); await pending;
  expect(props.onAccepted).toHaveBeenCalledWith(accepted);
});

it("retains the corrected address after a connection failure and permits retry", async () => {
  harness.send.mockRejectedValueOnce(new TypeError("offline")).mockResolvedValueOnce(accepted);
  change(render(), accepted.email);
  await submit(render());
  const failed = render();
  expect(find(failed, "input").props.value).toBe(accepted.email);
  expect(find(failed, "input").props.disabled).toBe(false);
  expect(find(failed, "notice").props.feedback).toMatchObject({ kind: "error", message: expect.stringContaining("Адрес сохранён") });
  expect(props.onAccepted).not.toHaveBeenCalled();
  await submit(failed);
  expect(props.onAccepted).toHaveBeenCalledOnce();
});

it("rejects invalid email locally without replacing the existing registration", async () => {
  change(render(), "invalid");
  await submit(render());
  expect(harness.send).not.toHaveBeenCalled();
  expect(find(render(), "field").props.validationState).toBe("error");
  expect(props.onAccepted).not.toHaveBeenCalled();
});
