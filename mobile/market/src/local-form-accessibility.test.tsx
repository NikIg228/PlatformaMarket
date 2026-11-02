import type { ComponentProps } from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import type { FormInputHandle } from "./ui/controls";
import { SupportTicketDraftForm } from "./SupportTicketDraftUi";
import { GoodsReturnDraftForm, goodsReturnCopy } from "./GoodsReturnDraftUi";
import { createSupportTicketDraft } from "./support-ticket-draft";
import { createGoodsReturnDrafts } from "./goods-return-draft";
import { goodsReturnWorkflow, goodsReturnScope } from "./test-fixtures/goods-return-draft";
import { copy, supportDraftFieldLabel } from "./i18n";

// Capture public refs while rendering the real owned primitive. Queries remain
// on accessible host roles/labels; no renderer-tree or synthetic onPress calls.
const mockHandles = new Map<string, FormInputHandle>();
jest.mock("./ui/controls", () => {
  const real = jest.requireActual<typeof import("./ui/controls")>("./ui/controls");
  const React = jest.requireActual<typeof import("react")>("react");
  return { ...real, FormInput: React.forwardRef<FormInputHandle, ComponentProps<typeof real.FormInput>>((props, ref) => React.createElement(real.FormInput, { ...props, ref: node => {
    if (node) mockHandles.set(props.accessibilityLabel, node);
    if (typeof ref === "function") ref(node); else if (ref) ref.current = node;
  } })) };
});
afterEach(() => { mockHandles.clear(); jest.clearAllMocks(); jest.restoreAllMocks(); });

it("focuses each first support error, announces field-specific changes and preserves multiline draft through keyboard next and locale", async () => {
  const store = createSupportTicketDraft(goodsReturnScope); store.setReadAccess(goodsReturnScope, true); store.begin();
  const t = copy.ru, view = await render(<SupportTicketDraftForm store={store} locale="ru" onBack={jest.fn()} />);
  const subject = supportDraftFieldLabel("subject", "ru"), description = supportDraftFieldLabel("description", "ru");
  const subjectFocus = jest.spyOn(mockHandles.get(subject)!, "focus"), descriptionFocus = jest.spyOn(mockHandles.get(description)!, "focus");
  subjectFocus.mockClear(); await fireEvent.press(screen.getByRole("button", { name: t.supportDraftCheck })); expect(subjectFocus.mock.contexts.at(-1)).toBe(mockHandles.get(subject));
  expect(screen.getByRole("alert").props.accessibilityLabel).toContain(`${subject}:`); expect(screen.getByRole("alert").props.accessibilityLabel).toContain(`${description}:`);
  await fireEvent.changeText(screen.getByLabelText(subject), "  SYNTHETIC тема  "); descriptionFocus.mockClear(); await fireEvent(screen.getByLabelText(subject), "submitEditing"); expect(descriptionFocus.mock.contexts.at(-1)).toBe(mockHandles.get(description)); expect(screen.getByLabelText(subject)).toHaveProp("submitBehavior", "submit");
  await fireEvent.press(screen.getByRole("button", { name: t.supportDraftCheck })); expect(descriptionFocus.mock.contexts.at(-1)).toBe(mockHandles.get(description)); expect(screen.getByRole("alert").props.accessibilityLabel).not.toContain(`${subject}:`);
  const raw = "  SYNTHETIC текст\nЕкінші жол  "; await fireEvent.changeText(screen.getByLabelText(description), raw);
  expect(screen.getByLabelText(description)).toHaveProp("multiline", true); expect(screen.getByLabelText(description).props.onSubmitEditing).toBeUndefined();
  await view.rerender(<SupportTicketDraftForm store={store} locale="kk" onBack={jest.fn()} />);
  expect(screen.getByLabelText(supportDraftFieldLabel("description", "kk"))).toHaveProp("value", raw); expect(screen.getByLabelText(supportDraftFieldLabel("subject", "kk"))).toHaveProp("value", "  SYNTHETIC тема  ");
});
it("focuses return reason then quantity, and keyboard next moves to condition without submitting or losing multiline text", async () => {
  const workflow = goodsReturnWorkflow(), store = createGoodsReturnDrafts(goodsReturnScope); store.syncWorkflow(workflow); const target = store.begin(workflow, workflow.order.items[0]!)!;
  const t = goodsReturnCopy.ru, view = await render(<GoodsReturnDraftForm store={store} workflow={workflow} target={target} locale="ru" onBack={jest.fn()} />);
  const reasonFocus = jest.spyOn(mockHandles.get(t.reason)!, "focus"), quantityFocus = jest.spyOn(mockHandles.get(t.quantityText)!, "focus"), conditionFocus = jest.spyOn(mockHandles.get(t.condition)!, "focus");
  reasonFocus.mockClear(); await fireEvent.press(screen.getByRole("button", { name: t.review })); expect(reasonFocus.mock.contexts.at(-1)).toBe(mockHandles.get(t.reason)); expect(screen.getByRole("alert").props.accessibilityLabel).toContain(`${t.reason}:`);
  const raw = "  SYNTHETIC причина\nЕкінші жол  "; await fireEvent.changeText(screen.getByLabelText(t.reason), raw); await fireEvent.press(screen.getByRole("button", { name: t.check })); expect(quantityFocus.mock.contexts.at(-1)).toBe(mockHandles.get(t.quantityText)); expect(screen.getByRole("alert").props.accessibilityLabel).not.toContain(`${t.reason}:`);
  await fireEvent.changeText(screen.getByLabelText(t.quantityText), " 1,25 "); await fireEvent(screen.getByLabelText(t.quantityText), "submitEditing"); expect(conditionFocus.mock.contexts.at(-1)).toBe(mockHandles.get(t.condition)); expect(screen.getByLabelText(t.quantityText)).toHaveProp("submitBehavior", "submit"); expect(store.entryForTarget(target)?.reviewing).toBe(false);
  expect(screen.getByLabelText(t.reason).props.onSubmitEditing).toBeUndefined(); expect(screen.getByLabelText(t.condition).props.onSubmitEditing).toBeUndefined();
  await view.rerender(<GoodsReturnDraftForm store={store} workflow={workflow} target={target} locale="kk" onBack={jest.fn()} />);
  expect(screen.getByLabelText(goodsReturnCopy.kk.reason)).toHaveProp("value", raw); expect(screen.getByLabelText(goodsReturnCopy.kk.quantityText)).toHaveProp("value", " 1,25 ");
});
