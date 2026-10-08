"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Portal, useDialogContext_unstable, type DialogContextValue } from "@fluentui/react-components";
import { CheckmarkCircle20Regular } from "@fluentui/react-icons/svg/checkmark-circle";
import { ErrorCircle20Regular } from "@fluentui/react-icons/svg/error-circle";
import { Warning20Regular } from "@fluentui/react-icons/svg/warning";
import { Info20Regular } from "@fluentui/react-icons/svg/info";
import { Dismiss20Regular } from "@fluentui/react-icons/svg/dismiss";
import { DmButton } from "./controls";
import { useConnectionMonitor } from "./use-connection-monitor";
import { offlineMessage } from "./feedback-error";

export type ToastTone = "success" | "error" | "warning" | "info";
export type ToastOptions = { tone?: ToastTone; title?: string };
type Notify = (message: string, options?: ToastOptions) => void;
type DialogAttributes = DialogContextValue["modalAttributes"];
type ToastNotice = { id: number; message: string; tone: ToastTone; title: string; owner: symbol; dialogAttributes?: DialogAttributes };
const ToastContext = createContext<{
  notify: (message: string, options: ToastOptions, owner: symbol, dialogAttributes?: DialogAttributes) => void;
  syncOwner: (owner: symbol, dialogAttributes?: DialogAttributes) => void;
} | null>(null);
export function useToast(): Notify {
  const context = useContext(ToastContext);
  const dialogAttributes = useDialogContext_unstable(dialog => dialog.open ? dialog.modalAttributes : undefined);
  const owner = useRef(Symbol("toast-owner"));
  // A toast triggered inside a Fluent dialog participates in that same focus/
  // announcement group. Release it when the originating surface closes.
  useEffect(() => {
    const id = owner.current;
    context?.syncOwner(id, dialogAttributes);
    return () => context?.syncOwner(id);
  }, [context, dialogAttributes]);
  return useCallback((message, options = {}) => context?.notify(message, options, owner.current, dialogAttributes), [context, dialogAttributes]);
}
export const useToastAvailable = () => useContext(ToastContext) !== null;
export const useSaveToast = useToast;
/** Register a dialog's modalizer even before its first action produces a toast. */
export function ToastScope() { useToast(); return null; }
const labels = { success: "Успешно", error: "Ошибка", warning: "Внимание", info: "Информация" };
const icons = { success: CheckmarkCircle20Regular, error: ErrorCircle20Regular, warning: Warning20Regular, info: Info20Regular };

/** Shared action feedback. Field errors and recovery controls stay at the action. */
export function SaveToastProvider({ children }: { children: ReactNode }) {
  const [notice, setNotice] = useState<ToastNotice | null>(null);
  const [leaving, setLeaving] = useState(false);
  const sequence = useRef(0);
  const owners = useRef(new Map<symbol, DialogAttributes>());
  const networkOwner = useRef(Symbol("connection"));
  const offlineNotified = useRef(false);
  const card = useRef<HTMLDivElement>(null), returnFocus = useRef<HTMLElement | null>(null);
  const lastFocused = useRef<HTMLElement | null>(null);
  const lastDialog = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const remember = (event: FocusEvent) => {
      if (event.target instanceof HTMLElement && event.target !== document.body && !card.current?.contains(event.target)) {
        lastFocused.current = event.target;
        lastDialog.current = event.target.closest<HTMLElement>('[role="dialog"], [role="alertdialog"]');
      }
    };
    document.addEventListener("focusin", remember);
    return () => document.removeEventListener("focusin", remember);
  }, []);
  const notify = useCallback((message: string, options: ToastOptions, owner: symbol, dialogAttributes?: DialogAttributes) => {
    if (!navigator.onLine && (options.title === "Нет подключения к сети" || /^(Нет подключения к сети|Нет сети)/.test(message))) {
      if (offlineNotified.current) return;
      offlineNotified.current = true;
      options = { ...options, tone: "warning", title: "Нет подключения к сети" };
    }
    const tone = options.tone ?? "success";
    if (!card.current?.contains(document.activeElement)) returnFocus.current = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : lastFocused.current;
    setLeaving(false); setNotice({ id: ++sequence.current, message, tone, title: options.title ?? labels[tone], owner, dialogAttributes });
  }, []);
  const syncOwner = useCallback((owner: symbol, dialogAttributes?: DialogAttributes) => {
    if (dialogAttributes) owners.current.set(owner, dialogAttributes); else owners.current.delete(owner);
    setNotice(current => {
      if (!current) return current;
      const attributes = current.owner === networkOwner.current ? [...owners.current.values()].at(-1) : current.owner === owner ? dialogAttributes : current.dialogAttributes;
      return attributes === current.dialogAttributes ? current : { ...current, dialogAttributes: attributes };
    });
  }, []);
  const [context] = useState(() => ({ notify, syncOwner }));
  const connection = useConnectionMonitor((state, recovered) => {
    if (recovered) offlineNotified.current = false;
    if (state === "offline") notify("Данные могут быть устаревшими.", { tone: "warning", title: "Нет подключения к сети" }, networkOwner.current, [...owners.current.values()].at(-1));
    if (recovered) notify("Сервис снова доступен.", { tone: "success", title: "Связь восстановлена" }, networkOwner.current, [...owners.current.values()].at(-1));
  });
  const dismiss = useCallback(() => {
    if (card.current?.contains(document.activeElement)) {
      if (returnFocus.current?.isConnected) returnFocus.current.focus();
      // A successful retry can unmount its trigger. Keep keyboard users inside
      // the same open dialog rather than dropping focus onto document.body.
      if (card.current.contains(document.activeElement) && lastDialog.current?.isConnected) lastDialog.current.focus();
    }
    setNotice(null);
  }, []);
  const noticeId = notice?.id;
  useEffect(() => {
    if (!noticeId) return;
    const slide = window.setTimeout(() => setLeaving(true), 5000);
    const remove = window.setTimeout(dismiss, 5220);
    return () => { window.clearTimeout(slide); window.clearTimeout(remove); };
  }, [noticeId, dismiss]);
  const Icon = notice ? icons[notice.tone] : Info20Regular;
  return <ToastContext.Provider value={context}>{children}{notice || connection !== "online" ? <Portal mountNode={{className:"dm-toast-portal"}}><div className="dm-save-toast-viewport" {...(notice?.dialogAttributes ?? [...owners.current.values()].at(-1))}>
    {notice ? <div ref={card} key={notice.id} className="dm-save-toast" role={notice.tone === "error" ? "alert" : "status"} aria-atomic="true" data-tone={notice.tone} data-leaving={leaving || undefined}>
      <Icon aria-hidden="true" /><div className="dm-toast-copy"><strong>{notice.title}</strong><span>{notice.message}</span></div>
      <DmButton appearance="subtle" density="compact" icon={<Dismiss20Regular />} aria-label="Закрыть уведомление" onClick={dismiss} />
    </div> : null}
    {connection !== "online" ? <div className="dm-connection-status" role="status">{connection === "offline" ? offlineMessage : connection === "checking" ? "Проверяем соединение…" : "Связь с сервисом пока не восстановлена."}</div> : null}
  </div></Portal> : null}</ToastContext.Provider>;
}
