/** Shared across providers and their portalled dialogs. Does not change focus itself. */
export function installInputModality(doc: Document) {
  const root = doc.documentElement;
  root.dataset.inputModality = "pointer";
  const pointer = () => { root.dataset.inputModality = "pointer"; };
  const keyboard = (event: KeyboardEvent) => {
    if (!["Shift", "Control", "Alt", "Meta", "CapsLock"].includes(event.key)) root.dataset.inputModality = "keyboard";
  };
  const options = { capture: true };
  doc.addEventListener("pointerdown", pointer, options);
  doc.addEventListener("keydown", keyboard, options);
  return () => {
    doc.removeEventListener("pointerdown", pointer, options);
    doc.removeEventListener("keydown", keyboard, options);
    delete root.dataset.inputModality;
  };
}
