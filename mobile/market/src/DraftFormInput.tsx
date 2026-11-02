import { forwardRef, useEffect, useReducer, type ComponentProps } from "react";
import { FormInput, type FormInputHandle } from "./ui/controls";

type Owner = { subscribe: (listener: () => void) => () => void };
type Range = Readonly<{ start: number; end: number }>;
type Memory = { readValue: () => string | null; selection?: Range };
type Registry = { fields: Map<object | string, Map<string, Memory>>; unsubscribe?: () => void };
const owners = new WeakMap<Owner, Registry>();
export type DraftSelection = { owner: Owner; key: object | string; field: string; readValue: () => string | null };
function rangeFits(selection: Range, text: string) { return Number.isInteger(selection.start) && Number.isInteger(selection.end) && selection.start >= 0 && selection.end >= selection.start && selection.end <= text.length; }
function memoryFor({ owner, key, field, readValue }: DraftSelection) {
  let registry = owners.get(owner); if (!registry) { registry = { fields: new Map() }; owners.set(owner, registry); }
  let fields = registry.fields.get(key); if (!fields) { fields = new Map(); registry.fields.set(key, fields); }
  let memory = fields.get(field); if (!memory) { memory = { readValue }; fields.set(field, memory); } else memory.readValue = readValue;
  return { registry, memory };
}
function observeOwner(owner: Owner, registry: Registry) {
  if (registry.unsubscribe) return;
  // One model-owned listener survives editor unmounts. Discard/source invalidation
  // prunes ranges even while a different screen is mounted. No text is copied;
  // the WeakMap and listener have the same lifetime as the existing memory store.
  registry.unsubscribe = owner.subscribe(() => {
    for (const [key, fields] of registry.fields) {
      for (const [field, memory] of fields) {
        const text = memory.readValue();
        if (text === null) { memory.selection = undefined; fields.delete(field); }
        else if (memory.selection && !rangeFits(memory.selection, text)) memory.selection = undefined;
      }
      if (!fields.size) registry.fields.delete(key);
    }
    if (!registry.fields.size) { const unsubscribe = registry.unsubscribe; registry.unsubscribe = undefined; unsubscribe?.(); }
  });
}
/** Selection offsets only, scoped to an existing unsent memory draft and field. */
export const DraftFormInput = forwardRef<FormInputHandle, Omit<ComponentProps<typeof FormInput>, "selection" | "onSelectionChange"> & { draftSelection: DraftSelection }>(({ draftSelection, onChangeText, ...props }, ref) => {
  const { registry, memory } = memoryFor(draftSelection), [, redraw] = useReducer((value: number) => value + 1, 0);
  useEffect(() => { observeOwner(draftSelection.owner, registry); }, [draftSelection.owner, registry, memory]);
  const text = memory.readValue(), selection = text !== null && memory.selection && rangeFits(memory.selection, text) ? memory.selection : undefined;
  return <FormInput {...props} ref={ref} selection={selection} onChangeText={value => { memory.selection = undefined; onChangeText?.(value); redraw(); }} onSelectionChange={event => {
    const current = memory.readValue(), range = event.nativeEvent.selection;
    if (current === null || !rangeFits(range, current)) return;
    memory.selection = Object.freeze({ start: range.start, end: range.end }); redraw();
  }} />;
});
DraftFormInput.displayName = "DraftFormInput";
