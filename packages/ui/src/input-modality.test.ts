import { expect, it } from "vitest";
import { installInputModality } from "./input-modality";

it("switches only visual modality, including pointer after keyboard and cleanup", () => {
  const doc = Object.assign(new EventTarget(), { documentElement: { dataset: {} as Record<string, string> } });
  const stop = installInputModality(doc as unknown as Document);
  const press = (key: string) => doc.dispatchEvent(Object.assign(new Event("keydown"), { key }));
  expect(doc.documentElement.dataset.inputModality).toBe("pointer");
  press("Shift"); expect(doc.documentElement.dataset.inputModality).toBe("pointer");
  press("Tab"); expect(doc.documentElement.dataset.inputModality).toBe("keyboard");
  const event = new Event("pointerdown", { cancelable: true });
  doc.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(false);
  expect(doc.documentElement.dataset.inputModality).toBe("pointer");
  press("ArrowDown"); expect(doc.documentElement.dataset.inputModality).toBe("keyboard");
  stop(); press("Tab"); expect(doc.documentElement.dataset.inputModality).toBeUndefined();
});
