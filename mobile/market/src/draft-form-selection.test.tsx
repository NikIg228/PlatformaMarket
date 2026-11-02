import { useSyncExternalStore } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { DraftFormInput } from "./DraftFormInput";
import { Text } from "./ui/controls";
import { createSupportTicketDraft, type SupportTextField } from "./support-ticket-draft";
import { listDraftScope } from "./test-fixtures/list-draft";
function owner() { const store = createSupportTicketDraft(listDraftScope); store.setReadAccess(listDraftScope, true); store.begin(); store.setText("subject", "SYNTHETIC subject"); store.setText("description", "SYNTHETIC multiline\nЕкінші жол"); return store; }
function Field({ store, field = "description" }: { store: ReturnType<typeof owner>; field?: SupportTextField }) {
  const row = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  return <DraftFormInput draftSelection={{ owner: store, key: "ticket", field, readValue: () => { const current = store.getSnapshot(); return current.started && current.available ? current.values[field] : null; } }} accessibilityLabel={field} value={row.values[field]} onChangeText={text => store.setText(field, text)} multiline={field === "description"} />;
}
const select = async (field: string, selection: { start: number; end: number }) => fireEvent(screen.getByLabelText(field), "selectionChange", { nativeEvent: { selection } });
it("keeps detached valid UTF-16 offsets per field, rejects invalid ranges and releases a stale cursor when text changes", async () => {
  const store = owner(), view = await render(<Field store={store} />), range = { start: 3, end: 7 }; await select("description", range); range.end = 99;
  expect(screen.getByLabelText("description")).toHaveProp("selection", { start: 3, end: 7 });
  for (const invalid of [{ start: -1, end: 2 }, { start: 5, end: 2 }, { start: 0, end: 999 }, { start: 0.5, end: 1 }]) await select("description", invalid);
  expect(screen.getByLabelText("description")).toHaveProp("selection", { start: 3, end: 7 });
  await view.rerender(<Field store={store} field="subject" />); expect(screen.getByLabelText("subject").props.selection).toBeUndefined(); await select("subject", { start: 0, end: 2 });
  await view.rerender(<Field store={store} />); expect(screen.getByLabelText("description")).toHaveProp("selection", { start: 3, end: 7 });
  await fireEvent.changeText(screen.getByLabelText("description"), "я"); expect(screen.getByLabelText("description").props.selection).toBeUndefined(); expect(store.getSnapshot().values.description).toBe("я");
});
it("clears discarded selection while the editor is unmounted, even if a new draft later gets identical text", async () => {
  const store = owner(), view = await render(<Field store={store} />); await select("description", { start: 2, end: 8 });
  await view.rerender(<Text>Other existing screen</Text>); store.cancel(); store.begin(); store.setText("description", "SYNTHETIC multiline\nЕкінші жол");
  await view.rerender(<Field store={store} />); expect(screen.getByLabelText("description").props.selection).toBeUndefined();
});
it("never restores another owner selection or applies a late selection event after its owner closes", async () => {
  const first = owner(), next = owner(), view = await render(<Field store={first} />); await select("description", { start: 1, end: 6 });
  const late = screen.getByLabelText("description").props.onSelectionChange;
  await view.rerender(<Field store={next} />); expect(screen.getByLabelText("description").props.selection).toBeUndefined(); first.close();
  await act(async () => late({ nativeEvent: { selection: { start: 0, end: 3 } } })); expect(screen.getByLabelText("description").props.selection).toBeUndefined(); expect(next.getSnapshot().values.description).toBe("SYNTHETIC multiline\nЕкінші жол");
});
