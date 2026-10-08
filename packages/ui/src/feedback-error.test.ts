import { afterEach, describe, expect, it, vi } from "vitest";
import { actionFailure, feedbackErrorMessage } from "./feedback-error";
afterEach(() => vi.unstubAllGlobals());
describe("safe failure notices", () => {
  it("does not claim a write was rejected when its response is missing", () => {
    for (const error of [new TypeError("Failed to fetch"), { status: 408 }, { status: 503 }])
      expect(actionFailure(error, { write: true }).title).toBe("Результат пока неизвестен");
    expect(actionFailure(new Error("Read failed"), { write: false }).tone).toBe("error");
  });
  it("distinguishes confirmed denials and retains business explanations", () => {
    expect(actionFailure({ status: 401 }).title).toBe("Нужно войти заново");
    expect(actionFailure({ status: 403 }).title).toBe("Недостаточно прав");
    expect(actionFailure(Object.assign(new Error("Недостаточно товара"), { status: 409 }), { write: true }).description).toBe("Недостаточно товара");
  });
  it("translates transport errors without promising that data was saved", () => {
    expect(feedbackErrorMessage(new TypeError("Failed to fetch"))).not.toContain("Failed to fetch");
    vi.stubGlobal("navigator", { onLine: false });
    expect(actionFailure(new Error("Fetch"), { write: false }).title).toBe("Нет подключения к сети");
    expect(actionFailure(new Error("Fetch"), { write: true }).title).toBe("Результат пока неизвестен");
  });
});
