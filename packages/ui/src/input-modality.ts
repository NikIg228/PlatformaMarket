/** Shared across providers and their portalled dialogs. Does not change focus itself. */
export function installInputModality(doc: Document) {
  const root = doc.documentElement;
  root.dataset.inputModality = "pointer";
  const pointer = () => { root.dataset.inputModality = "pointer"; };
  const keyboard = (event: KeyboardEvent) => {
    if (event.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === "Tab") { root.dataset.inputModality = "keyboard"; return; }
    // Typing, selection and caret movement do not turn a pointer-focused editor
    // into keyboard navigation. Keep the previous mode when editing after Tab.
    const target = event.target as Element | null;
    if (typeof target?.closest === "function" && target.closest('input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]),textarea,[contenteditable]:not([contenteditable="false"])')) return;
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End", "PageUp", "PageDown", "Enter", " "].includes(event.key)) root.dataset.inputModality = "keyboard";
  };
  const options = { capture: true };
  // Fluent/Tabster can consume Tab before it reaches document (focus traps).
  // Observe at window capture without cancelling or moving focus ourselves.
  const keyboardTarget = doc.defaultView ?? doc;
  doc.addEventListener("pointerdown", pointer, options);
  keyboardTarget.addEventListener("keydown", keyboard as EventListener, options);
  // Some focus-trap handlers stop even other window keydown listeners. Keyup
  // still reaches the newly focused control and restores the visual modality.
  keyboardTarget.addEventListener("keyup", keyboard as EventListener, options);
  return () => {
    doc.removeEventListener("pointerdown", pointer, options);
    keyboardTarget.removeEventListener("keydown", keyboard as EventListener, options);
    keyboardTarget.removeEventListener("keyup", keyboard as EventListener, options);
    delete root.dataset.inputModality;
  };
}
