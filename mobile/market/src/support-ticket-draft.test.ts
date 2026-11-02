import { createSupportTicketSchema } from "../../../packages/schemas/src/commercial";
import { checkLocalSupportFields, createSupportTicketDraft, supportDraftPriorities, type LocalSupportText, type SupportTextField } from "./support-ticket-draft";
import type { ReadScope } from "./read-controller";
const scope: ReadScope = { product: "market", environment: "synthetic-offline", userId: "00000000-0000-4000-8000-000000000020", organizationId: "00000000-0000-4000-8000-000000000004", generation: 1 };
const valid = (): LocalSupportText => ({ subject: "Тема", description: "Описание вопроса", category: "Своя категория", priority: "NORMAL" });
function started() { const store = createSupportTicketDraft(scope); store.setReadAccess(scope, true); expect(store.begin()).toBe(true); return store; }
it.each([
  ["subject", 4, 200], ["description", 10, 10000], ["category", 2, 80],
] as const)("checks exact %s boundaries via the existing field schema and preserves whitespace", (field, min, max) => {
  for (const [text, passes] of [["я".repeat(min - 1), false], ["я".repeat(min), true], ["я".repeat(max), true], ["я".repeat(max + 1), false], [`  ${"я".repeat(min)}\n`, true], [" \n\t ", false]] as const) {
    const values = { ...valid(), [field]: text };
    expect(createSupportTicketSchema.shape[field].safeParse(text).success).toBe(passes);
    expect(checkLocalSupportFields(values)[field] === undefined).toBe(passes);
    const store = started(); for (const key of ["subject", "description", "category"] as const) store.setText(key, values[key]); store.check();
    expect(store.getSnapshot().values[field]).toBe(text);
  }
});
it("retains long/newline/Unicode original strings while checking only selected fields, not a complete send object", () => {
  const store = started(), subject = "  😀".repeat(10) + "\n", description = "  Сұрақ\nSecond line\t" + "я".repeat(500) + "  ";
  store.setText("subject", subject); store.setText("description", description); store.setText("category", "  произвольный текст  "); store.setPriority("URGENT");
  const before = store.getSnapshot().values; expect(store.check().valid).toBe(true); expect(store.getSnapshot().values).toBe(before);
  expect(store.getSnapshot().values.subject).toBe(subject); expect(store.getSnapshot().values.description).toBe(description);
  expect(Object.keys(store.getSnapshot().values).sort()).toEqual(["category", "description", "priority", "subject"]);
  expect(createSupportTicketSchema.safeParse(store.getSnapshot().values).success).toBe(false);
});
it("uses schema string length for Unicode boundaries instead of a new custom counter/taxonomy", () => {
  const atLimit = "😀".repeat(100), beyond = atLimit + "😀";
  for (const subject of [atLimit, beyond]) expect(checkLocalSupportFields({ ...valid(), subject }).subject === undefined).toBe(createSupportTicketSchema.shape.subject.safeParse(subject).success);
});
it("tracks raw dirty state, leaves errors on unchanged fields and cancels to original empty strings/default priority", () => {
  const store = started(); expect(store.getSnapshot().dirty).toBe(false); expect(store.check().firstError).toBe("subject");
  expect(store.getSnapshot().errors).toEqual({ subject: { kind: "minimum", count: "4" }, description: { kind: "minimum", count: "10" }, category: { kind: "minimum", count: "2" } });
  store.setText("subject", " "); expect(store.getSnapshot().dirty).toBe(true); expect(store.getSnapshot().errors.subject).toBeUndefined(); expect(store.getSnapshot().errors.description).toBeDefined();
  store.setPriority("HIGH"); store.cancel(); const state = store.getSnapshot(); expect(state.values).toEqual({ subject: "", description: "", category: "", priority: createSupportTicketSchema.shape.priority.parse(undefined) }); expect(state.started).toBe(false); expect(state.checked).toBe(false); expect(state.errors).toEqual({}); expect(state.dirty).toBe(false);
});
it("uses only existing priority choices and rejects unsupported priority/extra field names without creating keys", () => {
  const store = started(); expect(supportDraftPriorities).toEqual(createSupportTicketSchema.shape.priority.unwrap().options);
  for (const priority of supportDraftPriorities) expect(store.setPriority(priority)).toBe(true);
  expect(store.setPriority("FUTURE_PRIORITY")).toBe(false); expect(store.setPriority("__proto__")).toBe(false);
  expect(store.setText("idempotencyKey" as SupportTextField, "SYNTHETIC forbidden send key")).toBe(false); expect(store.getSnapshot().values).not.toHaveProperty("idempotencyKey");
});
it.each(["userId", "organizationId", "environment", "generation"] as const)("drops and disables raw draft for a different %s read context", field => {
  const store = started(); store.setText("description", "SYNTHETIC previous raw description");
  const different = field === "generation" ? { ...scope, generation: 2 } : { ...scope, [field]: "SYNTHETIC different context" };
  store.setReadAccess(different, true); expect(store.getSnapshot().available).toBe(false); expect(store.getSnapshot().started).toBe(false); expect(store.getSnapshot().values.description).toBe("");
});
it("closes on logout/disposal and old handlers cannot repopulate text or provide read access", () => {
  const old = started(); old.setText("subject", "SYNTHETIC old text"); old.close(); old.setText("subject", "SYNTHETIC retained callback"); old.setReadAccess(scope, true);
  expect(old.begin()).toBe(false); expect(old.getSnapshot().values.subject).toBe("");
  const next = createSupportTicketDraft({ ...scope, generation: 2 }); next.setReadAccess({ ...scope, generation: 2 }, true); next.begin(); expect(next.getSnapshot().values.subject).toBe("");
});
it("does not start without verified read context and clears on lost access without restoring previous input", () => {
  const store = createSupportTicketDraft(scope); expect(store.begin()).toBe(false); expect(store.setText("subject", "SYNTHETIC blocked")).toBe(false);
  store.setReadAccess(scope, true); store.begin(); store.setText("description", "SYNTHETIC previous input"); store.setReadAccess(scope, false);
  store.setReadAccess(scope, true); expect(store.getSnapshot().started).toBe(false); expect(store.getSnapshot().values.description).toBe(""); expect(store.getSnapshot().discarded).toBe(true);
});
