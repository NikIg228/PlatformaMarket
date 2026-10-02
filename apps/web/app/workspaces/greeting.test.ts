import { describe, expect, it } from "vitest";
import { workspaceGreeting } from "./greeting";

describe("workspace greeting", () => {
  it.each([[0, "Доброй ночи"], [4, "Доброй ночи"], [5, "Доброе утро"], [8, "Доброе утро"], [11, "Доброе утро"], [12, "Добрый день"], [13, "Добрый день"], [17, "Добрый день"], [18, "Добрый вечер"], [22, "Добрый вечер"], [23, "Доброй ночи"]])("selects the greeting at hour %s", (hour, expected) => {
    expect(workspaceGreeting(Number(hour), " Иван Петров ")).toBe(`${expected}, Иван`);
  });
  it("does not invent a name for an unnamed employee", () => {
    expect(workspaceGreeting(8, "  ")).toBe("Доброе утро");
    expect(workspaceGreeting(13)).toBe("Добрый день");
  });
});
