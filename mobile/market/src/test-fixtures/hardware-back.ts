import { jest } from "@jest/globals";
import { act } from "@testing-library/react-native";
import { BackHandler } from "react-native";

/** Host event harness through public native subscription API; no device/IME acceptance. */
export function captureHardwareBack() {
  type Handler = Parameters<typeof BackHandler.addEventListener>[1];
  const handlers = new Set<Handler>();
  const spy = jest.spyOn(BackHandler, "addEventListener").mockImplementation((_name, handler) => {
    handlers.add(handler); return { remove: () => { handlers.delete(handler); } };
  });
  return {
    handlers,
    restore: () => spy.mockRestore(),
    async press() {
      expect(handlers.size).toBe(1);
      let handled: boolean | undefined;
      await act(async () => { handled = [...handlers][0]!({ type: "hardwareBackPress", timeStamp: 0 }); });
      return handled;
    },
  };
}
