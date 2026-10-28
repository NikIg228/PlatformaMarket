"use client";
import { useSyncExternalStore } from "react";

const key = "dentmarket:buyer-context";
const event = "dentmarket:buyer-context-changed";
export const personalPurchaseMessage = "Личный режим: можно просматривать каталог. Оформление личных покупок пока недоступно. Для закупки выберите организацию.";
let switching = false;
export function buyerMode(): "personal" | "organization" | "switching" {
  if (switching) return "switching";
  return typeof window !== "undefined" && window.sessionStorage.getItem(key) === "personal" ? "personal" : "organization";
}
export function setBuyerMode(mode: "personal" | "organization" | "switching") {
  switching = mode === "switching";
  if (!switching) window.sessionStorage.setItem(key, mode);
  window.dispatchEvent(new Event(event));
}
const subscribe = (notify: () => void) => {
  window.addEventListener(event, notify);
  window.addEventListener("pageshow", notify);
  return () => { window.removeEventListener(event, notify); window.removeEventListener("pageshow", notify); };
};
export const useBuyerMode = () => useSyncExternalStore(subscribe, buyerMode, () => "loading" as const);

/** A mode preference grants no permission; organization access remains server verified. */
export function requireOrganizationMode() {
  if (buyerMode() !== "organization") throw new Error(buyerMode() === "personal" ? personalPurchaseMessage : "Дождитесь проверки выбранной организации.");
}
