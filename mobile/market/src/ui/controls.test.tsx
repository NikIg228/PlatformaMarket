import { createRef, StrictMode } from "react";
import { AccessibilityInfo, Platform } from "react-native";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { jest } from "@jest/globals";
import { Button, FormInput, Loading, Notice, type FormInputHandle } from "./controls";
import { palette } from "./theme";

const platformDescriptor = Object.getOwnPropertyDescriptor(Platform, "OS")!;
afterEach(() => {
  Object.defineProperty(Platform, "OS", platformDescriptor);
  jest.clearAllMocks();
  jest.restoreAllMocks();
});

it("queues one iOS announcement per message across StrictMode replay and keeps retry reachable", async () => {
  Object.defineProperty(Platform, "OS", { configurable: true, value: "ios" });
  const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibilityWithOptions").mockImplementation(() => {});
  const retry = jest.fn();
  const content = (title: string) => <StrictMode><Notice kind="error" title={title} body="Повторите позже." action={<Button label="Повторить" onPress={retry} />} /></StrictMode>;
  const rendered = await render(content("Нет доступа"));
  expect(screen.getByRole("alert", { name: "Нет доступа. Повторите позже." })).toBeOnTheScreen();
  expect(announce).toHaveBeenCalledTimes(1);
  expect(announce).toHaveBeenLastCalledWith("Нет доступа. Повторите позже.", { queue: true });
  await rendered.rerender(content("Нет доступа"));
  expect(announce).toHaveBeenCalledTimes(1);
  await rendered.rerender(content("Деректер қолжетімсіз"));
  expect(announce).toHaveBeenCalledTimes(2);
  await fireEvent.press(screen.getByRole("button", { name: "Повторить" }));
  expect(retry).toHaveBeenCalledTimes(1);
});

it("uses an Android live region without a duplicate imperative announcement", async () => {
  Object.defineProperty(Platform, "OS", { configurable: true, value: "android" });
  const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibilityWithOptions").mockImplementation(() => {});
  await render(<Notice title="Тауар табылмады" />);
  expect(screen.getByRole("text", { name: "Тауар табылмады" })).toHaveProp("accessibilityLiveRegion", "polite");
  expect(announce).not.toHaveBeenCalled();
});

it("exposes a single named busy loading indicator", async () => {
  await render(<Loading label="Жүктелуде…" />);
  expect(screen.getAllByRole("progressbar")).toHaveLength(1);
  expect(screen.getByRole("progressbar", { name: "Жүктелуде…", busy: true })).toBeOnTheScreen();
});

it("forwards the native input handle and shows the shared focus token without losing the draft", async () => {
  const ref = createRef<FormInputHandle>(); const onFocus = jest.fn(); const onBlur = jest.fn();
  await render(<FormInput ref={ref} accessibilityLabel="SYNTHETIC field" value="SYNTHETIC draft" onFocus={onFocus} onBlur={onBlur} />);
  const field = screen.getByLabelText("SYNTHETIC field");
  expect(ref.current?.focus).toEqual(expect.any(Function));
  await fireEvent(field, "focus", { nativeEvent: {} });
  expect(field).toHaveStyle({ outlineWidth: 1, outlineColor: palette["focus.ring"] });
  expect(field).toHaveDisplayValue("SYNTHETIC draft");
  expect(onFocus).toHaveBeenCalledTimes(1);
  await fireEvent(field, "blur", { nativeEvent: {} });
  expect(field).toHaveStyle({ outlineWidth: 0 });
  expect(onBlur).toHaveBeenCalledTimes(1);
});
